// Landing pad far outside (EVA): rocks on the pad until cleared (Sol 13), marker poles
// (Sol 13 quick option), reflector sheets (Sol 15 creative option) and the beacon mast,
// whose light shows the Sol 15 beacon choice. Locked (grey, barrier) before Sol 13 and in storms.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex, colors } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { Lamp, Model, powerGlow, RBox, seg, stationAct, type StationProps } from '../core';
import { groundHeight, LANDING_AT, type V3 } from '../world';
import { canvasTexture, hash1, lerp } from './s2-util';

const PAD_R = 5;
/** Pad top: just above the highest ground under it (the ground is bumpy out here). */
const PAD_TOP = (() => {
  let m = 0;
  for (let i = 0; i < 160; i++) {
    const a = i * 2.39996;
    const r = Math.sqrt(i / 160) * (PAD_R + 0.4);
    m = Math.max(m, groundHeight(LANDING_AT[0] + Math.cos(a) * r, LANDING_AT[1] + Math.sin(a) * r));
  }
  return m + 0.08;
})();
const MAST: V3 = [PAD_R + 0.7, 0, 0];

/** Direction of the astronaut's work spot seen from the pad centre (rocks there go first). */
const NEAR_A = Math.atan2(-1, -1);

// Rocks on the pad: [x, z, size]. Pushed off radially when the pad is cleared.
const ROCKS: [number, number, number][] = [
  [-1.2, -1.0, 0.36],
  [-0.3, -1.7, 0.28],
  [-2.1, -0.3, 0.3],
  [0.8, -0.6, 0.24],
  [-0.8, 0.6, 0.3],
  [-2.7, -2.3, 0.26],
  [2.4, -1.8, 0.32],
  [1.6, 1.4, 0.4],
  [-1.8, 2.2, 0.25],
  [0.4, 2.7, 0.33],
];
const ROCK_OUT = ROCKS.map(([x, z], i) => {
  const a = Math.atan2(z, x);
  const r = PAD_R + 0.55 + hash1(i + 5) * 0.6;
  return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
});

/** Angles ordered so the ones nearest the astronaut come first. */
function nearFirst(n: number, offset: number): number[] {
  const out = Array.from({ length: n }, (_, i) => offset + (i * Math.PI * 2) / n);
  const d = (a: number) => Math.abs(Math.atan2(Math.sin(a - NEAR_A), Math.cos(a - NEAR_A)));
  return out.sort((a, b) => d(a) - d(b));
}
const MARKERS = nearFirst(8, Math.PI / 8);
const MARK_R = PAD_R + 0.3;
const REFLECTORS = nearFirst(6, 0.3);
const REFL_R = 2.6;

interface View {
  locked: boolean;
  clear: boolean;
  marked: boolean;
  reflectors: boolean;
  beacon: 'off' | 'dim' | 'full';
}

function viewOf(w: WorkLook): View {
  const b = w.chosen.s15_beacon;
  return {
    locked: w.sol < 13 || w.storm,
    clear: !!w.flags.padClear,
    marked: !!w.flags.padMarked,
    reflectors: b === 'reflectors',
    beacon: b === 'fullBeacon' ? 'full' : b === 'dimBeacon' ? 'dim' : 'off',
  };
}

function stripeTexture() {
  return canvasTexture(64, 8, (g) => {
    g.fillStyle = '#20263a';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = colors.warn;
    for (let x = -8; x < 64; x += 16) {
      g.beginPath();
      g.moveTo(x, 8);
      g.lineTo(x + 8, 0);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 8, 8);
      g.fill();
    }
  });
}

const tmpO = new THREE.Object3D();

export default function LandingStation({ rt, work }: StationProps) {
  const tex = useMemo(() => ({ stripes: stripeTexture() }), []);
  const geo = useMemo(() => {
    const light = new THREE.SphereGeometry(0.08, 10, 8);
    light.translate(0, 1.25, 0);
    const pole = new THREE.CylinderGeometry(0.035, 0.045, 1.25, 6);
    pole.translate(0, 0.62, 0);
    return { rock: new THREE.DodecahedronGeometry(1, 0), pole, light };
  }, []);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const lightMat = useRef<THREE.MeshStandardMaterial>(null);
  const sheets = useRef<(THREE.Mesh | null)[]>([]);
  const sheetMat = useMemo(() => new THREE.MeshStandardMaterial({ color: colorHex.hull, metalness: 0.9, roughness: 0.15, emissive: colorHex.accent, emissiveIntensity: 0.15 }), []);
  const rake = useRef<THREE.Group>(null);
  const padMat = useRef<THREE.MeshLambertMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const barrier = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const cache = useRef({ rocks: -1, marks: -1 });
  const col = useMemo(() => ({ pad: new THREE.Color(colorHex.hullDark), padLocked: new THREE.Color(colorHex.grey), ring: new THREE.Color(colorHex.warn), ringLocked: new THREE.Color(colorHex.grey) }), []);

  useLayoutEffect(() => {
    const m = rocks.current;
    if (!m) return;
    const a = new THREE.Color(colorHex.marsBrown);
    const b = new THREE.Color(colorHex.marsRose);
    const c = new THREE.Color();
    ROCKS.forEach((_, i) => m.setColorAt(i, c.copy(a).lerp(b, hash1(i + 30))));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = stationAct(rt.current, 'landing');
    const shown = viewOf(a && a.before ? a.from : work);
    let clearP = shown.clear ? 1 : 0;
    let markP = shown.marked ? 1 : 0;
    let reflP = shown.reflectors ? 1 : 0;
    let flash = 0;
    let digging = -1;
    if (a && a.phase !== 'wait') {
      const p = a.p;
      if (a.phase === 'finish') flash = Math.max(0, 1 - a.t / 1.2);
      if (a.faultId === 's13_pad' && a.optionId === 'clearPad') {
        clearP = p;
        if (a.phase === 'do') digging = Math.min(ROCKS.length - 1, Math.floor(p * ROCKS.length));
      } else if (a.faultId === 's13_pad' && a.optionId === 'markPad') markP = p;
      else if (a.faultId === 's15_beacon' && a.optionId === 'reflectors') reflP = p;
    }

    // Rocks: pushed off the pad one by one (they stay at the edge).
    const m = rocks.current;
    if (m && (cache.current.rocks !== clearP || (clearP > 0 && clearP < 1))) {
      cache.current.rocks = clearP;
      ROCKS.forEach(([x, z, s], i) => {
        const k = seg(clearP * ROCKS.length - i, 0, 1);
        const [ox, oz] = ROCK_OUT[i]!;
        tmpO.position.set(lerp(x, ox, k), PAD_TOP + s * 0.55 - (k > 0.98 ? s * 0.15 : 0), lerp(z, oz, k));
        tmpO.rotation.set(hash1(i) * 3 + k * 4, hash1(i + 9) * 3, k * 2);
        tmpO.scale.set(s, s * 0.75, s * 1.1);
        tmpO.updateMatrix();
        m.setMatrixAt(i, tmpO.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    if (rake.current) {
      rake.current.visible = digging >= 0;
      if (digging >= 0) {
        const i = digging;
        const [x, z, s] = ROCKS[i]!;
        const [ox, oz] = ROCK_OUT[i]!;
        const k = seg(clearP * ROCKS.length - i, 0, 1);
        const dir = Math.atan2(oz - z, ox - x);
        const back = 0.35 + s;
        rake.current.position.set(lerp(x, ox, k) - Math.cos(dir) * back, PAD_TOP, lerp(z, oz, k) - Math.sin(dir) * back);
        rake.current.rotation.set(0, -dir, 0);
      }
    }

    // Marker poles: planted one by one, lights on when the row is done.
    const marksMove = cache.current.marks !== markP;
    for (const im of [poles.current, lights.current]) {
      if (!im || !marksMove) continue;
      const n = markP * MARKERS.length;
      MARKERS.forEach((ang, i) => {
        const k = seg(n - i, 0, 1);
        tmpO.position.set(Math.cos(ang) * MARK_R, PAD_TOP - 0.1 + (1 - k) * 1.4, Math.sin(ang) * MARK_R);
        tmpO.rotation.set(0, 0, (1 - k) * 0.3);
        tmpO.scale.setScalar(k > 0.001 ? 1 : 0.0001);
        tmpO.updateMatrix();
        im.setMatrixAt(i, tmpO.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    }
    cache.current.marks = markP;
    if (lightMat.current) {
      const on = markP >= 1 ? 1 : 0;
      const blink = (t * 0.8) % 1 < 0.5 ? 1 : 0.35;
      lightMat.current.emissiveIntensity = on * (1.4 * blink + flash * 2) + 0.05;
    }

    // Reflector sheets: unfolded on the pad, glinting now and then.
    sheets.current.forEach((sm, i) => {
      if (!sm) return;
      const k = seg(reflP * REFLECTORS.length - i, 0, 1);
      sm.visible = k > 0.001;
      sm.scale.set(0.2 + 0.8 * k, 1, 0.15 + 0.85 * k);
    });
    const g = Math.pow(Math.max(0, Math.sin(t * 1.7)), 12);
    sheetMat.emissiveIntensity = 0.15 + g * 1.6 + flash * 1.2;

    // Pad look: grey with a barrier while locked.
    const locked = shown.locked;
    if (padMat.current) padMat.current.color.copy(locked ? col.padLocked : col.pad);
    if (ringMat.current) ringMat.current.color.copy(locked ? col.ringLocked : col.ring);
    if (barrier.current) barrier.current.visible = locked;

    // Beacon: bright (full power), dim, or off.
    const b = beacon.current;
    if (b) {
      const period = shown.beacon === 'full' ? 0.9 : 2.2;
      const on = (t % period) / period < 0.2;
      b.color.setHex(shown.beacon === 'off' ? colorHex.grey : colorHex.accent);
      b.emissiveIntensity = shown.beacon === 'full' ? (on ? 4 : 0.8) : shown.beacon === 'dim' ? (on ? 1.1 : 0.25) : 0;
    }
    if (halo.current) {
      halo.current.visible = shown.beacon === 'full';
      halo.current.scale.setScalar(1 + 0.6 * Math.sin(t * 7));
    }
  });

  const [x, z] = LANDING_AT;
  const glow = powerGlow(work.power);
  // Barrier across the approach from the astronaut's side.
  const ba = NEAR_A;
  const bR = PAD_R + 1.0;
  return (
    <group position={[x, 0, z]}>
      {/* Pad slab and markings. */}
      <mesh position={[0, PAD_TOP - 0.25, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[PAD_R, PAD_R + 0.15, 0.5, 40]} />
        <meshLambertMaterial ref={padMat} color={colorHex.hullDark} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PAD_TOP + 0.005, 0]} raycast={() => null}>
        <ringGeometry args={[3.8, 4.25, 40]} />
        <meshBasicMaterial ref={ringMat} color={colorHex.warn} />
      </mesh>
      {[Math.PI / 4, -Math.PI / 4].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, r]} position={[0, PAD_TOP + 0.006, 0]} raycast={() => null}>
          <planeGeometry args={[4.4, 0.45]} />
          <meshBasicMaterial color={colors.text} />
        </mesh>
      ))}

      {/* Rocks (instanced) and the push board used to clear them. */}
      <instancedMesh ref={rocks} args={[geo.rock, undefined, ROCKS.length]} castShadow receiveShadow>
        <meshStandardMaterial color={0xffffff} roughness={1} flatShading />
      </instancedMesh>
      <group ref={rake} visible={false}>
        <RBox size={[0.08, 0.3, 0.9]} r={0.02} position={[0, 0.15, 0]} color={colorHex.metal} />
        <mesh position={[-0.45, 0.55, 0]} rotation={[0, 0, 0.9]}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
          <meshStandardMaterial color={colorHex.hullDark} />
        </mesh>
      </group>

      {/* Marker poles with lights. */}
      <instancedMesh ref={poles} args={[geo.pole, undefined, MARKERS.length]} castShadow>
        <meshStandardMaterial color={colorHex.warn} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[geo.light, undefined, MARKERS.length]}>
        <meshStandardMaterial ref={lightMat} color={colorHex.accent} emissive={colorHex.accent} emissiveIntensity={0.05} />
      </instancedMesh>

      {/* Reflector sheets. */}
      {REFLECTORS.map((ang, i) => (
        <mesh
          key={i}
          ref={(m) => void (sheets.current[i] = m)}
          position={[Math.cos(ang) * REFL_R, PAD_TOP + 0.03, Math.sin(ang) * REFL_R]}
          rotation={[0, -ang + Math.PI / 2, (hash1(i) - 0.5) * 0.12]}
          visible={false}
          raycast={() => null}
          material={sheetMat}
        >
          <boxGeometry args={[1.1, 0.02, 0.8]} />
        </mesh>
      ))}

      {/* Beacon mast and its transmitter. */}
      <group position={MAST}>
        <mesh position={[0, 1.6, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, 3.2, 8]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        <mesh position={[0, 3.3, 0]}>
          <sphereGeometry args={[0.14, 14, 10]} />
          <meshStandardMaterial ref={beacon} color={colorHex.grey} emissive={colorHex.accent} emissiveIntensity={0} />
        </mesh>
        <mesh ref={halo} position={[0, 3.3, 0]} visible={false} raycast={() => null}>
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshBasicMaterial color={colorHex.accent} transparent opacity={0.18} depthWrite={false} />
        </mesh>
        <Model name="machine_wireless" position={[0.2, PAD_TOP - 0.1, 0.9]} scale={1.2} fallback={<RBox size={[0.6, 0.8, 0.5]} position={[0.2, 0.4, 0.9]} color={colorHex.hull} />} />
        <mesh position={[-0.12, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.16, 0.1]} />
          <meshStandardMaterial color={0x123a44} emissive={colorHex.accent} emissiveIntensity={0.6 * glow} />
        </mesh>
      </group>

      {/* Pad control post with the status lamp, next to the work spot. */}
      <group position={[-4.3, 0, -3.4]}>
        <RBox size={[0.25, 1.0, 0.25]} position={[0, 0.5, 0]} color={colorHex.hull} />
        <Lamp station="landing" rt={rt} work={work} at={[0, 1.08, 0]} />
      </group>

      {/* Barrier while the pad is locked (before Sol 13, or in a storm). */}
      <group ref={barrier} position={[Math.cos(ba) * bR, 0, Math.sin(ba) * bR]} rotation={[0, -ba + Math.PI / 2, 0]}>
        {[-1.3, 1.3].map((px) => (
          <mesh key={px} position={[px, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 1.0, 6]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[2.8, 0.14, 0.06]} />
          <meshBasicMaterial map={tex.stripes} color={0xffffff} />
        </mesh>
      </group>
    </group>
  );
}

