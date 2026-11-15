// End-of-mission scene (lazy-loaded): a short scripted film shown once when the mission ends.
// Win: the supply lander lands on the pad, the camera walks up, the lander lifts off and the
// base shrinks below. Loss: the failing system is shown (lights out / alarm / helmet warning),
// then the emergency capsule lifts off with the astronaut. No game state is kept here: it only
// reads the final state for the look of the base. Never shows or mentions harm to the astronaut.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { engine, tr } from '../content';
import type { GameState } from '../sim/types';
import { colorHex } from '../ui/tokens';
import { ease, softDot, type RT } from './core';
import { Dust, Ground, Hills, Lights, Rocks, Sky, type Quality } from './env';
import { Hab, Roof, Yard } from './hab';
import { sceneLook, workLook, type SceneLook } from './look';
import LandingStation from './stations/Landing';
import { EYE, LANDING_AT, groundHeight, type V3 } from './world';

export type EndKind = 'win' | 'power' | 'life' | 'shield';

/** Length of each film in seconds (the UI also has a hard timeout above this). */
export const END_LENGTH: Record<EndKind, number> = { win: 10.5, power: 8.5, life: 8.5, shield: 8.5 };

const stationOf = (faultId: string) => engine.fault(faultId).station;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const outCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));

/** Top of the landing pad (same sampling as stations/Landing.tsx: highest ground under it). */
const PAD_Y = (() => {
  let m = 0;
  for (let i = 0; i < 160; i++) {
    const a = i * 2.39996;
    const r = Math.sqrt(i / 160) * 5.4;
    m = Math.max(m, groundHeight(LANDING_AT[0] + Math.cos(a) * r, LANDING_AT[1] + Math.sin(a) * r));
  }
  return m + 0.08;
})();
const PAD: V3 = [LANDING_AT[0], PAD_Y, LANDING_AT[1]];
const CAPSULE_XZ: [number, number] = [17, 11];
const CAPSULE: V3 = [CAPSULE_XZ[0], groundHeight(CAPSULE_XZ[0], CAPSULE_XZ[1]), CAPSULE_XZ[1]];
const HAB_LOOK = new THREE.Vector3(0, 2.2, 0);

function detectQuality(): Quality {
  try {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    return touch && Math.min(window.innerWidth, window.innerHeight) < 820 ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

/** A runtime stub so the shared base parts (doors etc.) can be reused far from the camera. */
function stubRT(): RT {
  return {
    pos: new THREE.Vector3(0, -100, 0),
    yaw: 0,
    pitch: 0,
    tPos: new THREE.Vector3(),
    tYaw: 0,
    tPitch: 0,
    walk: null,
    at: 'hub',
    run: null,
    brush: new THREE.Vector3(),
    brushOn: false,
    fieldDust: 0,
    puff: () => {},
    cleared: 0,
    refill: () => {},
    erase: () => {},
    skipWalk: () => false,
  };
}

// ------------------------------------------------------------------ craft

/** Exhaust: a cool cyan glow cone (never orange) and a light under the craft. */
function Thrust({ flame, len = 2.4, r = 0.55 }: { flame: MutableRefObject<number>; len?: number; r?: number }) {
  const cone = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const f = flame.current;
    const flick = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 40);
    if (cone.current) {
      cone.current.visible = f > 0.02;
      cone.current.scale.set(1, Math.max(0.01, f * flick), 1);
    }
    if (light.current) light.current.intensity = f * 30 * flick;
  });
  return (
    <group>
      {/* Base of the cone at the nozzle (origin), tip pointing down; scaled from the nozzle. */}
      <group ref={cone}>
        <mesh position={[0, -len / 2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[r, len, 14, 1, true]} />
          <meshBasicMaterial color={colorHex.accent} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, -1.2, 0]} color={colorHex.accent} distance={18} decay={1.6} intensity={0} />
    </group>
  );
}

/** The supply lander: octagonal body, cone top, four legs, blinking lights. Origin at the feet. */
function Lander({ flame }: { flame: MutableRefObject<number> }) {
  const lamps = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (lamps.current) lamps.current.emissiveIntensity = (clock.elapsedTime * 1.4) % 1 < 0.5 ? 2.2 : 0.3;
  });
  const legs = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);
  return (
    <group>
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.5, 1.7, 8]} />
        <meshStandardMaterial color={colorHex.hull} roughness={0.5} metalness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[1.52, 1.52, 0.2, 8]} />
        <meshStandardMaterial color={colorHex.accentDim} emissive={colorHex.accent} emissiveIntensity={0.4} flatShading />
      </mesh>
      <mesh position={[0, 3.35, 0]} castShadow>
        <cylinderGeometry args={[0.55, 1.4, 1.0, 8]} />
        <meshStandardMaterial color={colorHex.hullDark} roughness={0.6} metalness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 3.95, 0]}>
        <sphereGeometry args={[0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={colorHex.panelCell} roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.38, 0.65, 0.5, 12]} />
        <meshStandardMaterial color={colorHex.metal} metalness={0.7} roughness={0.35} />
      </mesh>
      {legs.map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <mesh position={[1.75, 0.65, 0]} rotation={[0, 0, 0.55]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 1.7, 6]} />
            <meshStandardMaterial color={colorHex.metal} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[2.2, 0.06, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.12, 10]} />
            <meshStandardMaterial color={colorHex.hullDark} />
          </mesh>
          <mesh position={[1.42, 2.3, 0]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial ref={i === 0 ? lamps : undefined} color={colorHex.warn} emissive={colorHex.warn} emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.7, 0]}>
        <Thrust flame={flame} len={3.2} r={0.62} />
      </group>
    </group>
  );
}

/** Emergency capsule: small rounded cone with a teal stripe and three legs. Origin at the feet. */
function Capsule({ flame }: { flame: MutableRefObject<number> }) {
  return (
    <group>
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.45, 1.0, 1.6, 14]} />
        <meshStandardMaterial color={colorHex.suit} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.86, 0.9, 0.22, 14]} />
        <meshStandardMaterial color={colorHex.accentDim} emissive={colorHex.accent} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow>
        <sphereGeometry args={[0.47, 14, 10]} />
        <meshStandardMaterial color={colorHex.hull} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.6, 0.62]} rotation={[-0.35, 0, 0]}>
        <circleGeometry args={[0.2, 14]} />
        <meshStandardMaterial color={colorHex.panelCell} emissive={colorHex.accent} emissiveIntensity={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <mesh position={[0.95, 0.3, 0]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.05, 0.05, 0.75, 6]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.5, 0]}>
        <Thrust flame={flame} len={2.2} r={0.45} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ dust cloud

const DUST_N = 260;
/** Ring of dust blown out from under a craft. `amount` 0..1, `age` seconds since it started. */
function DustCloud({ at, amount }: { at: V3; amount: MutableRefObject<{ k: number; age: number }> }) {
  const pts = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const seeds = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < DUST_N; i++) {
      const h = (n: number) => {
        const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };
      out.push([h(1) * Math.PI * 2, 2 + h(2) * 6, h(3)]);
    }
    return out;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3));
    return g;
  }, []);
  const tex = useMemo(softDot, []);
  useFrame(() => {
    const { k, age } = amount.current;
    if (mat.current) mat.current.opacity = 0.55 * k;
    if (!pts.current) return;
    pts.current.visible = k > 0.01;
    if (k <= 0.01) return;
    const arr = geo.attributes.position!.array as Float32Array;
    seeds.forEach(([a, v, r], i) => {
      const loop = (age * (0.35 + r * 0.3) + r) % 1;
      const d = 0.8 + loop * v;
      arr[i * 3] = Math.cos(a) * d;
      arr[i * 3 + 1] = 0.2 + loop * (0.6 + r * 1.6);
      arr[i * 3 + 2] = Math.sin(a) * d;
    });
    geo.attributes.position!.needsUpdate = true;
  });
  return (
    <points ref={pts} geometry={geo} position={at} frustumCulled={false}>
      <pointsMaterial ref={mat} map={tex} color={colorHex.marsDust} size={1.6} sizeAttenuation transparent depthWrite={false} opacity={0} />
    </points>
  );
}

/** Landing lights around the pad: warning-yellow and teal, chasing around the ring. */
function PadLights({ on }: { on: MutableRefObject<number> }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const N = 10;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mats.current.forEach((m, i) => {
      if (!m) return;
      const chase = Math.floor(t * 8) % N === i ? 1 : 0.25;
      m.emissiveIntensity = on.current * (0.3 + 2.4 * chase);
    });
  });
  return (
    <group position={PAD}>
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2;
        const c = i % 2 ? colorHex.accent : colorHex.warn;
        return (
          <mesh key={i} position={[Math.cos(a) * 4.6, 0.12, Math.sin(a) * 4.6]}>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial ref={(m) => void (mats.current[i] = m)} color={c} emissive={c} emissiveIntensity={0} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Red-magenta alarm light pulsing over the base (life support loss). */
function AlarmLight({ on }: { on: MutableRefObject<number> }) {
  const l = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const p = on.current * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 7));
    if (l.current) l.current.intensity = p * 120;
    if (bulb.current) bulb.current.emissiveIntensity = 0.2 + p * 3;
  });
  return (
    <group position={[6.6, 3.4, 0]}>
      <pointLight ref={l} color={colorHex.danger} distance={30} decay={1.4} intensity={0} />
      <mesh>
        <sphereGeometry args={[0.28, 12, 8]} />
        <meshStandardMaterial ref={bulb} color={colorHex.danger} emissive={colorHex.danger} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ director

interface Rig {
  craft: MutableRefObject<THREE.Group | null>;
  flame: MutableRefObject<number>;
  dust: MutableRefObject<{ k: number; age: number }>;
  pad: MutableRefObject<number>;
  alarm: MutableRefObject<number>;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerpV = (a: THREE.Vector3, b: THREE.Vector3, k: number, out: THREE.Vector3) => out.copy(a).lerp(b, clamp01(k));

/** Moves the camera and the craft along a fixed script; reports the caption step and the end. */
function Director({ kind, rig, onStep, onEnd }: { kind: EndKind; rig: Rig; onStep: (n: number) => void; onEnd: () => void }) {
  const { camera } = useThree();
  const t0 = useRef<number | null>(null);
  const step = useRef(-1);
  const ended = useRef(false);
  const tmp = useMemo(() => ({ pos: v(0, 0, 0), look: v(0, 0, 0), a: v(0, 0, 0), b: v(0, 0, 0), craft: v(0, 0, 0) }), []);
  const steps = kind === 'win' ? [0, 4.2, 6.6] : [0, 3.4, 5.6];

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    let n = 0;
    steps.forEach((s, i) => void (t >= s && (n = i)));
    if (n !== step.current) {
      step.current = n;
      onStep(n);
    }
    if (!ended.current && t >= END_LENGTH[kind]) {
      ended.current = true;
      onEnd();
    }
    const { pos, look, craft } = tmp;
    const g = rig.craft.current;

    if (kind === 'win') {
      // Lander: falls in slowing down (0-4.2 s), sits, lifts off at 6.8 s.
      const down = outCubic(t / 4.2);
      let y = PAD[1] + 46 * (1 - down);
      if (t > 6.8) y = PAD[1] + 3.2 * (t - 6.8) * (t - 6.8) + 1.2 * (t - 6.8);
      craft.set(PAD[0], y, PAD[2]);
      g?.position.copy(craft);
      const h = y - PAD[1];
      rig.flame.current = t < 4.3 ? 0.4 + 0.6 * clamp01(1 - h / 30) : t > 6.4 ? clamp01((t - 6.4) * 2) : 0;
      const near = clamp01(1 - h / 10) * rig.flame.current;
      rig.dust.current.k += (near - rig.dust.current.k) * 0.08;
      rig.dust.current.age = t;
      rig.pad.current = t < 7.5 ? 1 : clamp01(1 - (t - 7.5));
      // Camera: watch the descent from the yard, walk to the pad, then ride up with the lander.
      const start = v(13, EYE + 0.6, 7);
      const walkEnd = v(21.5, EYE + 0.2, 14.5);
      const walk = span(t, 4.4, 6.6);
      lerpV(start, walkEnd, walk, pos);
      pos.y += groundHeight(pos.x, pos.z) + Math.sin(walk * Math.PI * 7) * 0.05 * (walk > 0 && walk < 1 ? 1 : 0);
      look.set(craft.x, craft.y + 2, craft.z);
      if (t > 7.2) {
        const ride = span(t, 7.2, 9.0);
        tmp.a.set(craft.x - 7, craft.y + 9, craft.z - 6);
        lerpV(pos.clone(), tmp.a, ride, pos);
        tmp.b.set(HAB_LOOK.x, 0, HAB_LOOK.z);
        lerpV(look.clone(), tmp.b, span(t, 7.6, 9.6), look);
      }
    } else {
      // Loss: look at the base while the system fails, then turn to the capsule and watch it lift off.
      const lift = t > 5.0 ? 2.6 * (t - 5.0) * (t - 5.0) : 0;
      craft.set(CAPSULE[0], CAPSULE[1] + lift, CAPSULE[2]);
      g?.position.copy(craft);
      rig.flame.current = t > 4.6 ? clamp01((t - 4.6) * 2) : 0;
      rig.dust.current.k += ((t > 4.6 && lift < 8 ? 1 : 0) - rig.dust.current.k) * 0.08;
      rig.dust.current.age = t;
      rig.alarm.current = kind === 'life' ? clamp01(t * 2) * (1 - span(t, 6.5, 8)) : 0;
      lerpV(v(21, 2.4, 1), v(23.5, 2.0, 4.5), span(t, 0, 8), pos);
      pos.y += groundHeight(pos.x, pos.z);
      lerpV(HAB_LOOK, tmp.b.set(craft.x, craft.y + 1.6, craft.z), span(t, 3.0, 4.4), look);
    }
    camera.position.copy(pos);
    camera.lookAt(look);
  });
  return null;
}

/** How the base looks in each film. Power loss: lit for a moment, then dark. */
function filmLook(kind: EndKind, base: SceneLook, dark: boolean): SceneLook {
  const calm = { ...base, storm: false, solarEvent: false, night: false };
  if (kind === 'power') return dark ? { ...calm, night: true, lights: 'off' } : { ...calm, lights: 'on' };
  if (kind === 'shield') return { ...calm, solarEvent: true };
  return { ...calm, lights: 'on' };
}

// ------------------------------------------------------------------ the film

export default function Ending({ s, kind, onEnd }: { s: GameState; kind: EndKind; onEnd: () => void }) {
  const quality = useMemo(detectQuality, []);
  const rt = useRef<RT>(stubRT());
  const base = useMemo(() => ({ ...sceneLook(s), lights: 'on' as const }), [s]);
  const work = useMemo(() => workLook(s, stationOf), [s]);
  const [step, setStep] = useState(0);
  const rig: Rig = {
    craft: useRef<THREE.Group | null>(null),
    flame: useRef(0),
    dust: useRef({ k: 0, age: 0 }),
    pad: useRef(1),
    alarm: useRef(0),
  };
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (kind !== 'power') return;
    const id = window.setTimeout(() => setDark(true), 1200);
    return () => window.clearTimeout(id);
  }, [kind]);
  const shown = useMemo(() => filmLook(kind, base, dark), [kind, base, dark]);

  const e = tr.ending;
  const lines =
    kind === 'win' ? [e.win1, e.win2, e.win3] : [kind === 'power' ? e.power1 : kind === 'life' ? e.life1 : e.shield1, e.rescue1, e.rescue2];
  const title = kind === 'win' ? e.winTitle : e.lostTitle;

  return (
    <div className={`end-film end-${kind}`}>
      <Canvas
        shadows={quality === 'high' ? { type: THREE.PCFShadowMap } : false}
        dpr={quality === 'high' ? [1, 1.5] : [1, 1.25]}
        gl={{ antialias: true, powerPreference: 'default', alpha: false }}
        camera={{ fov: 60, near: 0.1, far: 800, position: [13, EYE, 7] }}
      >
        <Sky look={shown} />
        <Lights look={shown} quality={quality} />
        <Dust look={shown} quality={quality} />
        <Ground />
        <Hills />
        <Rocks quality={quality} />
        <Hab rt={rt} look={shown} />
        <Roof />
        <Yard />
        <LandingStation rt={rt} work={work} look={shown} />
        <group ref={rig.craft}>{kind === 'win' ? <Lander flame={rig.flame} /> : <Capsule flame={rig.flame} />}</group>
        <DustCloud at={kind === 'win' ? PAD : CAPSULE} amount={rig.dust} />
        {kind === 'win' && <PadLights on={rig.pad} />}
        {kind === 'life' && <AlarmLight on={rig.alarm} />}
        <Director kind={kind} rig={rig} onStep={setStep} onEnd={onEnd} />
      </Canvas>
      {kind === 'shield' && step === 0 && (
        <div className="end-hud" role="alert">
          <span aria-hidden>☢</span> {e.hudWarn}
        </div>
      )}
      {kind === 'life' && step <= 1 && (
        <div className="end-alarm" role="alert">
          <span>⚠ {e.alarm}</span>
        </div>
      )}
      {kind === 'shield' && <div className="end-visor" aria-hidden />}
      <div className="end-caption" aria-live="polite">
        <strong>{title}</strong>
        <span key={step}>{lines[step]}</span>
      </div>
      <div className="end-fade" style={{ animationDelay: `${END_LENGTH[kind] - 0.7}s` }} aria-hidden />
    </div>
  );
}
