// First-person Mars base (lazy chunk). Read-only view of the game: it gets station info,
// looks derived from GameState and the action being acted out, and reports clicks.
// The simulation step has already happened when an action plays here: skipping or
// interrupting the animation never changes the game.
import { Canvas, useFrame, useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fmt, tr } from '../content';
import type { ActionKind } from '../content/actions';
import type { StationInfo } from '../ui/stationInfo';
import { colorHex, colors } from '../ui/tokens';
import { fmtHours } from '../ui/parts';
import type { SceneLook, WorkLook } from './look';
import {
  AIRLOCK_OUT,
  angleDelta,
  clampPitch,
  EYE,
  GREENHOUSE_AT,
  GREENHOUSE_R,
  groundHeight,
  HAB_R,
  LANDING_AT,
  PANEL_COLS,
  PANEL_H,
  PANEL_ROWS,
  PANEL_TILT,
  PANEL_W,
  panelAt,
  path,
  pitchTo,
  pointAt,
  SHELTER_AT,
  SOLAR_AT,
  SPOTS,
  WALL_H,
  wallPoint,
  walkSeconds,
  yawTo,
  type V2,
  type V3,
} from './world';

/** An action being acted out. `from`/`to`: the work look before and after the choice. */
export interface SceneRun {
  id: number;
  kind: ActionKind;
  station: string;
  label: string;
  hours: number;
  from: WorkLook;
  to: WorkLook;
}

export interface FirstPersonProps {
  stations: StationInfo[];
  /** Where the camera should be (walk target). */
  goal: string;
  look: SceneLook;
  work: WorkLook;
  run: SceneRun | null;
  /** Mission target (edge arrow when off screen). */
  target: string | null;
  onPick: (id: string) => void;
  onArrive: (id: string) => void;
  onRunDone: (id: number) => void;
  onLost: () => void;
  coach: ReactNode;
  /** Bottom bar (inventory, end sol). */
  dock: ReactNode;
  hint: boolean;
}

type Phase = 'none' | 'wait' | 'approach' | 'do' | 'finish';

interface RunRT {
  run: SceneRun;
  phase: Phase;
  t0: number;
  p: number;
  mode: 'hand' | 'auto';
  holding: boolean;
  lastInput: number;
}

/** Mutable per-frame state shared by the scene parts (never React state). */
interface RT {
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

const now = () => performance.now() / 1000;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const reduceMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const standPos = (id: string) => {
  const s = SPOTS[id] ?? SPOTS.hub!;
  return new THREE.Vector3(s.stand[0], EYE, s.stand[1]);
};

/** Is the work object of `station` showing the "before" look right now? */
function showsBefore(rt: RT, station: string) {
  const r = rt.run;
  return !!r && r.run.station === station && (r.phase === 'wait' || r.phase === 'approach' || r.phase === 'do');
}

// ------------------------------------------------------------------ shared geometry

const rounded = new Map<string, THREE.BufferGeometry>();
/** Bevelled box (cached). */
function rbox(w: number, h: number, d: number, r = 0.04) {
  const k = `${w}|${h}|${d}|${r}`;
  let g = rounded.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
    rounded.set(k, g);
  }
  return g;
}

function RBox({ size, r, color, rough = 0.7, metal = 0.1, emissive, glow = 0, ...rest }: { size: V3; r?: number; color: number; rough?: number; metal?: number; emissive?: number; glow?: number } & ThreeElements['mesh']) {
  return (
    <mesh geometry={rbox(size[0], size[1], size[2], r)} castShadow receiveShadow {...rest}>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? 0} emissiveIntensity={glow} />
    </mesh>
  );
}

// ------------------------------------------------------------------ sky, light, ground

const SKY_VERT = `varying vec3 vDir; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vDir = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float sunAmt; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, -0.2, 1.0);
 vec3 c = mix(horizon, top, pow(max(h,0.0), 0.55));
 float s = max(dot(d, normalize(sunDir)), 0.0);
 c += vec3(0.95,0.97,1.0) * (pow(s, 900.0) * 1.2 + pow(s, 18.0) * 0.18) * sunAmt;
 gl_FragColor = vec4(c, 1.0); }`;

const SUN_DIR: V3 = [0.35, 0.62, 0.7];

function skyColors(look: SceneLook): [string, string] {
  if (look.night) return [colors.skyNightTop, colors.skyNightHorizon];
  if (look.storm) return [colors.skyStormTop, colors.skyStormHorizon];
  if (look.solarEvent) return [colors.skyEventTop, colors.skyEventHorizon];
  return [colors.skyTop, colors.skyHorizon];
}

function Sky({ look }: { look: SceneLook }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  const [top, horizon] = skyColors(look);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(...SUN_DIR) },
          sunAmt: { value: 1 },
        },
      }),
    [],
  );
  const target = useMemo(() => ({ top: new THREE.Color(top), horizon: new THREE.Color(horizon) }), [top, horizon]);
  useLayoutEffect(() => {
    scene.fog = new THREE.Fog(horizon, look.storm ? 18 : 70, look.storm ? 85 : 320);
    (mat.uniforms.top!.value as THREE.Color).copy(target.top);
    (mat.uniforms.horizon!.value as THREE.Color).copy(target.horizon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((st, dt) => {
    const k = 1 - Math.exp(-dt * 2);
    (mat.uniforms.top!.value as THREE.Color).lerp(target.top, k);
    (mat.uniforms.horizon!.value as THREE.Color).lerp(target.horizon, k);
    mat.uniforms.sunAmt!.value += ((look.storm || look.night ? 0.15 : 1) - mat.uniforms.sunAmt!.value) * k;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.copy(mat.uniforms.horizon!.value as THREE.Color);
      fog.near += ((look.storm ? 14 : 70) - fog.near) * k;
      fog.far += ((look.storm ? 70 : 320) - fog.far) * k;
    }
    if (mesh.current) mesh.current.position.copy(st.camera.position);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 24, 12]} />
    </mesh>
  );
}

function Lights({ look }: { look: SceneLook }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(12, 0, -2);
    scene.add(l.target);
    const c = l.shadow.camera;
    c.left = -34;
    c.right = 34;
    c.top = 34;
    c.bottom = -34;
    c.near = 1;
    c.far = 140;
    c.updateProjectionMatrix();
    return () => void scene.remove(l.target);
  }, [scene]);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2);
    const sunT = look.night ? 0.05 : look.storm ? 0.45 : 2.1;
    const hemiT = look.night ? 0.25 : look.storm ? 1.0 : 1.05;
    if (sun.current) sun.current.intensity += (sunT - sun.current.intensity) * k;
    if (hemi.current) hemi.current.intensity += (hemiT - hemi.current.intensity) * k;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[look.solarEvent ? colorHex.skyEventTop : colorHex.skyTop, colorHex.marsBrown, 1]} />
      <directionalLight
        ref={sun}
        position={[12 + SUN_DIR[0] * 60, SUN_DIR[1] * 60, -2 + SUN_DIR[2] * 60]}
        color={look.solarEvent ? 0xf2e2f4 : 0xfff4f0}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
    </>
  );
}

function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(700, 700, 170, 170);
    g.rotateX(-Math.PI / 2);
    g.translate(10, 0, 0);
    const pos = g.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(colors.marsGround);
    const b = new THREE.Color(colors.marsRose);
    const c = new THREE.Color(colors.marsBrown);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeight(x, z);
      pos.setY(i, y);
      const n = Math.sin(x * 0.31 + z * 0.17) * 0.5 + Math.sin(x * 0.07 - z * 0.11) * 0.5;
      tmp.copy(a).lerp(b, 0.5 + 0.5 * n).lerp(c, Math.min(1, Math.max(0, y / 30)));
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

/** Deterministic rocks, kept off paths and buildings. */
function Rocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => {
    const out: [number, number, number, number][] = [];
    const segs: [V2, V2][] = [
      [AIRLOCK_OUT, [17.5, -5]],
      [[17.5, -5], SPOTS.solar!.stand],
      [AIRLOCK_OUT, [18.5, 7]],
      [[18.5, 7], SPOTS.landing!.stand],
    ];
    const nearSeg = (x: number, z: number) =>
      segs.some(([a, b]) => {
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 2.6;
      });
    for (let i = 0; out.length < 170 && i < 2000; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const r1 = h - Math.floor(h);
      const h2 = Math.sin(i * 78.233) * 12543.123;
      const r2 = h2 - Math.floor(h2);
      const ang = r1 * Math.PI * 2;
      const rad = 9 + Math.pow(r2, 0.8) * 110;
      const x = 10 + Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      if (Math.hypot(x, z) < HAB_R + 3) continue;
      if (Math.hypot(x - GREENHOUSE_AT[0], z - GREENHOUSE_AT[1]) < GREENHOUSE_R + 2) continue;
      if (Math.hypot(x - SHELTER_AT[0], z - SHELTER_AT[1]) < 5) continue;
      if (Math.abs(x - SOLAR_AT[0]) < 9 && Math.abs(z - SOLAR_AT[1]) < 6) continue;
      if (Math.hypot(x - LANDING_AT[0], z - LANDING_AT[1]) < 7) continue;
      if (x > HAB_R && x < 13 && Math.abs(z) < 3) continue;
      if (nearSeg(x, z)) continue;
      const s = 0.15 + Math.pow((r1 * 7.3) % 1, 3) * (rad > 30 ? 1.6 : 0.7);
      out.push([x, z, s, i]);
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    list.forEach(([x, z, s, i], k) => {
      o.position.set(x, groundHeight(x, z) + s * 0.25, z);
      o.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      o.scale.set(s * 1.2, s * 0.75, s);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [list]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshLambertMaterial color={colorHex.marsBrown} flatShading />
    </instancedMesh>
  );
}

/** Floating dust around the camera; thicker in a storm. */
function Dust({ look }: { look: SceneLook }) {
  const N = 260;
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.sin(i * 91.7) * 0.5 + 0.5) * 40 - 20;
      p[i * 3 + 1] = (Math.sin(i * 47.3) * 0.5 + 0.5) * 6;
      p[i * 3 + 2] = (Math.sin(i * 13.1) * 0.5 + 0.5) * 40 - 20;
    }
    return p;
  }, []);
  const mat = useRef<THREE.PointsMaterial>(null);
  useFrame((st, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = (pts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const wind = look.storm ? 6 : 0.6;
    const c = st.camera.position;
    for (let i = 0; i < N; i++) {
      let x = arr[i * 3]! + wind * dt;
      let z = arr[i * 3 + 2]! + wind * 0.3 * dt;
      if (x - c.x > 20) x -= 40;
      if (x - c.x < -20) x += 40;
      if (z - c.z > 20) z -= 40;
      if (z - c.z < -20) z += 40;
      arr[i * 3] = x;
      arr[i * 3 + 2] = z;
    }
    pts.geometry.attributes.position!.needsUpdate = true;
    if (mat.current) mat.current.opacity += ((look.storm ? 0.8 : 0.35) - mat.current.opacity) * (1 - Math.exp(-dt * 2));
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} color={colorHex.marsDust} size={look.storm ? 0.09 : 0.05} transparent opacity={0.35} depthWrite={false} />
    </points>
  );
}

// ------------------------------------------------------------------ small animated parts

/** Status lamp at a work point: red-magenta and blinking while there is a problem, green when fine. */
function Lamp({ station, rt, work, at, size = 0.07 }: { station: string; rt: MutableRefObject<RT>; work: WorkLook; at: V3; size?: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const r = rt.current.run;
    const alarm = showsBefore(rt.current, station) ? !!r!.run.from.alarm[station] : !!work.alarm[station];
    const m = mat.current;
    if (!m) return;
    const on = alarm ? (Math.sin(clock.elapsedTime * 7) > 0 ? 1 : 0.15) : 1;
    m.color.setHex(alarm ? colorHex.danger : colorHex.ok);
    m.emissive.setHex(alarm ? colorHex.danger : colorHex.ok);
    m.emissiveIntensity = (alarm ? 2.2 : 1.2) * on;
    if (halo.current) {
      halo.current.visible = alarm;
      halo.current.scale.setScalar(1 + on * 0.8);
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
        <meshBasicMaterial color={colorHex.danger} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Blinker({ at, color, period = 1.6, phase = 0 }: { at: V3; color: number; period?: number; phase?: number }) {
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

// ------------------------------------------------------------------ habitat

const SEGS = 24;
const SEG_DEG = 360 / SEGS;
const SEG_W = 2 * HAB_R * Math.sin(Math.PI / SEGS) + 0.04;
const DOORS: Record<number, string> = { 0: 'airlock', 180: 'greenhouse' };
const WINDOWS = new Set([15, 30, 315, 330, 150, 210, 270]);
const SKIP = new Set<number>(); // reserved for future openings

/** One sliding door that opens when the camera comes near. */
function Door({ at, rotY, w = 1.3, h = 2.2, rt }: { at: V3; rotY: number; w?: number; h?: number; rt: MutableRefObject<RT> }) {
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

function HabWall({ rt, look }: { rt: MutableRefObject<RT>; look: SceneLook }) {
  const parts: ReactNode[] = [];
  for (let k = 0; k < SEGS; k++) {
    const deg = k * SEG_DEG;
    if (SKIP.has(deg)) continue;
    const a = (deg * Math.PI) / 180;
    const pos: V3 = [Math.cos(a) * HAB_R, 0, -Math.sin(a) * HAB_R];
    const rotY = a + Math.PI / 2; // wall plane tangent, facing the centre
    if (DOORS[deg]) {
      parts.push(<Door key={k} at={pos} rotY={rotY} rt={rt} />);
      parts.push(<RBox key={`t${k}`} size={[SEG_W, WALL_H - 2.42, 0.2]} position={[pos[0], 2.42 + (WALL_H - 2.42) / 2, pos[2]]} rotation={[0, rotY, 0]} color={colorHex.hull} />);
      continue;
    }
    if (WINDOWS.has(deg)) {
      parts.push(
        <group key={k} position={pos} rotation={[0, rotY, 0]}>
          <RBox size={[SEG_W, 0.95, 0.2]} position={[0, 0.475, 0]} color={colorHex.hull} />
          <RBox size={[SEG_W, 0.85, 0.2]} position={[0, WALL_H - 0.425, 0]} color={colorHex.hull} />
          <RBox size={[0.12, 1.2, 0.24]} position={[-SEG_W / 2 + 0.06, 1.55, 0]} color={colorHex.hullDark} />
          <RBox size={[0.12, 1.2, 0.24]} position={[SEG_W / 2 - 0.06, 1.55, 0]} color={colorHex.hullDark} />
          <mesh position={[0, 1.55, 0]} raycast={() => null}>
            <planeGeometry args={[SEG_W - 0.2, 1.2]} />
            <meshStandardMaterial color={0xbfe6ef} transparent opacity={0.14} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>,
      );
      continue;
    }
    parts.push(<RBox key={k} size={[SEG_W, WALL_H, 0.2]} position={[pos[0], WALL_H / 2, pos[2]]} rotation={[0, rotY, 0]} color={colorHex.hull} />);
    // Ribs every other segment (inside), so the wall reads as a structure.
    if (k % 2 === 0)
      parts.push(
        <RBox key={`r${k}`} size={[0.14, WALL_H, 0.16]} position={[Math.cos(a + Math.PI / SEGS) * (HAB_R - 0.14), WALL_H / 2, -Math.sin(a + Math.PI / SEGS) * (HAB_R - 0.14)]} rotation={[0, rotY, 0]} color={colorHex.hullDark} />,
      );
  }
  const lightOn = look.lights === 'on' ? 1 : look.lights === 'dim' ? 0.4 : 0.06;
  return (
    <group>
      {parts}
      {/* Roof: low dome, casts shade inside. */}
      <mesh position={[0, WALL_H, 0]} scale={[1, 0.42, 1]} castShadow receiveShadow>
        <sphereGeometry args={[HAB_R + 0.12, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={colorHex.hull} roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, WALL_H - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HAB_R - 0.4, HAB_R + 0.15, 48]} />
        <meshStandardMaterial color={colorHex.hullDark} side={THREE.DoubleSide} />
      </mesh>
      {/* Floor. */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[HAB_R + 0.1, 48]} />
        <meshStandardMaterial color={0x4a5370} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.75, 48]} />
        <meshBasicMaterial color={colorHex.accentDim} />
      </mesh>
      {/* Light ring under the roof. */}
      <mesh position={[0, WALL_H - 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 2.85, 48]} />
        <meshStandardMaterial color={0xe9fbfc} emissive={0xe9fbfc} emissiveIntensity={lightOn * 1.6} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, WALL_H - 0.4, 0]} intensity={lightOn * 26} distance={16} decay={1.6} color={0xeefcff} />
      <pointLight position={[0, 1.8, -3.6]} intensity={lightOn * 6} distance={6} decay={1.6} color={0xdff6ff} />
      {/* Central table. */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 0.9, 12]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
      <RBox size={[1.4, 0.06, 1.0]} r={0.03} position={[0, 0.96, 0]} color={colorHex.hullDark} />
    </group>
  );
}

/** Hab roof outside: antenna that turns, blinking lights. */
function Roof() {
  const dish = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (dish.current) dish.current.rotation.y = clock.elapsedTime * 0.35;
  });
  return (
    <group position={[1.8, WALL_H + 2.4, 1.2]}>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 1.2, 8]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
      <group ref={dish}>
        <mesh position={[0, 0.35, 0]} rotation={[0.9, 0, 0]} castShadow>
          <sphereGeometry args={[0.7, 18, 8, 0, Math.PI * 2, 0, 0.9]} />
          <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.5, 0.35]} rotation={[0.9, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
      </group>
      <Blinker at={[0, 0.25, -0.9]} color={colorHex.danger} period={1.4} />
      <Blinker at={[-3.6, -1.5, -2]} color={colorHex.accent} period={2.1} phase={0.5} />
    </group>
  );
}

/** Hub work point: life-support rack with a filter slot, a console and a status lamp. */
function HubRack({ rt, work }: { rt: MutableRefObject<RT>; work: WorkLook }) {
  const oldC = useRef<THREE.Group>(null);
  const newC = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Mesh>(null);
  const tape = useRef<THREE.Group>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const Z0 = -5.35; // cartridge seated
  const SLOT: V3 = [-0.35, 1.15, 0];
  const oldMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const r = rt.current.run;
    const here = r && r.run.station === 'hub' && r.phase !== 'none';
    const kind = here ? r.run.kind : null;
    const before = showsBefore(rt.current, 'hub');
    const filter = before ? r!.run.from.filter : work.filter;
    const o = oldC.current;
    const n = newC.current;
    if (!o || !n) return;
    // Default: the shown filter sits in the slot.
    o.visible = filter !== 'new';
    n.visible = filter === 'new';
    o.position.set(SLOT[0], SLOT[1], Z0);
    o.scale.setScalar(1);
    n.position.set(SLOT[0], SLOT[1], Z0);
    if (oldMat.current) oldMat.current.color.setHex(filter === 'clogged' ? colorHex.filterDirty : colorHex.hullDark);
    if (lever.current) lever.current.rotation.z = 0;
    if (tape.current) {
      tape.current.visible = filter === 'taped';
      tape.current.children.forEach((c) => (c.visible = true));
    }
    if (kind === 'replace' && r && (r.phase === 'do' || r.phase === 'approach')) {
      const p = r.phase === 'approach' ? 0 : r.p;
      o.visible = p < 0.48;
      n.visible = p >= 0.42;
      const pull = ease(p / 0.3);
      const drop = ease((p - 0.3) / 0.15);
      o.position.set(SLOT[0] - drop * 0.7, SLOT[1] - drop * 0.9, Z0 + pull * 0.62);
      o.scale.setScalar(1 - drop * 0.4);
      const bring = ease((p - 0.42) / 0.13);
      const push = ease((p - 0.55) / 0.3);
      n.position.set(SLOT[0] + (1 - bring) * 0.55, SLOT[1] - (1 - bring) * 0.45, Z0 + 0.62 * (1 - push) + (1 - bring) * 0.4);
      if (lever.current) lever.current.rotation.z = -ease((p - 0.85) / 0.15) * 1.2;
      if (r.phase === 'do' && Math.floor(p * 40) !== Math.floor((p - 0.02) * 40) && p < 0.35) rt.current.puff(new THREE.Vector3(SLOT[0], SLOT[1], Z0 + 0.4 + pull * 0.4), 1);
    }
    if (kind === 'patch' && r && (r.phase === 'do' || r.phase === 'approach') && tape.current) {
      const p = r.phase === 'approach' ? 0 : r.p;
      tape.current.visible = true;
      tape.current.children.forEach((c, i) => (c.visible = p > 0.15 + i * 0.25));
    }
    if (screen.current) {
      // The console screen shows the alarm too (red-magenta, blinking), not only the lamp.
      const alarm = before ? !!r!.run.from.alarm.hub : !!work.alarm.hub;
      screen.current.emissive.setHex(alarm ? colorHex.danger : colorHex.accent);
      screen.current.emissiveIntensity = alarm ? (Math.sin(clock.elapsedTime * 7) > 0 ? 1.1 : 0.35) : 0.8 + Math.sin(clock.elapsedTime * 3) * 0.15;
    }
  });
  const cartridge = (dirty: boolean, matRef?: MutableRefObject<THREE.MeshStandardMaterial | null>) => (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.5, 20]} />
        <meshStandardMaterial ref={matRef} color={dirty ? colorHex.filterDirty : colorHex.filterNew} roughness={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.18]}>
        <cylinderGeometry args={[0.155, 0.155, 0.06, 20]} />
        <meshStandardMaterial color={dirty ? colorHex.metal : colorHex.accent} emissive={dirty ? 0 : colorHex.accent} emissiveIntensity={dirty ? 0 : 0.4} />
      </mesh>
      <mesh position={[0, 0, 0.26]}>
        <torusGeometry args={[0.07, 0.018, 8, 16]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
    </>
  );
  return (
    <group>
      <group position={[0, 0, 0]}>
        {/* Cabinet against the north wall. */}
        <RBox size={[2.3, 2.3, 0.5]} position={[0, 1.15, -5.62]} color={colorHex.hullDark} />
        <RBox size={[0.6, 0.6, 0.08]} r={0.03} position={[SLOT[0], SLOT[1], -5.36]} color={colorHex.metal} metal={0.5} rough={0.4} />
        <mesh position={[SLOT[0], SLOT[1], -5.31]}>
          <circleGeometry args={[0.18, 24]} />
          <meshStandardMaterial color={0x141a2c} />
        </mesh>
        <mesh ref={lever} position={[SLOT[0] + 0.24, SLOT[1] + 0.22, -5.3]}>
          <boxGeometry args={[0.06, 0.22, 0.05]} />
          <meshStandardMaterial color={colorHex.warn} />
        </mesh>
        {/* Console screen and switches. */}
        <RBox size={[0.75, 0.5, 0.06]} r={0.02} position={[0.55, 1.55, -5.34]} color={0x1b2338} />
        <mesh position={[0.55, 1.55, -5.305]}>
          <planeGeometry args={[0.64, 0.4]} />
          <meshStandardMaterial ref={screen} color={0x123a44} emissive={colorHex.accent} emissiveIntensity={0.8} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <RBox key={i} size={[0.1, 0.16, 0.06]} r={0.02} position={[0.33 + i * 0.22, 1.05, -5.33]} color={colorHex.hull} />
        ))}
        {/* Pipes. */}
        <mesh position={[0.95, 1.2, -5.32]}>
          <cylinderGeometry args={[0.06, 0.06, 2.3, 10]} />
          <meshStandardMaterial color={colorHex.metal} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[-1.0, 1.2, -5.32]}>
          <cylinderGeometry args={[0.05, 0.05, 2.3, 10]} />
          <meshStandardMaterial color={colorHex.accentDim} />
        </mesh>
        <mesh position={[0.95, 0.75, -5.25]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.025, 6, 16]} />
          <meshStandardMaterial color={colorHex.danger} />
        </mesh>
      </group>
      <group ref={oldC}>{cartridge(true, oldMat)}</group>
      <group ref={newC}>{cartridge(false)}</group>
      {/* Tape strips over the slot (the "Apollo 13" fix). */}
      <group ref={tape} position={[SLOT[0], SLOT[1], -5.27]}>
        {[-0.6, 0, 0.6].map((rz, i) => (
          <mesh key={i} rotation={[0, 0, rz]}>
            <planeGeometry args={[0.62, 0.09]} />
            <meshStandardMaterial color={colorHex.tape} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <Lamp station="hub" rt={rt} work={work} at={[-0.9, 2.05, -5.33]} size={0.07} />
    </group>
  );
}

function BatteryRack({ rt, work, power }: { rt: MutableRefObject<RT>; work: WorkLook; power: SceneLook['lights'] }) {
  const p = wallPoint(40, 0, 0.55);
  const rotY = (40 * Math.PI) / 180 + Math.PI / 2;
  const fill = power === 'on' ? 0.8 : power === 'dim' ? 0.45 : 0.15;
  return (
    <group position={p} rotation={[0, rotY - Math.PI / 2, 0]}>
      <group rotation={[0, -Math.PI / 2, 0]}>
        <RBox size={[1.7, 2.0, 0.6]} position={[0, 1.0, 0]} color={colorHex.hullDark} />
        {[0, 1, 2].map((r) =>
          [0, 1].map((c) => (
            <RBox key={`${r}${c}`} size={[0.65, 0.42, 0.1]} r={0.03} position={[-0.38 + c * 0.76, 0.5 + r * 0.55, 0.33]} color={0x35405e} metal={0.3} rough={0.5} />
          )),
        )}
        <mesh position={[0, 1.9, 0.31]}>
          <planeGeometry args={[1.2, 0.1]} />
          <meshBasicMaterial color={0x1b2338} />
        </mesh>
        <mesh position={[-0.6 + 0.6 * fill, 1.9, 0.315]}>
          <planeGeometry args={[1.2 * fill, 0.08]} />
          <meshBasicMaterial color={fill > 0.5 ? colorHex.ok : colorHex.warn} />
        </mesh>
      </group>
      <Lamp station="battery" rt={rt} work={work} at={[0.33, 2.1, 0.75]} />
    </group>
  );
}

/** Round hatch to the buried shelter. */
function ShelterHatch({ rt, work }: { rt: MutableRefObject<RT>; work: WorkLook }) {
  const p = wallPoint(235, 0, 0.12);
  const rotY = (235 * Math.PI) / 180 + Math.PI / 2;
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <mesh position={[0, 1.1, 0]}>
        <torusGeometry args={[0.7, 0.1, 10, 28]} />
        <meshStandardMaterial color={colorHex.hullDark} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.1, 0.02]}>
        <circleGeometry args={[0.66, 28]} />
        <meshStandardMaterial color={colorHex.metal} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.1, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.03, 8, 20]} />
        <meshStandardMaterial color={colorHex.warn} />
      </mesh>
      <Lamp station="shelter" rt={rt} work={work} at={[0.85, 1.9, 0.1]} />
    </group>
  );
}

function AirlockTunnel({ rt, work }: { rt: MutableRefObject<RT>; work: WorkLook }) {
  const len = AIRLOCK_OUT[0] - 0.4 - HAB_R;
  return (
    <group>
      <mesh position={[HAB_R + len / 2, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, len, 22, 1, true]} />
        <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[HAB_R + len / 2, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len, 1.8]} />
        <meshStandardMaterial color={0x4a5370} />
      </mesh>
      {[0.2, 0.5, 0.8].map((t) => (
        <mesh key={t} position={[HAB_R + len * t, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.48, 0.07, 6, 24]} />
          <meshStandardMaterial color={colorHex.hullDark} />
        </mesh>
      ))}
      <pointLight position={[HAB_R + len / 2, 2.4, 0]} intensity={5} distance={7} color={0xeefcff} />
      <Door at={[AIRLOCK_OUT[0] - 0.3, 0.05, 0]} rotY={-Math.PI / 2} rt={rt} w={1.2} h={2.1} />
      {/* Door seal (work point): a dark gasket around the outer door. */}
      <group position={[AIRLOCK_OUT[0] - 0.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        {([[-0.66, 1.1, 0.06, 2.2], [0.66, 1.1, 0.06, 2.2], [0, 2.2, 1.38, 0.06]] as const).map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0]}>
            <boxGeometry args={[w, h, 0.05]} />
            <meshStandardMaterial color={0x2a2f40} roughness={0.9} />
          </mesh>
        ))}
      </group>
      <Lamp station="airlock" rt={rt} work={work} at={[AIRLOCK_OUT[0] - 0.5, 2.35, 0.75]} />
      {/* Suit rack. */}
      <RBox size={[0.5, 1.6, 0.4]} position={[8.0, 0.9, -1.15]} color={colorHex.suit} />
    </group>
  );
}

function Greenhouse({ rt, work, look }: { rt: MutableRefObject<RT>; work: WorkLook; look: SceneLook }) {
  const [gx, gz] = GREENHOUSE_AT;
  const inner = -HAB_R;
  const outer = gx + GREENHOUSE_R - 0.2;
  const lightOn = look.lights === 'on' ? 1 : look.lights === 'dim' ? 0.4 : 0.05;
  return (
    <group>
      <mesh position={[(inner + outer) / 2, 1.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.35, 1.35, Math.abs(outer - inner) + 0.3, 18, 1, true]} />
        <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} />
      </mesh>
      <group position={[gx, 0, gz]}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[GREENHOUSE_R, 40]} />
          <meshStandardMaterial color={0x4a5370} />
        </mesh>
        <mesh position={[0, 0.02, 0]} raycast={() => null}>
          <sphereGeometry args={[GREENHOUSE_R, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={0xd7f3f3} transparent opacity={0.16} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.02, 0]} raycast={() => null}>
          <sphereGeometry args={[GREENHOUSE_R + 0.01, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color={0xe8fbfa} wireframe transparent opacity={0.4} />
        </mesh>
        {[-1.2, 0, 1.2].map((z) => (
          <group key={z} position={[-1.7, 0, z]}>
            <RBox size={[1.0, 0.7, 0.9]} position={[0, 0.35, 0]} color={colorHex.hullDark} />
            <mesh position={[0, 0.72, 0]}>
              <boxGeometry args={[0.9, 0.06, 0.8]} />
              <meshLambertMaterial color={colorHex.marsBrown} />
            </mesh>
            {[-0.25, 0.25].map((x) =>
              [-0.22, 0.22].map((zz) => (
                <mesh key={`${x}${zz}`} position={[x, 0.95, zz]} castShadow>
                  <coneGeometry args={[0.13, 0.45, 6]} />
                  <meshStandardMaterial color={colorHex.plant} emissive={colorHex.plant} emissiveIntensity={0.1} />
                </mesh>
              )),
            )}
          </group>
        ))}
        <pointLight position={[0, 3.2, 0]} intensity={lightOn * 14} distance={9} color={0xf0e4ff} />
        <Lamp station="greenhouse" rt={rt} work={work} at={[-1.7, 1.6, -1.9]} />
      </group>
    </group>
  );
}

function ShelterMound({ look }: { look: SceneLook }) {
  const s = look.shelterBig ? 1.25 : 1;
  return (
    <group position={[SHELTER_AT[0], 0, SHELTER_AT[1]]}>
      <mesh scale={[3.2 * s, 1.7 * s, 2.8 * s]} castShadow receiveShadow>
        <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color={colorHex.marsRose} flatShading />
      </mesh>
      {look.shelterBig &&
        [-1.5, -0.5, 0.5, 1.5].map((x, i) => <RBox key={i} size={[0.8, 0.4, 0.5]} r={0.12} position={[x * 1.4, 0.2 + (i % 2) * 0.1, -2.9]} color={colorHex.marsRose} rough={1} />)}
      <mesh position={[2.8, 0.6, -2.0]} rotation={[0, -0.9, 0]}>
        <boxGeometry args={[1.0, 1.2, 0.3]} />
        <meshStandardMaterial color={colorHex.hullDark} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ solar field + wipe surface

const DUST_W = 256;
const DUST_H = 160;
const GRID_X = 16;
const GRID_Y = 10;

function SolarField({ rt, dustLevel }: { rt: MutableRefObject<RT>; dustLevel: number }) {
  const cells = useRef<THREE.InstancedMesh>(null);
  const cellMat = useRef<THREE.MeshStandardMaterial>(null);
  const dustMesh = useRef<THREE.Mesh>(null);
  const dustMat = useRef<THREE.MeshLambertMaterial>(null);
  const workMat = useRef<THREE.MeshStandardMaterial>(null);
  const shine = useRef(0);
  const panels = useMemo(() => {
    const out: V3[] = [];
    for (let r = 0; r < PANEL_ROWS; r++) for (let c = 0; c < PANEL_COLS; c++) if (!(r === PANEL_ROWS - 1 && c === 0)) out.push(panelAt(r, c));
    return out;
  }, []);
  const work = panelAt(PANEL_ROWS - 1, 0);
  const tilt = -Math.PI / 2 + PANEL_TILT;

  // Wipe canvas: alpha = dust left. Grid tracks how much is cleared.
  const dust = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = DUST_W;
    canvas.height = DUST_H;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const grid = new Uint8Array(GRID_X * GRID_Y);
    return { canvas, ctx, tex, grid };
  }, []);
  useLayoutEffect(() => {
    const { ctx, tex, grid } = dust;
    const refill = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, DUST_W, DUST_H);
      ctx.fillStyle = colors.marsDust;
      ctx.globalAlpha = 0.93;
      ctx.fillRect(0, 0, DUST_W, DUST_H);
      for (let i = 0; i < 900; i++) {
        const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * DUST_W;
        const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * DUST_H;
        ctx.globalAlpha = 0.25 + ((i * 7) % 10) / 20;
        ctx.fillStyle = i % 3 ? colors.marsRose : colors.marsBrown;
        ctx.fillRect(x, y, 2 + (i % 4), 2 + (i % 3));
      }
      ctx.globalAlpha = 1;
      grid.fill(0);
      rt.current.cleared = 0;
      tex.needsUpdate = true;
    };
    const erase = (u: number, v: number) => {
      const x = u * DUST_W;
      const y = (1 - v) * DUST_H;
      const R = 30;
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(x, y, 4, x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      let n = 0;
      for (let gy = 0; gy < GRID_Y; gy++)
        for (let gx = 0; gx < GRID_X; gx++) {
          const cx = ((gx + 0.5) / GRID_X) * DUST_W;
          const cy = ((gy + 0.5) / GRID_Y) * DUST_H;
          if (Math.hypot(cx - x, cy - y) < R * 0.8) grid[gy * GRID_X + gx] = 1;
          n += grid[gy * GRID_X + gx]!;
        }
      rt.current.cleared = n / grid.length;
      tex.needsUpdate = true;
      // Brush point in the world, for the hand and the dust puffs.
      const m = dustMesh.current;
      if (m) {
        rt.current.brush.set((u - 0.5) * PANEL_W, (v - 0.5) * PANEL_H, 0.03).applyMatrix4(m.matrixWorld);
        rt.current.brushOn = true;
      }
    };
    rt.current.refill = refill;
    rt.current.erase = erase;
    refill();
  }, [dust, rt]);

  useLayoutEffect(() => {
    const m = cells.current;
    if (!m) return;
    const o = new THREE.Object3D();
    panels.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2]);
      o.rotation.set(tilt, 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [panels, tilt]);

  const clean = useMemo(() => new THREE.Color(colorHex.panelCell), []);
  const dirty = useMemo(() => new THREE.Color(colorHex.marsDust), []);
  useFrame((_, dt) => {
    const R = rt.current;
    const r = R.run;
    const before = showsBefore(R, 'solar');
    const target = before ? r!.run.from.solarDust : dustLevel;
    R.fieldDust += (target - R.fieldDust) * (1 - Math.exp(-dt * (before ? 8 : 2.2)));
    const d = Math.max(0, Math.min(1, R.fieldDust));
    if (cellMat.current) {
      cellMat.current.color.copy(clean).lerp(dirty, d * 0.92);
      cellMat.current.roughness = 0.25 + d * 0.7;
      cellMat.current.metalness = 0.55 * (1 - d);
    }
    // Work panel: dust layer from the canvas; level fades with the field outside a wipe.
    const wiping = r && r.run.station === 'solar' && r.run.kind === 'wipe' && (r.phase === 'do' || r.phase === 'approach');
    if (dustMat.current) dustMat.current.opacity = wiping ? Math.max(0.0001, r!.run.from.solarDust) : d;
    if (r && r.run.station === 'solar' && r.phase === 'finish') shine.current = 1;
    shine.current = Math.max(0, shine.current - dt * 0.6);
    if (workMat.current) {
      workMat.current.emissiveIntensity = 0.15 + shine.current * 1.4;
      workMat.current.roughness = 0.2 + d * 0.6;
    }
    if (cellMat.current) cellMat.current.emissiveIntensity = 0.1 + shine.current * 0.9 * (1 - d);
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    const r = rt.current.run;
    if (!r || r.run.kind !== 'wipe' || r.run.station !== 'solar' || r.phase !== 'do' || !e.uv) return;
    e.stopPropagation();
    r.mode = 'hand';
    r.holding = true;
    r.lastInput = now();
    rt.current.erase(e.uv.x, e.uv.y);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const r = rt.current.run;
    if (!r || !r.holding || r.run.kind !== 'wipe' || r.phase !== 'do' || !e.uv) return;
    e.stopPropagation();
    r.mode = 'hand';
    r.lastInput = now();
    rt.current.erase(e.uv.x, e.uv.y);
  };

  return (
    <group>
      <instancedMesh ref={cells} args={[undefined, undefined, panels.length]} castShadow receiveShadow>
        <boxGeometry args={[PANEL_W, PANEL_H, 0.05]} />
        <meshStandardMaterial ref={cellMat} color={colorHex.panelCell} roughness={0.25} metalness={0.55} emissive={0x16306a} emissiveIntensity={0.1} />
      </instancedMesh>
      {/* Frames and posts. */}
      {[...panels, work].map((p, i) => (
        <group key={i} position={[p[0], 0, p[2]]}>
          <mesh position={[0, (p[1] - 0.25) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, p[1] - 0.25, 6]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        </group>
      ))}
      {/* The work panel: bigger detail, wipe surface on top. */}
      <group position={work} rotation={[tilt, 0, 0]}>
        <RBox size={[PANEL_W + 0.1, PANEL_H + 0.1, 0.05]} r={0.02} position={[0, 0, -0.03]} color={colorHex.hullDark} metal={0.4} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[PANEL_W, PANEL_H, 0.04]} />
          <meshStandardMaterial ref={workMat} color={colorHex.panelCell} roughness={0.2} metalness={0.6} emissive={0x2a58b0} emissiveIntensity={0.15} />
        </mesh>
        {/* Cell grid lines. */}
        {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
          <mesh key={x} position={[x, 0, 0.022]}>
            <planeGeometry args={[0.012, PANEL_H]} />
            <meshBasicMaterial color={0x9fb6e6} transparent opacity={0.35} />
          </mesh>
        ))}
        {[-0.275, 0, 0.275].map((y) => (
          <mesh key={y} position={[0, y, 0.022]}>
            <planeGeometry args={[PANEL_W, 0.012]} />
            <meshBasicMaterial color={0x9fb6e6} transparent opacity={0.35} />
          </mesh>
        ))}
        <mesh ref={dustMesh} position={[0, 0, 0.03]} onPointerDown={down} onPointerMove={move}>
          <planeGeometry args={[PANEL_W, PANEL_H]} />
          <meshLambertMaterial ref={dustMat} map={dust.tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      </group>
      {/* Junction box with the status lamp. */}
      <RBox size={[0.4, 0.5, 0.25]} position={[work[0] - 1.25, 0.5, work[2] + 0.4]} color={colorHex.hull} />
    </group>
  );
}

/** Small rover with a jointed arm (moving detail near the solar field). */
function Rover() {
  const base = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const fore = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (base.current) base.current.rotation.y = Math.sin(t * 0.4) * 0.9;
    if (upper.current) upper.current.rotation.z = -0.6 + Math.sin(t * 0.7) * 0.35;
    if (fore.current) fore.current.rotation.z = 1.1 + Math.sin(t * 0.9 + 1) * 0.4;
  });
  return (
    <group position={[17.5, 0, -14.5]} rotation={[0, 0.6, 0]}>
      <RBox size={[2.0, 0.55, 1.3]} position={[0, 0.75, 0]} color={colorHex.hull} />
      {[-0.75, 0.75].map((x) =>
        [-0.75, 0.75].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.35, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.25, 14]} />
            <meshStandardMaterial color={0x3a3f50} roughness={0.9} />
          </mesh>
        )),
      )}
      <group ref={base} position={[0.6, 1.05, 0]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.2, 0.18, 12]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        <group ref={upper}>
          <RBox size={[0.12, 0.9, 0.12]} r={0.03} position={[0, 0.45, 0]} color={colorHex.hullDark} />
          <group ref={fore} position={[0, 0.9, 0]}>
            <mesh>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color={colorHex.metal} />
            </mesh>
            <RBox size={[0.1, 0.7, 0.1]} r={0.03} position={[0, 0.35, 0]} color={colorHex.hull} />
            <mesh position={[0, 0.72, 0]}>
              <coneGeometry args={[0.08, 0.16, 8]} />
              <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accent} emissiveIntensity={0.6} />
            </mesh>
          </group>
        </group>
      </group>
      <Blinker at={[-0.8, 1.15, 0]} color={colorHex.accent} period={1.2} />
    </group>
  );
}

function Landing({ locked }: { locked: boolean }) {
  const [x, z] = LANDING_AT;
  return (
    <group position={[x, 0.02, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5, 40]} />
        <meshLambertMaterial color={0xa49ca4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.8, 4.3, 40]} />
        <meshBasicMaterial color={locked ? colorHex.grey : colorHex.warn} />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, r]} position={[0, 0.03, 0]}>
          <planeGeometry args={[4.6, 0.5]} />
          <meshBasicMaterial color={0xf3f5fa} />
        </mesh>
      ))}
      <mesh position={[5.6, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.8, 8]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
      <Blinker at={[5.6, 2.9, 0]} color={colorHex.accent} period={1.0} />
      {[0, 1, 2, 3].map((i) => (
        <Blinker key={i} at={[Math.cos((i * Math.PI) / 2) * 4.6, 0.15, Math.sin((i * Math.PI) / 2) * 4.6]} color={colorHex.warn} period={2} phase={i * 0.25} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ puffs (dust from brushing)

function Puffs({ rt }: { rt: MutableRefObject<RT> }) {
  const N = 90;
  const ref = useRef<THREE.Points>(null);
  const st = useMemo(() => ({ pos: new Float32Array(N * 3).fill(-999), vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0 }), []);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  useLayoutEffect(() => {
    rt.current.puff = (p, n) => {
      for (let k = 0; k < n; k++) {
        const i = st.next++ % N;
        const s = Math.sin(st.next * 17.17);
        st.pos[i * 3] = p.x + s * 0.08;
        st.pos[i * 3 + 1] = p.y + 0.02;
        st.pos[i * 3 + 2] = p.z + Math.cos(st.next * 9.1) * 0.08;
        st.vel[i * 3] = s * 0.35;
        st.vel[i * 3 + 1] = 0.35 + Math.abs(Math.cos(st.next * 3.3)) * 0.45;
        st.vel[i * 3 + 2] = Math.cos(st.next * 5.7) * 0.35;
        st.life[i] = 1;
      }
    };
  }, [rt, st]);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    for (let i = 0; i < N; i++) {
      if (st.life[i]! <= 0) continue;
      st.life[i]! -= dt * 0.9;
      if (st.life[i]! <= 0) {
        st.pos[i * 3 + 1] = -999;
        continue;
      }
      for (let k = 0; k < 3; k++) st.pos[i * 3 + k]! += st.vel[i * 3 + k]! * dt;
      st.vel[i * 3 + 1]! *= 0.97;
    }
    (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} color={colorHex.marsDust} size={0.16} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

// ------------------------------------------------------------------ hand and tool

type Tool = 'brush' | 'filter' | 'tape' | 'wrench';

function toolFor(kind: ActionKind | null, at: string): Tool {
  if (kind === 'wipe') return 'brush';
  if (kind === 'replace') return 'filter';
  if (kind === 'patch') return 'tape';
  if (!kind && SPOTS[at]?.outside) return 'brush';
  return 'wrench';
}

function Hand({ rt }: { rt: MutableRefObject<RT> }) {
  const g = useRef<THREE.Group>(null);
  const tools = useRef<Record<Tool, THREE.Group | null>>({ brush: null, filter: null, tape: null, wrench: null });
  const { camera } = useThree();
  const tmp = useMemo(() => ({ off: new THREE.Vector3(), q: new THREE.Quaternion(), target: new THREE.Vector3(), cur: new THREE.Vector3(), init: false }), []);
  useFrame(({ clock }, dt) => {
    const grp = g.current;
    if (!grp) return;
    const R = rt.current;
    const r = R.run;
    const kind = r && r.phase !== 'wait' ? r.run.kind : null;
    const tool = toolFor(kind, R.at);
    for (const [k, obj] of Object.entries(tools.current)) if (obj) obj.visible = k === tool && !(tool === 'filter' && r && r.p > 0.55);
    const t = clock.elapsedTime;
    const walking = !!R.walk;
    const sway = walking ? Math.sin(t * 9) * 0.015 : Math.sin(t * 1.3) * 0.006;
    // Rest pose: lower right of the view.
    tmp.off.set(0.3 + sway, -0.3 + Math.abs(sway) * 0.6, -0.55);
    let reach = 0;
    if (r && r.phase === 'do' && r.run.kind !== 'wipe') reach = 0.5 + Math.sin(t * 6) * 0.08 * (r.holding || r.mode === 'auto' ? 1 : 0);
    tmp.off.z -= reach * 0.25;
    tmp.off.x -= reach * 0.15;
    tmp.target.copy(tmp.off).applyQuaternion(camera.quaternion).add(camera.position);
    // Wiping: the brush goes onto the panel where it is being cleaned.
    if (r && r.run.kind === 'wipe' && r.phase === 'do' && R.brushOn) {
      tmp.target.copy(R.brush).add(new THREE.Vector3(0, 0.08, 0));
    }
    if (!tmp.init) {
      tmp.cur.copy(tmp.target);
      tmp.init = true;
    }
    const k = r && r.phase === 'do' ? 1 - Math.exp(-dt * 18) : 1 - Math.exp(-dt * 30);
    tmp.cur.lerp(tmp.target, k);
    grp.position.copy(tmp.cur);
    grp.quaternion.copy(camera.quaternion);
    grp.rotateX(r && r.run.kind === 'wipe' && r.phase === 'do' ? -0.9 : 0.15);
    grp.rotateZ(0.25);
  });
  const suit = <meshStandardMaterial color={colorHex.suit} roughness={0.8} />;
  return (
    <group ref={g}>
      {/* Glove + cuff. */}
      <mesh geometry={rbox(0.085, 0.07, 0.11, 0.03)} position={[0, 0, 0.02]}>
        {suit}
      </mesh>
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.08, 14]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.6} />
      </mesh>
      <mesh geometry={rbox(0.03, 0.03, 0.06, 0.012)} position={[-0.05, 0.005, -0.02]} rotation={[0, 0.5, 0]}>
        {suit}
      </mesh>
      <group ref={(o) => void (tools.current.brush = o)} position={[0, 0.02, -0.06]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.2, 8]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        <mesh geometry={rbox(0.14, 0.04, 0.06, 0.012)} position={[0, -0.02, -0.11]}>
          <meshStandardMaterial color={colorHex.accentDim} />
        </mesh>
        <mesh position={[0, -0.05, -0.11]}>
          <boxGeometry args={[0.13, 0.03, 0.05]} />
          <meshStandardMaterial color={0xe6e0d8} roughness={1} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.filter = o)} position={[0, 0.06, -0.08]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.22, 16]} />
          <meshStandardMaterial color={colorHex.filterNew} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.08]}>
          <cylinderGeometry args={[0.072, 0.072, 0.03, 16]} />
          <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accent} emissiveIntensity={0.4} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.tape = o)} position={[0, 0.05, -0.05]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.045, 0.02, 8, 16]} />
          <meshStandardMaterial color={colorHex.tape} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.wrench = o)} position={[0, 0.02, -0.08]}>
        <mesh geometry={rbox(0.025, 0.02, 0.18, 0.008)}>
          <meshStandardMaterial color={colorHex.metal} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.025, 0.01, 6, 12, Math.PI * 1.5]} />
          <meshStandardMaterial color={colorHex.metal} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ camera and walking

function Eyes({ rt, goal, onArrive }: { rt: MutableRefObject<RT>; goal: string; onArrive: (id: string) => void }) {
  const { camera, invalidate } = useThree();
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const face = (id: string, close = false) => {
    const s = SPOTS[id] ?? SPOTS.hub!;
    const R = rt.current;
    const from: V3 = close ? s.work.pos : [s.stand[0], EYE, s.stand[1]];
    const to = close ? s.work.look : s.look;
    R.tPos.set(from[0], from[1], from[2]);
    R.tYaw = R.yaw + angleDelta(R.yaw, yawTo([from[0], from[2]], [to[0], to[2]]));
    R.tPitch = clampPitch(pitchTo(from, to));
  };

  const finishWalk = () => {
    const R = rt.current;
    const w = R.walk;
    if (!w) return false;
    R.walk = null;
    const end = w.pts[w.pts.length - 1]!;
    R.pos.set(end[0], EYE, end[1]);
    R.at = w.goal;
    face(w.goal);
    arrive.current(w.goal);
    return true;
  };

  useLayoutEffect(() => {
    const R = rt.current;
    R.at = goal;
    const p = standPos(goal);
    R.pos.copy(p);
    face(goal);
    R.yaw = R.tYaw;
    R.pitch = R.tPitch;
    R.pos.copy(R.tPos);
    R.skipWalk = finishWalk;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const R = rt.current;
    R.skipWalk = finishWalk;
    if (R.walk && R.walk.goal === goal) return;
    if (R.walk) finishWalk();
    if (goal === R.at) {
      arrive.current(goal);
      return;
    }
    const pts = path(R.at, goal);
    // Start from where the camera is (it may be at a close-up work pose).
    pts[0] = [R.pos.x, R.pos.z];
    const dur = reduceMotion() ? 0 : walkSeconds(pts);
    R.walk = { pts, t0: now(), dur, goal };
    if (dur === 0) finishWalk();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  // The close-up camera follows the action phases.
  const lastPhase = useRef<Phase>('none');
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const R = rt.current;
    const ph = R.run?.phase ?? 'none';
    if (ph !== lastPhase.current) {
      if (ph === 'approach') face(R.run!.run.station, true);
      if (ph === 'none' && lastPhase.current !== 'none') face(R.at);
      lastPhase.current = ph;
    }
    const w = R.walk;
    if (w) {
      const t = (now() - w.t0) / w.dur;
      if (t >= 1) finishWalk();
      else {
        const e = ease(t);
        const p = pointAt(w.pts, e);
        const ahead = pointAt(w.pts, Math.min(1, e + 0.08));
        const total = w.pts.length > 1 ? Math.hypot(ahead[0] - p[0], ahead[1] - p[1]) : 0;
        if (total > 0.05) R.tYaw = R.yaw + angleDelta(R.yaw, yawTo(p, ahead));
        R.tPitch = -0.06;
        const bob = reduceMotion() ? 0 : Math.sin(t * w.dur * 9) * 0.035;
        R.pos.set(p[0], EYE + bob, p[1]);
        R.yaw += angleDelta(R.yaw, R.tYaw) * (1 - Math.exp(-dt * 5));
        R.pitch += (R.tPitch - R.pitch) * (1 - Math.exp(-dt * 4));
      }
    } else {
      R.pos.lerp(R.tPos, 1 - Math.exp(-dt * 4));
      R.yaw += angleDelta(R.yaw, R.tYaw) * (1 - Math.exp(-dt * 6));
      R.pitch += (R.tPitch - R.pitch) * (1 - Math.exp(-dt * 6));
    }
    camera.position.copy(R.pos);
    camera.rotation.set(R.pitch, R.yaw, 0, 'YXZ');
  });
  return null;
}

// ------------------------------------------------------------------ action driver

const DO_SECONDS: Record<ActionKind, number> = { wipe: 3.4, patch: 2.4, replace: 2.8, switch: 1.4, plug: 1.8, dig: 2.6, console: 1.8, wait: 1.8 };
const AUTO_AFTER = 5;
const FINISH_SECONDS = 1.5;

function RunDriver({ rt, setPhase, bar, onDone }: { rt: MutableRefObject<RT>; setPhase: (p: Phase) => void; bar: MutableRefObject<HTMLDivElement | null>; onDone: (id: number) => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const autoT = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const R = rt.current;
    const r = R.run;
    if (!r) return;
    const t = now();
    const go = (p: Phase) => {
      r.phase = p;
      r.t0 = t;
      setPhase(p);
    };
    if (r.phase === 'wait' && !R.walk && R.at === r.run.station) {
      if (r.run.station === 'solar') R.refill();
      R.brushOn = false;
      go('approach');
    } else if (r.phase === 'approach' && t - r.t0 > (reduceMotion() ? 0.1 : 0.7)) {
      r.lastInput = t;
      autoT.current = 0;
      go('do');
    } else if (r.phase === 'do') {
      const k = r.run.kind;
      const wipeHere = k === 'wipe' && r.run.station === 'solar';
      if (r.mode === 'hand' && t - r.lastInput > AUTO_AFTER) r.mode = 'auto';
      if (k === 'wait') r.mode = 'auto';
      if (wipeHere) {
        if (r.mode === 'auto') {
          // The astronaut brushes in rows across the panel.
          autoT.current += dt / DO_SECONDS.wipe;
          const s = Math.min(1, autoT.current);
          const rows = 4;
          const row = Math.min(rows - 1, Math.floor(s * rows));
          const f = s * rows - row;
          const u = 0.08 + 0.84 * (row % 2 ? 1 - f : f);
          const v = 1 - (row + 0.5) / rows;
          R.erase(u, v);
          if (s >= 1) r.p = 1;
        }
        r.p = Math.max(r.p, Math.min(1, R.cleared / 0.85));
        if (R.brushOn && Math.random() < 0.6) R.puff(R.brush, 1);
      } else {
        const speed = r.mode === 'auto' ? 1 / DO_SECONDS[k] : r.holding ? 1.25 / DO_SECONDS[k] : 0;
        r.p = Math.min(1, r.p + dt * speed);
      }
      if (r.p >= 1) go('finish');
    } else if (r.phase === 'finish' && t - r.t0 > FINISH_SECONDS) {
      const id = r.run.id;
      R.run = null;
      R.brushOn = false;
      if (r.run.to.solarDust > 0) R.refill();
      setPhase('none');
      done.current(id);
    }
    if (bar.current) bar.current.style.width = `${Math.round(r.p * 100)}%`;
  });
  return null;
}

// ------------------------------------------------------------------ labels overlay

function Overlay({ rt, labels, arrow, target, stations }: { rt: MutableRefObject<RT>; labels: MutableRefObject<Record<string, HTMLDivElement | null>>; arrow: MutableRefObject<HTMLDivElement | null>; target: string | null; stations: StationInfo[] }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const R = rt.current;
    let targetOff: { x: number; y: number } | null = null;
    for (const s of stations) {
      const el = labels.current[s.id];
      const spot = SPOTS[s.id];
      if (!spot) continue;
      v.set(...spot.label);
      const d = v.distanceTo(camera.position);
      v.project(camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const onScreen = !behind && x > 10 && x < size.width - 10 && y > 10 && y < size.height - 10;
      const hide = !onScreen || (R.at === s.id && !R.walk && d < 3.2) || !!R.run;
      if (el) {
        el.style.display = hide ? 'none' : '';
        if (!hide) {
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${Math.max(0.75, Math.min(1, 9 / d))})`;
          el.style.opacity = d > 40 ? '0.85' : '1';
        }
      }
      if (s.id === target && !onScreen && !(R.at === s.id)) {
        // Direction from screen centre (flip if behind the camera).
        let dx = v.x;
        let dy = -v.y;
        if (behind) {
          dx = -dx;
          dy = -dy;
        }
        targetOff = { x: dx, y: dy };
      }
    }
    const a = arrow.current;
    if (a) {
      if (!targetOff || R.run || R.walk) a.style.display = 'none';
      else {
        const ang = Math.atan2(targetOff.y, targetOff.x);
        const cx = size.width / 2;
        const cy = size.height / 2;
        const k = Math.min((cx - 44) / Math.abs(Math.cos(ang) || 1e-6), (cy - 44) / Math.abs(Math.sin(ang) || 1e-6));
        a.style.display = '';
        a.style.transform = `translate(${cx + Math.cos(ang) * k}px, ${cy + Math.sin(ang) * k}px) translate(-50%, -50%)`;
        const icon = a.firstElementChild as HTMLElement | null;
        if (icon) icon.style.transform = `rotate(${ang}rad)`;
      }
    }
  });
  return null;
}

function ContextWatch({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}

// ------------------------------------------------------------------ component

const KIND_ICON: Record<ActionKind, string> = { wipe: '🧹', patch: '🩹', replace: '🔩', switch: '🎚', plug: '🔌', dig: '⛏', console: '⌨', wait: '⏳' };

export default function FirstPerson(props: FirstPersonProps) {
  const { stations, goal, look, work, run, target, onPick, onArrive, onRunDone, onLost, coach, dock, hint } = props;
  const rt = useRef<RT>({
    pos: new THREE.Vector3(0, EYE, 0),
    yaw: 0,
    pitch: 0,
    tPos: new THREE.Vector3(0, EYE, 0),
    tYaw: 0,
    tPitch: 0,
    walk: null,
    at: goal,
    run: null,
    brush: new THREE.Vector3(),
    brushOn: false,
    fieldDust: work.solarDust,
    puff: () => {},
    cleared: 0,
    refill: () => {},
    erase: () => {},
    skipWalk: () => false,
  });
  const [phase, setPhase] = useState<Phase>('none');
  const [auto, setAuto] = useState(false);
  const bar = useRef<HTMLDivElement | null>(null);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const arrow = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastSkip = useRef(0);

  // A new action to act out.
  useEffect(() => {
    if (!run) return;
    const R = rt.current;
    if (R.run?.run.id === run.id) return;
    R.run = { run, phase: 'wait', t0: now(), p: 0, mode: run.kind === 'wait' ? 'auto' : 'hand', holding: false, lastInput: now() };
    setAuto(run.kind === 'wait');
    setPhase('wait');
  }, [run]);

  const skipRun = () => {
    const R = rt.current;
    const r = R.run;
    if (!r) return;
    const id = r.run.id;
    R.run = null;
    R.brushOn = false;
    R.fieldDust = r.run.to.solarDust;
    R.refill();
    setPhase('none');
    onRunDone(id);
  };
  const setHold = (on: boolean) => {
    const r = rt.current.run;
    if (!r) return;
    r.holding = on;
    r.lastInput = now();
    if (on) r.mode = 'hand';
  };
  const autoRun = () => {
    const r = rt.current.run;
    if (!r) return;
    r.mode = 'auto';
    setAuto(true);
  };

  const skipWalk = () => {
    if (rt.current.walk && rt.current.skipWalk()) {
      lastSkip.current = performance.now();
      return true;
    }
    return false;
  };
  const pick = (id: string) => {
    if (skipWalk()) return;
    if (performance.now() - lastSkip.current < 350) return;
    if (rt.current.run) return;
    onPick(id);
  };

  // Look around: drag (mouse or finger). A short tap is a click, not a drag.
  const onDown = (e: React.PointerEvent) => {
    if (skipWalk()) return;
    if (rt.current.run) {
      // Pressing anywhere on the view counts as holding for the hold-type actions.
      // (Wiping: a press anywhere starts the stroke, so it may begin off the panel.)
      if (rt.current.run.phase === 'do') setHold(true);
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      d.x = e.clientX;
      d.y = e.clientY;
      const R = rt.current;
      R.yaw += dx * 0.0042;
      R.tYaw = R.yaw;
      R.pitch = clampPitch(R.pitch + dy * 0.0042);
      R.tPitch = R.pitch;
    };
    const up = () => {
      drag.current = null;
      const r = rt.current.run;
      if (r) r.holding = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Keyboard during an action: Enter = let it do itself, Space (hold) = do it, Esc = skip.
  useEffect(() => {
    if (phase === 'none') return;
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipRun();
      else if (e.key === 'Enter') autoRun();
      else if (e.key === ' ') {
        e.preventDefault();
        setHold(true);
      }
    };
    const ku = (e: KeyboardEvent) => e.key === ' ' && setHold(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** Walls and ground: a click there stops (things behind a wall are not picked). */
  const block = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();
  const hit = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      pick(id);
    },
  });

  const r = run;
  const kind = r?.kind ?? null;
  const wipeHere = kind === 'wipe' && r?.station === 'solar';
  const hintText = kind ? (wipeHere ? tr.act.hintWipe : kind === 'wait' ? tr.act.hintWait : tr.act.hint[kind]) : '';

  return (
    <section className={`fp ${look.storm ? 'storm' : ''} ${look.night ? 'night' : ''}`} aria-label={tr.ui.stations}>
      <div className="fp-canvas" onPointerDown={onDown}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'default', alpha: false }}
          camera={{ fov: 70, near: 0.05, far: 600, position: [0, EYE, 0] }}
        >
          <ContextWatch onLost={onLost} />
          <Sky look={look} />
          <Lights look={look} />
          <Dust look={look} />
          <group onClick={block}>
            <Ground />
            <Rocks />
            <HabWall rt={rt} look={look} />
          </group>
          <group {...hit('hub')}>
            <HubRack rt={rt} work={work} />
          </group>
          <Roof />
          <group {...hit('battery')}>
            <BatteryRack rt={rt} work={work} power={look.lights} />
          </group>
          <group {...hit('shelter')}>
            <ShelterHatch rt={rt} work={work} />
            <ShelterMound look={look} />
          </group>
          <group {...hit('airlock')}>
            <AirlockTunnel rt={rt} work={work} />
          </group>
          <group {...hit('greenhouse')}>
            <Greenhouse rt={rt} work={work} look={look} />
          </group>
          <group {...hit('solar')}>
            <SolarField rt={rt} dustLevel={work.solarDust} />
            <Lamp station="solar" rt={rt} work={work} at={[panelAt(PANEL_ROWS - 1, 0)[0] - 1.25, 0.85, panelAt(PANEL_ROWS - 1, 0)[2] + 0.4]} />
          </group>
          <Rover />
          <group {...hit('landing')}>
            <Landing locked={!!stations.find((s) => s.id === 'landing')?.locked} />
          </group>
          <Puffs rt={rt} />
          <Hand rt={rt} />
          <Eyes rt={rt} goal={goal} onArrive={onArrive} />
          <RunDriver rt={rt} setPhase={setPhase} bar={bar} onDone={onRunDone} />
          <Overlay rt={rt} labels={labels} arrow={arrow} target={target} stations={stations} />
        </Canvas>
        <div className="fp-visor" aria-hidden />
        {stations.map((s) => (
          <div key={s.id} ref={(el) => void (labels.current[s.id] = el)} className={`fp-label ${s.faults ? 'has-fault' : ''} ${s.locked ? 'locked' : ''}`} onClick={() => pick(s.id)} aria-hidden style={{ display: 'none' }}>
            <span className="fp-name">
              {s.locked && '🔒 '}
              {(tr.stationShort[s.id] as string | undefined) ?? tr.stations[s.id]!.name}
            </span>
            {s.faults > 0 ? <span className="fp-fault">⚠ {s.faults}</span> : s.routine && s.routine.ok && !s.locked ? <span className="fp-routine">🔧</span> : <span className="fp-ok">✓</span>}
          </div>
        ))}
        {target && (
          <div ref={arrow} className="fp-arrow" aria-hidden style={{ display: 'none' }}>
            <span className="fp-arrow-icon">➤</span>
            <span className="fp-arrow-name">{(tr.stationShort[target] as string | undefined) ?? tr.stations[target]!.name}</span>
          </div>
        )}
        {coach && <div className="fp-coach">{coach}</div>}
        {hint && phase === 'none' && (
          <p className="fp-hint small" aria-hidden>
            {tr.act.lookHint}
          </p>
        )}
        {r && phase !== 'none' && (
          <div className={`fp-run ${phase}`} role="status">
            <div className="fp-run-title">
              <span aria-hidden>{KIND_ICON[r.kind]}</span> <strong>{r.label}</strong>
            </div>
            {phase === 'finish' ? (
              <p className="fp-run-done">
                ✓ {tr.act.done} <span className="chip-cost">⏱ −{fmtHours(r.hours)}</span>
              </p>
            ) : phase === 'do' ? (
              <>
                <p className="fp-run-hint">{auto ? tr.act.autoDoing : hintText}</p>
                <div className="fp-progress" aria-hidden>
                  <div ref={bar} />
                </div>
                <div className="row wrap fp-run-btns">
                  {!wipeHere && kind !== 'wait' && !auto && (
                    <button
                      className="btn primary"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setHold(true);
                      }}
                      onPointerUp={() => setHold(false)}
                      onPointerLeave={() => setHold(false)}
                    >
                      ✋ {tr.act.hold}
                    </button>
                  )}
                  {!auto && kind !== 'wait' && (
                    <button className="btn" onClick={autoRun}>
                      ▶ {tr.act.auto}
                    </button>
                  )}
                  <button className="btn ghost" onClick={skipRun}>
                    ⏭ {tr.act.skip}
                  </button>
                </div>
              </>
            ) : (
              <div className="row wrap fp-run-btns">
                <p className="fp-run-hint">{tr.act.going}</p>
                <button className="btn ghost" onClick={skipRun}>
                  ⏭ {tr.act.skip}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="fp-dock">{dock}</div>
      </div>
      {/* Station buttons: visible strip, also the keyboard way to move. */}
      <ul className="fp-stations" aria-label={tr.ui.stationList}>
        {stations.map((s) => (
          <li key={s.id}>
            <button className={`fp-st ${s.faults ? 'has-fault' : ''} ${s.id === target ? 'target' : ''}`} onClick={() => pick(s.id)} disabled={phase !== 'none'}>
              {s.faults > 0 ? '⚠ ' : s.locked ? '🔒 ' : ''}
              {(tr.stationShort[s.id] as string | undefined) ?? tr.stations[s.id]!.name}
              <span className="sr-only">
                {s.here && ` · 📍 ${tr.ui.location}`}
                {s.faults > 0 && ` · ⚠ ${s.faults} ${tr.ui.problems}`}
                {s.routine && s.routine.ok && ` · 🔧 ${fmt(tr.ui.routineBadge, { h: fmtHours(s.routine.hours) })}`}
                {s.locked && ` · 🔒 ${tr.ui.locked}`}
                {!s.here && ` · 👟 ${fmtHours(s.walk)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
