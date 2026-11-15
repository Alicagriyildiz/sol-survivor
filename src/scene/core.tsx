// Shared parts of the first-person scene: per-frame runtime state, the action being
// acted out, small building blocks (bevelled box, status lamp, door) and the model loader.
// Station files in ./stations/ build on this interface (StationProps).
import { useFrame, useLoader, type ThreeElements } from '@react-three/fiber';
import { Component, Suspense, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ActionKind } from '../content/actions';
import { colorHex } from '../ui/tokens';
import type { SceneLook, WorkLook } from './look';
import { EYE, type V2, type V3 } from './world';

/** An action being acted out. `from`/`to`: the work look before and after the choice. */
export interface SceneRun {
  id: number;
  kind: ActionKind;
  station: string;
  faultId: string | null;
  optionId: string | null;
  routineId: string | null;
  label: string;
  hours: number;
  from: WorkLook;
  to: WorkLook;
}

export type Phase = 'none' | 'wait' | 'approach' | 'do' | 'finish';

export interface RunRT {
  run: SceneRun;
  phase: Phase;
  t0: number;
  p: number;
  mode: 'hand' | 'auto';
  holding: boolean;
  lastInput: number;
}

/** Mutable per-frame state shared by the scene parts (never React state). */
export interface RT {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  tPos: THREE.Vector3;
  tYaw: number;
  tPitch: number;
  walk: { pts: V2[]; t0: number; dur: number; goal: string } | null;
  at: string;
  run: RunRT | null;
  /** Wipe: brush point on the work panel (world) and whether it moved this frame. */
  brush: THREE.Vector3;
  brushOn: boolean;
  /** Shown dust level of the whole field (animates). */
  fieldDust: number;
  puff: (p: THREE.Vector3, n: number) => void;
  /** Wipe surface state (cleared fraction). */
  cleared: number;
  /** Reset the wipe canvas (full dust). */
  refill: () => void;
  erase: (u: number, v: number) => void;
  /** Ends the current walk at once (tap while walking). */
  skipWalk: () => boolean;
}

export const now = () => performance.now() / 1000;

export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export const reduceMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Is the work object of `station` showing the "before" look right now? */
export function showsBefore(rt: RT, station: string) {
  const r = rt.run;
  return !!r && r.run.station === station && (r.phase === 'wait' || r.phase === 'approach' || r.phase === 'do');
}

const rounded = new Map<string, THREE.BufferGeometry>();

/** Bevelled box (cached). */
export function rbox(w: number, h: number, d: number, r = 0.04) {
  const k = `${w}|${h}|${d}|${r}`;
  let g = rounded.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
    rounded.set(k, g);
  }
  return g;
}

export function RBox({ size, r, color, rough = 0.7, metal = 0.1, emissive, glow = 0, ...rest }: { size: V3; r?: number; color: number; rough?: number; metal?: number; emissive?: number; glow?: number } & ThreeElements['mesh']) {
  return (
    <mesh geometry={rbox(size[0], size[1], size[2], r)} castShadow receiveShadow {...rest}>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? 0} emissiveIntensity={glow} />
    </mesh>
  );
}

/** Status lamp at a work point: red-magenta and blinking while there is a problem, green when fine. */
export function Lamp({ station, rt, work, at, size = 0.07 }: { station: string; rt: MutableRefObject<RT>; work: WorkLook; at: V3; size?: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const before = showsBefore(rt.current, station);
    const w = before ? rt.current.run!.run.from : work;
    const alarm = !!w.alarm[station];
    // A problem left waiting blinks faster and wider every sol.
    const age = Math.min(3, w.alarmAge?.[station] ?? 0);
    const m = mat.current;
    if (!m) return;
    const on = alarm ? (Math.sin(clock.elapsedTime * (6 + age * 4)) > 0 ? 1 : 0.15) : 1;
    m.color.setHex(alarm ? colorHex.danger : colorHex.ok);
    m.emissive.setHex(alarm ? colorHex.danger : colorHex.ok);
    m.emissiveIntensity = (alarm ? 2.2 : 1.2) * on * powerGlow(work.power === 'off' ? 'dim' : 'on');
    if (halo.current) {
      halo.current.visible = alarm;
      halo.current.scale.setScalar(1 + on * (0.8 + age * 0.6));
    }
  });
  return (
    <group position={at}>
      <mesh>
        <sphereGeometry args={[size, 12, 8]} />
        <meshStandardMaterial ref={mat} color={colorHex.ok} emissive={colorHex.ok} emissiveIntensity={1} />
      </mesh>
      <mesh ref={halo} visible={false}>
        <sphereGeometry args={[size * 1.5, 12, 8]} />
        <meshBasicMaterial color={colorHex.danger} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Blinker({ at, color, period = 1.6, phase = 0 }: { at: V3; color: number; period?: number; phase?: number }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (m.current) m.current.emissiveIntensity = ((clock.elapsedTime / period + phase) % 1) < 0.15 ? 3 : 0.2;
  });
  return (
    <mesh position={at}>
      <sphereGeometry args={[0.08, 10, 8]} />
      <meshStandardMaterial ref={m} color={color} emissive={color} emissiveIntensity={1} />
    </mesh>
  );
}

/** One sliding door that opens when the camera comes near. */
export function Door({ at, rotY, w = 1.3, h = 2.2, rt }: { at: V3; rotY: number; w?: number; h?: number; rt: MutableRefObject<RT> }) {
  const panel = useRef<THREE.Group>(null);
  const open = useRef(0);
  const centre = useMemo(() => new THREE.Vector3(at[0], EYE, at[2]), [at]);
  useFrame((_, dt) => {
    const near = rt.current.pos.distanceTo(centre) < 3.2 ? 1 : 0;
    open.current += (near - open.current) * (1 - Math.exp(-dt * 6));
    if (panel.current) panel.current.position.x = open.current * (w + 0.05);
  });
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      {/* frame */}
      <RBox size={[0.22, h + 0.2, 0.36]} position={[-w / 2 - 0.11, (h + 0.2) / 2, 0]} color={colorHex.hullDark} />
      <RBox size={[0.22, h + 0.2, 0.36]} position={[w / 2 + 0.11, (h + 0.2) / 2, 0]} color={colorHex.hullDark} />
      <RBox size={[w + 0.44, 0.24, 0.36]} position={[0, h + 0.12, 0]} color={colorHex.hullDark} />
      <group ref={panel}>
        <RBox size={[w, h, 0.08]} position={[0, h / 2, 0]} color={colorHex.metal} rough={0.5} metal={0.4} />
        <mesh position={[0, h * 0.72, 0.05]}>
          <circleGeometry args={[0.18, 18]} />
          <meshStandardMaterial color={0x9fd7ea} transparent opacity={0.5} roughness={0.1} />
        </mesh>
        <mesh position={[0, h * 0.3, 0.05]}>
          <planeGeometry args={[w * 0.8, 0.06]} />
          <meshBasicMaterial color={colorHex.warn} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ station interface

/** Every station component gets these. Read `rt.current.run` inside useFrame (never in render). */
export interface StationProps {
  rt: MutableRefObject<RT>;
  /** State-derived look of the work objects (after the last action). */
  work: WorkLook;
  look: SceneLook;
}

/** The action being acted out at `station`, or null. `p` 0..1 is the job progress
 *  (0 during walk/approach, 1 at finish). `before`: show the look from before the choice. */
export interface StationAct {
  kind: ActionKind;
  faultId: string | null;
  optionId: string | null;
  routineId: string | null;
  phase: Phase;
  p: number;
  /** Seconds since the phase started. */
  t: number;
  before: boolean;
  from: WorkLook;
  to: WorkLook;
}

export function stationAct(rt: RT, station: string): StationAct | null {
  const r = rt.run;
  if (!r || r.run.station !== station || r.phase === 'none') return null;
  return {
    kind: r.run.kind,
    faultId: r.run.faultId,
    optionId: r.run.optionId,
    routineId: r.run.routineId,
    phase: r.phase,
    p: r.phase === 'do' ? r.p : r.phase === 'finish' ? 1 : 0,
    t: now() - r.t0,
    before: r.phase === 'wait' || r.phase === 'approach' || r.phase === 'do',
    from: r.run.from,
    to: r.run.to,
  };
}

/** The work look to show at `station` right now (the "before" look while the job runs). */
export function shownWork(rt: RT, station: string, work: WorkLook): WorkLook {
  const a = stationAct(rt, station);
  return a && a.before ? a.from : work;
}

/** 0..1 sub-progress of p inside [a, b], eased. */
export const seg = (p: number, a: number, b: number) => ease((p - a) / (b - a));

// ------------------------------------------------------------------ models (Kenney Space Kit, CC0)

const MODEL_BASE = `${import.meta.env.BASE_URL}models/kenney/`;

/** Kenney material names -> our palette (no orange/amber anywhere). */
const MATERIAL_COLORS: Record<string, number> = {
  metal: colorHex.hull,
  metalDark: colorHex.hullDark,
  metalRed: colorHex.accentDim,
  dark: 0x3a4157,
  _defaultMat: 0xcfe8ee,
  rock: colorHex.marsRose,
  rockTrack: colorHex.marsDust,
  rockDark: colorHex.marsBrown,
};

export type ModelName =
  | 'rock_largeA'
  | 'rock_largeB'
  | 'rocks_smallA'
  | 'rocks_smallB'
  | 'craterLarge'
  | 'crater'
  | 'satelliteDish_detailed'
  | 'machine_generator'
  | 'machine_generatorLarge'
  | 'machine_barrel'
  | 'machine_barrelLarge'
  | 'machine_wireless'
  | 'machine_wirelessCable'
  | 'barrels'
  | 'barrel'
  | 'desk_chair'
  | 'pipe_ring'
  | 'chimney_detailed'
  | 'supports_low'
  | 'craft_cargoA';

function ModelInner({ name, tint, shadows }: { name: ModelName; tint?: Partial<Record<string, number>>; shadows: boolean }) {
  const gltf = useLoader(GLTFLoader, `${MODEL_BASE}${name}.glb`);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = shadows;
      m.receiveShadow = true;
      const src = m.material as THREE.MeshStandardMaterial;
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.15, flatShading: true });
      const col = tint?.[src.name] ?? MATERIAL_COLORS[src.name] ?? 0xcfd3dc;
      mat.color.setHex(col);
      m.material = mat;
    });
    return o;
  }, [gltf, tint, shadows]);
  return <primitive object={obj} />;
}

/** If a model fails to load, its stand-in (or nothing) is shown; the game never stops. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn('model failed, using a simple shape:', e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A Kenney model, recoloured to the palette. `fallback`: simple shape shown while loading or if it fails. */
export function Model({ name, tint, fallback = null, shadows = true, ...rest }: { name: ModelName; tint?: Partial<Record<string, number>>; fallback?: ReactNode; shadows?: boolean } & ThreeElements['group']) {
  return (
    <group {...rest}>
      <ModelBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <ModelInner name={name} tint={tint} shadows={shadows} />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}

// ------------------------------------------------------------------ particles: steam / sparks

/** Small particle fountain (steam, sparks, water). `rate` 0 stops it; reads `rate()` every frame. */
export function Fountain({ at, rate, color = 0xe8f4f6, size = 0.12, speed = 0.6, spread = 0.25, life = 1.2, gravity = 0 }: { at: V3; rate: () => number; color?: number; size?: number; speed?: number; spread?: number; life?: number; gravity?: number }) {
  const N = 40;
  const ref = useRef<THREE.Points>(null);
  const st = useMemo(() => ({ pos: new Float32Array(N * 3).fill(-999), vel: new Float32Array(N * 3), age: new Float32Array(N).fill(99), acc: 0, k: 0 }), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    st.acc += rate() * dt * 30;
    while (st.acc >= 1) {
      st.acc -= 1;
      const i = st.k++ % N;
      const s1 = Math.sin(st.k * 12.9898) * 0.5;
      const s2 = Math.sin(st.k * 78.233) * 0.5;
      st.pos[i * 3] = at[0];
      st.pos[i * 3 + 1] = at[1];
      st.pos[i * 3 + 2] = at[2];
      st.vel[i * 3] = s1 * spread * 2;
      st.vel[i * 3 + 1] = speed * (0.7 + Math.abs(s2) * 0.6);
      st.vel[i * 3 + 2] = s2 * spread * 2;
      st.age[i] = 0;
    }
    for (let i = 0; i < N; i++) {
      if (st.age[i]! > life) {
        st.pos[i * 3 + 1] = -999;
        continue;
      }
      st.age[i]! += dt;
      st.vel[i * 3 + 1]! -= gravity * dt;
      for (let k = 0; k < 3; k++) st.pos[i * 3 + k]! += st.vel[i * 3 + k]! * dt;
    }
    if (ref.current) (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={0.75} depthWrite={false} map={softDot()} />
    </points>
  );
}

let dot: THREE.Texture | null = null;
/** Soft round sprite for particles (made once). */
export function softDot(): THREE.Texture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

/** Light factor for glowing surfaces: screens and lamps really darken when power drops. */
export const powerGlow = (p: WorkLook['power']) => (p === 'on' ? 1 : p === 'dim' ? 0.45 : 0.08);
