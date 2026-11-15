// Airlock: tunnel from the hab (x = HAB_R) to the outer door (x ~ AIRLOCK_OUT - 0.2).
// The outer bulkhead holds the door with its seal gasket (Sol 1), a storage compartment
// that can spring a leak (Sol 13), a pressure gauge, the outdoor cable socket (Sol 8) and a
// cable hook. Water containers can be stacked in the corner (Sol 12).
//
// Bulkhead parts are placed in a local frame BH: u = world z, v = world y - TUBE_Y,
// d = distance in front of the bulkhead towards the hab (world x = BULK_X - d).
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { colorHex, colors } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { Fountain, Lamp, Model, powerGlow, RBox, rbox, seg, stationAct, type StationProps } from '../core';
import { AIRLOCK_OUT, EYE, HAB_R, type V3 } from '../world';
import { canvasTexture, clamp01, hash1, lerp, type Slot } from './s2-util';

const TUBE_R = 1.5;
const TUBE_Y = 1.4;
const FLOOR = 0.08;
const BULK_X = AIRLOCK_OUT[0] - 0.2;
const DOOR_W = 1.1;
const DOOR_V0 = FLOOR - TUBE_Y; // door bottom (BH v)
const DOOR_V1 = 2.0 - TUBE_Y; // door top
const DOOR_VC = (DOOR_V0 + DOOR_V1) / 2;
const DOOR_H = DOOR_V1 - DOOR_V0;
const BULK_D = 0.12;

/** Storage compartment (left of the door) and its leak hole. */
const COMP: V3 = [-1.0, -0.35, BULK_D];
const HOLE: V3 = [-0.95, -0.28, BULK_D + 0.15];
/** Pressure gauge, cable socket and hook (right of the door). */
const GAUGE: V3 = [1.0, 0.15, BULK_D + 0.03];
const SOCKET: V3 = [0.95, -1.02, BULK_D + 0.03];
const HOOK: V3 = [1.05, -0.38, BULK_D + 0.05];

const bh = (p: V3): V3 => [BULK_X - p[2], TUBE_Y + p[1], p[0]];

// ------------------------------------------------------------------ what the airlock shows

interface View {
  /** Seal: 'old' (dusty, cracked), 'wiped' (grey, a bit dusty), 'new' (light green). */
  seal: 'old' | 'wiped' | 'new';
  sealLeak: boolean;
  /** Storage compartment leak: none, open (steam), patched, taped, sealed off. */
  leak: 'none' | 'open' | 'kit' | 'tea' | 'sealed';
  leakAge: number;
  smallLeak: boolean;
  cablesIn: boolean;
  water: boolean;
}

function viewOf(w: WorkLook): View {
  const s1 = w.chosen.s1_seal;
  const sealOpen = w.open.includes('s1_seal');
  const seal = sealOpen || !s1 || s1 === 'defer' ? 'old' : s1 === 'newSeal' ? 'new' : 'wiped';
  const lc = w.chosen.s13_leakA;
  const leak: View['leak'] = w.open.includes('s13_leakA') ? 'open' : lc === 'patchKit' ? 'kit' : lc === 'teaLeaves' ? 'tea' : lc === 'sealOff' ? 'sealed' : 'none';
  return {
    seal,
    sealLeak: sealOpen,
    leak,
    leakAge: w.age.s13_leakA ?? 0,
    smallLeak: lc === 'sealOff' && w.mods.some((m) => /leakSmall/.test(m)),
    cablesIn: w.chosen.s8_secure === 'cables',
    water: w.chosen.s12_spe === 'waterCorner',
  };
}

/** Pressure loss shown by the gauge, 0..1. */
const pressureLoss = (v: View) => Math.max(v.sealLeak ? 0.45 : 0, v.leak === 'open' ? Math.min(1, 0.7 + v.leakAge * 0.1) : 0, v.smallLeak ? 0.2 : 0);

/** Water containers: three deep, two high, along the left wall near the outer door. */
const JUG_SLOTS: Slot[] = (() => {
  const out: Slot[] = [];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 3; i++) {
      // Slots are on a ring around the local origin; the group sits in the corner, so r=0.
      out.push({ phi: -Math.PI / 2, r: 0, y: 0.23 + row * 0.47, yaw: (hash1(i + row * 3) - 0.5) * 0.1, s: 1 });
    }
  return out;
})();
const JUG_X = [11.68, 11.33, 10.98];

// ------------------------------------------------------------------ textures

function gaugeTexture() {
  return canvasTexture(64, 64, (g) => {
    g.fillStyle = '#f3f5fa';
    g.beginPath();
    g.arc(32, 32, 31, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = colors.danger;
    g.beginPath();
    g.arc(32, 32, 22, Math.PI * 0.75, Math.PI * 1.2);
    g.stroke();
    g.strokeStyle = colors.warn;
    g.beginPath();
    g.arc(32, 32, 22, Math.PI * 1.2, Math.PI * 1.6);
    g.stroke();
    g.strokeStyle = colors.ok;
    g.beginPath();
    g.arc(32, 32, 22, Math.PI * 1.6, Math.PI * 2.25);
    g.stroke();
    g.strokeStyle = '#1d2745';
    g.lineWidth = 2;
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
      g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
      g.stroke();
    }
  });
}

// ------------------------------------------------------------------ the station

export default function Airlock({ rt, work }: StationProps) {
  const tex = useMemo(() => ({ gauge: gaugeTexture() }), []);
  const bulkGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, TUBE_R + 0.02, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    const x0 = -DOOR_W / 2;
    const x1 = DOOR_W / 2;
    const r = 0.12;
    hole.moveTo(x0, DOOR_V0);
    hole.lineTo(x1, DOOR_V0);
    hole.lineTo(x1, DOOR_V1 - r);
    hole.quadraticCurveTo(x1, DOOR_V1, x1 - r, DOOR_V1);
    hole.lineTo(x0 + r, DOOR_V1);
    hole.quadraticCurveTo(x0, DOOR_V1, x0, DOOR_V1 - r);
    hole.lineTo(x0, DOOR_V0);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: BULK_D, bevelEnabled: false, curveSegments: 20 });
  }, []);
  const leafGeo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3)), []);

  const door = useRef<THREE.Group>(null);
  const doorOpen = useRef(0);
  const doorCentre = useMemo(() => new THREE.Vector3(BULK_X, EYE, 0), []);
  // Seal.
  const oldStrips = useRef<(THREE.Mesh | null)[]>([]);
  const newStrips = useRef<(THREE.Mesh | null)[]>([]);
  const cracks = useRef<THREE.Group>(null);
  const cloth = useRef<THREE.Mesh>(null);
  // Gauge.
  const needle = useRef<THREE.Group>(null);
  // Leak.
  const holeRef = useRef<THREE.Mesh>(null);
  const patch = useRef<THREE.Group>(null);
  const tape = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.Points>(null);
  const hatch = useRef<THREE.Group>(null);
  const lockBar = useRef<THREE.Mesh>(null);
  const lockDot = useRef<THREE.Mesh>(null);
  // Cables.
  const plug = useRef<THREE.Mesh>(null);
  const cableA = useRef<THREE.Mesh>(null);
  const cableB = useRef<THREE.Mesh>(null);
  const coil = useRef<THREE.Group>(null);
  // Water corner.
  const jugs = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const fx = useRef({ steam: 0, puff: 0, loss: 0 });
  const mats = useMemo(
    () => ({
      old: new THREE.MeshStandardMaterial({ color: colors.bg, roughness: 0.95 }),
      fresh: new THREE.MeshStandardMaterial({ color: colorHex.ok, emissive: colorHex.ok, emissiveIntensity: 0.15, roughness: 0.5 }),
      dust: new THREE.MeshStandardMaterial({ color: colorHex.marsDust, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false }),
    }),
    [],
  );
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), green: new THREE.Color(colorHex.ok), grey: new THREE.Color(colorHex.grey), dark: new THREE.Color(colors.bg), white: new THREE.Color(0xffffff) }), []);

  const capGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10);
    g.translate(0, 0.25, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    // Jugs sit in a row along the wall: put each at its own x (slots only carry y here).
    for (const m of [jugs.current, caps.current]) {
      if (!m) continue;
      const o = new THREE.Object3D();
      JUG_SLOTS.forEach((s, i) => {
        o.position.set(JUG_X[i % 3]! - JUG_X[0]!, s.y, 0);
        o.rotation.set(0, s.yaw, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }, []);
  /** Shows `c` jugs (fractional: the last one is being stacked). */
  const jugCount = (m: THREE.InstancedMesh | null, c: number) => {
    if (!m) return;
    if (m.userData.c === c && c === Math.floor(c)) return;
    m.userData.c = c;
    const n = Math.floor(c);
    m.count = c > n + 0.001 ? n + 1 : n;
    if (m.count > n) {
      // The one being stacked comes down from above.
      const s = JUG_SLOTS[n]!;
      const e = seg(c - n, 0, 1);
      tmpO.position.set(JUG_X[n % 3]! - JUG_X[0]!, s.y + (1 - e) * 0.5, (1 - e) * 0.35);
      tmpO.rotation.set(0, s.yaw, 0);
      tmpO.updateMatrix();
      m.setMatrixAt(n, tmpO.matrix);
    }
    if (n > 0) {
      const s = JUG_SLOTS[n - 1]!;
      tmpO.position.set(JUG_X[(n - 1) % 3]! - JUG_X[0]!, s.y, 0);
      tmpO.rotation.set(0, s.yaw, 0);
      tmpO.updateMatrix();
      m.setMatrixAt(n - 1, tmpO.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const R = rt.current;
    const a = stationAct(R, 'airlock');
    const shown = viewOf(a && a.before ? a.from : work);
    const glow = powerGlow(work.power);

    // Outer door: opens when someone walks through, stays shut while a job runs here.
    const busy = !!R.run && R.run.run.station === 'airlock' && R.run.phase !== 'none';
    const near = !busy && R.pos.distanceTo(doorCentre) < 3.0 ? 1 : 0;
    doorOpen.current += (near - doorOpen.current) * (1 - Math.exp(-dt * 5));
    if (door.current) door.current.position.x = -doorOpen.current * DOOR_W * 0.85;

    // ---- seal
    let oldOut = shown.seal === 'old' || shown.seal === 'wiped' ? 0 : 1; // 1 = old strips gone
    let newIn = shown.seal === 'new' ? 1 : 0;
    let dust = shown.seal === 'old' ? 1 : shown.seal === 'wiped' ? 0.28 : 0;
    let wiped = shown.seal === 'wiped' ? 1 : 0;
    let clothOn = false;
    let flash = 0;
    // ---- leak
    let steam = shown.leak === 'open' ? Math.min(1.6, 0.8 + shown.leakAge * 0.4) : 0;
    let patchIn = shown.leak === 'kit' ? 1 : 0;
    let tapeIn = shown.leak === 'tea' ? 1 : 0;
    let leafT = shown.leak === 'tea' ? 1 : -1;
    let hatchShut = shown.leak === 'sealed' ? 1 : 0;
    let locked = shown.leak === 'sealed' ? 1 : 0;
    let holeOn = shown.leak !== 'none';
    // ---- cables / water
    let unplug = shown.cablesIn ? 1 : 0;
    let coilIn = shown.cablesIn ? 1 : 0;
    let water = shown.water ? JUG_SLOTS.length : 0;
    let loss = pressureLoss(shown);

    if (a && a.phase !== 'wait') {
      const p = a.p;
      const to = viewOf(a.to);
      if (a.phase === 'finish') flash = Math.max(0, 1 - a.t / 1.2);
      if (a.faultId === 's1_seal' && a.optionId === 'newSeal') {
        oldOut = seg(p, 0.0, 0.42);
        newIn = seg(p, 0.45, 0.92);
        dust = 1 - seg(p, 0.05, 0.4);
      } else if (a.faultId === 's1_seal' && a.optionId === 'wipe') {
        dust = lerp(1, 0.28, seg(p, 0.05, 0.95));
        wiped = seg(p, 0.1, 1);
        clothOn = a.phase === 'do';
        if (clothOn && cloth.current) {
          // Cloth runs up the left strip, along the top and down the right one, twice.
          const s = (p * 2) % 1;
          let u: number, v: number;
          if (s < 0.36) {
            u = -0.6;
            v = lerp(DOOR_V0 + 0.2, DOOR_V1, s / 0.36);
          } else if (s < 0.64) {
            u = lerp(-0.6, 0.6, (s - 0.36) / 0.28);
            v = DOOR_V1 + 0.05;
          } else {
            u = 0.6;
            v = lerp(DOOR_V1, DOOR_V0 + 0.2, (s - 0.64) / 0.36);
          }
          cloth.current.position.set(u, v, BULK_D + 0.1);
          cloth.current.rotation.z = Math.sin(t * 14) * 0.25;
          cloth.current.getWorldPosition(R.brush);
          R.brushOn = true;
          if (hash1(Math.floor(t * 20)) < 0.25) R.puff(R.brush, 1);
        }
      } else if (a.faultId === 's13_leakA') {
        const s0 = steam;
        if (a.optionId === 'patchKit') {
          patchIn = seg(p, 0.1, 0.7);
          steam = s0 * (1 - seg(p, 0.4, 0.7));
        } else if (a.optionId === 'teaLeaves') {
          leafT = seg(p, 0, 0.5);
          tapeIn = seg(p, 0.5, 0.9);
          steam = s0 * (1 - seg(p, 0.55, 0.85));
        } else if (a.optionId === 'sealOff') {
          hatchShut = seg(p, 0, 0.6);
          locked = seg(p, 0.6, 0.85);
          steam = s0 * (1 - seg(p, 0.3, 0.6));
        }
        holeOn = true;
        loss = lerp(pressureLoss(viewOf(a.from)), pressureLoss(to), seg(p, 0.3, 0.9));
      } else if (a.faultId === 's8_secure') {
        unplug = seg(p, 0, 0.55);
        coilIn = seg(p, 0.4, 0.95);
      } else if (a.faultId === 's12_spe') {
        water = lerp(0, JUG_SLOTS.length, p);
      }
      if (a.faultId === 's1_seal') loss = lerp(pressureLoss(viewOf(a.from)), pressureLoss(to), seg(p, 0.5, 1));
    }

    // Seal strips.
    oldStrips.current.forEach((m, i) => {
      if (!m) return;
      const k = clamp01(oldOut * 3 - i);
      m.visible = k < 0.999;
      // Peel: the strip curls towards the camera and drops.
      m.position.z = BULK_D + 0.03 + k * 0.35;
      m.position.y = STRIPS[i]![1] - k * k * 0.9;
      m.rotation.x = k * 1.1;
      m.rotation.z = k * (i === 1 ? -0.6 : 0.6);
    });
    newStrips.current.forEach((m, i) => {
      if (!m) return;
      const k = clamp01(newIn * 3 - i);
      m.visible = k > 0.001;
      m.position.z = BULK_D + 0.03 + (1 - k) * 0.4;
      m.scale.setScalar(0.9 + 0.1 * k);
    });
    mats.old.color.copy(tmp.dark).lerp(tmp.grey, wiped * 0.75);
    mats.fresh.emissiveIntensity = 0.15 + flash * 0.9;
    mats.dust.opacity = dust * 0.85 * (1 - oldOut);
    mats.dust.visible = dust > 0.01 && oldOut < 0.99;
    if (cracks.current) cracks.current.visible = oldOut < 0.3 && wiped < 0.6 && dust > 0.5;
    if (cloth.current) cloth.current.visible = clothOn;

    // Air puffs at the cracked seal (open problem), steam from the leak.
    const f = fx.current;
    f.puff = shown.sealLeak && oldOut < 0.3 && (t % 1.7) < 0.3 ? 1.2 : 0;
    f.steam = steam + (shown.smallLeak && hatchShut > 0.9 ? 0.12 : 0);
    f.loss += (loss - f.loss) * (1 - Math.exp(-dt * 3));
    if (needle.current) needle.current.rotation.z = lerp(-0.65, 1.55, f.loss) + Math.sin(t * 23) * 0.04 * f.loss;

    // Leak repair parts.
    if (holeRef.current) holeRef.current.visible = holeOn;
    if (patch.current) {
      patch.current.visible = patchIn > 0.001;
      patch.current.position.z = HOLE[2] + 0.005 + (1 - patchIn) * 0.35;
      patch.current.rotation.z = (1 - patchIn) * 1.5;
    }
    if (tape.current) {
      tape.current.visible = tapeIn > 0.001;
      tape.current.children.forEach((c, i) => (c.scale.x = clamp01(tapeIn * 2 - i)));
    }
    if (leaves.current) {
      leaves.current.visible = leafT >= 0;
      if (leafT >= 0) {
        const pos = leaves.current.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < 14; i++) {
          // Each leaf starts in front of the compartment and is pulled to the hole by the leak.
          const k = seg(leafT, i * 0.025, 0.65 + i * 0.025);
          const sx = HOLE[0] + (hash1(i) - 0.5) * 0.7;
          const sy = HOLE[1] + 0.15 + hash1(i + 20) * 0.35;
          const sz = HOLE[2] + 0.25 + hash1(i + 40) * 0.3;
          const ex = HOLE[0] + (hash1(i + 60) - 0.5) * 0.07;
          const ey = HOLE[1] + (hash1(i + 80) - 0.5) * 0.07;
          const wob = Math.sin(t * 5 + i) * 0.02 * (1 - k);
          pos.setXYZ(i, lerp(sx, ex, k) + wob, lerp(sy, ey, k) - Math.sin(Math.PI * k) * 0.08, lerp(sz, HOLE[2] + 0.01, k));
        }
        pos.needsUpdate = true;
      }
    }
    if (hatch.current) hatch.current.rotation.y = lerp(-1.6, 0, hatchShut);
    if (lockBar.current) lockBar.current.position.x = lerp(COMP[0] - 0.42, COMP[0] - 0.12, locked);
    if (lockDot.current) lockDot.current.visible = locked > 0.95;

    // Cables: plug pulled, cable drawn in, coil on the hook.
    if (plug.current) plug.current.position.z = SOCKET[2] + 0.06 + unplug * 0.3;
    if (cableA.current) {
      cableA.current.visible = unplug < 0.98;
      cableA.current.scale.y = Math.max(0.01, 1 - seg(unplug, 0.3, 0.9));
    }
    if (cableB.current) {
      cableB.current.visible = unplug < 0.98;
      cableB.current.scale.y = Math.max(0.01, 1 - seg(unplug, 0.2, 0.7));
    }
    if (coil.current) {
      coil.current.visible = coilIn > 0.001;
      coil.current.scale.setScalar(0.3 + 0.7 * coilIn);
      coil.current.rotation.z = (1 - coilIn) * 3;
    }

    // Water containers in the corner.
    jugCount(jugs.current, water);
    jugCount(caps.current, water);

    if (screenMat.current) screenMat.current.emissiveIntensity = (f.loss > 0.3 ? (Math.sin(t * 6) > 0 ? 1 : 0.4) : 0.7) * glow;
  });

  const len = BULK_X - HAB_R;
  const glow = powerGlow(work.power);
  return (
    <group>
      {/* Tunnel. */}
      <mesh position={[HAB_R + len / 2, TUBE_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[TUBE_R, TUBE_R, len, 22, 1, true]} />
        <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[HAB_R + len / 2, FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len, 1.42]} />
        <meshStandardMaterial color={colorHex.metal} roughness={0.9} />
      </mesh>
      {[0.25, 0.55, 0.85].map((k) => (
        <mesh key={k} position={[HAB_R + len * k, TUBE_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[TUBE_R - 0.03, 0.07, 6, 24]} />
          <meshStandardMaterial color={colorHex.hullDark} />
        </mesh>
      ))}
      <mesh position={[HAB_R + len / 2, TUBE_Y + TUBE_R - 0.1, 0]}>
        <boxGeometry args={[len * 0.8, 0.03, 0.14]} />
        <meshStandardMaterial color={0xeefcff} emissive={0xeefcff} emissiveIntensity={0.9 * glow} />
      </mesh>
      <pointLight position={[HAB_R + len * 0.6, 2.4, 0]} intensity={6 * Math.max(glow, 0.3)} distance={7.5} color={0xeefcff} />

      {/* Suit rack (left wall) and lockers (right wall). */}
      <group position={[7.7, 0, -0.95]}>
        <RBox size={[0.9, 0.06, 0.08]} position={[0, 2.05, 0]} color={colorHex.metal} />
        {[-0.22, 0.24].map((x) => (
          <group key={x} position={[x, 0, 0.08]}>
            <RBox size={[0.42, 0.75, 0.26]} r={0.1} position={[0, 1.35, 0]} color={colorHex.suit} />
            <RBox size={[0.36, 0.55, 0.2]} r={0.08} position={[0, 0.75, 0]} color={colorHex.suit} />
            <mesh position={[0, 1.88, 0]}>
              <sphereGeometry args={[0.17, 14, 10]} />
              <meshStandardMaterial color={colorHex.suit} roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[7.9, 0, 0.98]}>
        <RBox size={[1.3, 1.6, 0.26]} r={0.04} position={[0, 1.2, 0]} rotation={[0, Math.PI, 0]} color={colorHex.hullDark} />
        {[-0.33, 0.33].map((x) => (
          <mesh key={x} position={[x, 1.25, -0.135]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.04, 0.3]} />
            <meshBasicMaterial color={colorHex.accentDim} />
          </mesh>
        ))}
      </group>

      {/* Outer bulkhead (BH frame). */}
      <group position={[BULK_X, TUBE_Y, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={bulkGeo} castShadow receiveShadow>
          <meshStandardMaterial color={colorHex.hull} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        {/* Door panel (slides behind the bulkhead to the left). */}
        <group ref={door} position={[0, DOOR_VC, -0.05]}>
          <RBox size={[DOOR_W + 0.04, DOOR_H + 0.02, 0.07]} r={0.03} color={colorHex.metal} metal={0.4} rough={0.5} />
          <mesh position={[0, 0.45, 0.04]}>
            <circleGeometry args={[0.16, 18]} />
            <meshStandardMaterial color={0x9fd7ea} transparent opacity={0.55} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.45, -0.04]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.16, 18]} />
            <meshStandardMaterial color={0x9fd7ea} transparent opacity={0.55} roughness={0.1} />
          </mesh>
        </group>
        {/* Seal gasket: old strips, new strips, dust on the old ones, crack marks. */}
        {STRIPS.map((s, i) => (
          <mesh key={`o${i}`} ref={(m) => void (oldStrips.current[i] = m)} geometry={rbox(s[2], s[3], 0.06, 0.02)} position={[s[0], s[1], BULK_D + 0.03]} material={mats.old} />
        ))}
        {STRIPS.map((s, i) => (
          <mesh key={`n${i}`} ref={(m) => void (newStrips.current[i] = m)} geometry={rbox(s[2], s[3], 0.06, 0.02)} position={[s[0], s[1], BULK_D + 0.03]} visible={false} material={mats.fresh} />
        ))}
        {STRIPS.map((s, i) => (
          <mesh key={`d${i}`} position={[s[0], s[1], BULK_D + 0.065]} raycast={() => null} material={mats.dust}>
            <planeGeometry args={[s[2] + 0.02, s[3] + 0.02]} />
          </mesh>
        ))}
        <group ref={cracks}>
          {[
            [-0.6, -0.55, 0.5],
            [0.6, 0.05, -0.4],
            [0.15, DOOR_V1 + 0.05, 1.2],
          ].map(([u, v, r], i) => (
            <mesh key={i} position={[u!, v!, BULK_D + 0.07]} rotation={[0, 0, r!]} raycast={() => null}>
              <planeGeometry args={[0.025, 0.16]} />
              <meshBasicMaterial color={colorHex.skyHorizon} />
            </mesh>
          ))}
        </group>
        <mesh ref={cloth} visible={false} geometry={rbox(0.16, 0.12, 0.04, 0.02)}>
          <meshStandardMaterial color={colorHex.marsDust} roughness={1} />
        </mesh>

        {/* Pressure gauge. */}
        <group position={GAUGE}>
          <mesh>
            <circleGeometry args={[0.15, 24]} />
            <meshBasicMaterial map={tex.gauge} color={0xffffff} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.155, 0.018, 6, 24]} />
            <meshStandardMaterial color={colorHex.metal} metalness={0.5} />
          </mesh>
          <group ref={needle} position={[0, 0, 0.01]}>
            <mesh position={[0, 0.055, 0]}>
              <boxGeometry args={[0.012, 0.11, 0.006]} />
              <meshBasicMaterial color={colors.bg} />
            </mesh>
          </group>
        </group>
        {/* Small status screen above the gauge (blinks when pressure drops). */}
        <mesh position={[GAUGE[0], GAUGE[1] + 0.3, GAUGE[2]]}>
          <planeGeometry args={[0.3, 0.14]} />
          <meshStandardMaterial ref={screenMat} color={0x123a44} emissive={colorHex.accent} emissiveIntensity={0.7} />
        </mesh>

        {/* Storage compartment with its leak. */}
        <RBox size={[0.52, 0.82, 0.14]} r={0.03} position={[COMP[0], COMP[1], COMP[2] + 0.06]} color={colorHex.hullDark} />
        <mesh position={[COMP[0], COMP[1] - 0.2, COMP[2] + 0.135]}>
          <planeGeometry args={[0.4, 0.025]} />
          <meshBasicMaterial color={colorHex.metal} />
        </mesh>
        <mesh ref={holeRef} position={[HOLE[0], HOLE[1], HOLE[2] - 0.009]} visible={false}>
          <circleGeometry args={[0.035, 12]} />
          <meshBasicMaterial color={0x10131f} />
        </mesh>
        <group ref={patch} position={[HOLE[0], HOLE[1], HOLE[2]]} visible={false}>
          <mesh>
            <circleGeometry args={[0.1, 20]} />
            <meshStandardMaterial color={colorHex.hull} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.1, 0.012, 6, 20]} />
            <meshStandardMaterial color={colorHex.accentDim} />
          </mesh>
        </group>
        <group ref={tape} position={[HOLE[0], HOLE[1], HOLE[2] + 0.004]} visible={false}>
          {[0.6, -0.6].map((r) => (
            <mesh key={r} rotation={[0, 0, r]}>
              <planeGeometry args={[0.22, 0.06]} />
              <meshStandardMaterial color={colorHex.tape} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
        <points ref={leaves} geometry={leafGeo} visible={false} frustumCulled={false} raycast={() => null}>
          <pointsMaterial color={colorHex.marsBrown} size={0.03} />
        </points>
        {/* Hatch: hinged on the outer edge, open until the compartment is sealed off. */}
        <group ref={hatch} position={[COMP[0] - 0.26, COMP[1], COMP[2] + 0.15]}>
          <RBox size={[0.52, 0.82, 0.04]} r={0.02} position={[0.26, 0, 0.02]} color={colorHex.metal} metal={0.4} />
          <mesh position={[0.44, 0, 0.05]}>
            <boxGeometry args={[0.04, 0.18, 0.03]} />
            <meshStandardMaterial color={colorHex.warn} />
          </mesh>
        </group>
        <mesh ref={lockBar} position={[COMP[0] - 0.42, COMP[1] + 0.1, COMP[2] + 0.22]}>
          <boxGeometry args={[0.3, 0.05, 0.03]} />
          <meshStandardMaterial color={colorHex.warn} />
        </mesh>
        <mesh ref={lockDot} position={[COMP[0] + 0.15, COMP[1] + 0.3, COMP[2] + 0.23]} visible={false}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color={colorHex.ok} emissive={colorHex.ok} emissiveIntensity={1.2} />
        </mesh>

        {/* Outdoor cable socket, plug, cable to the door port, and the hook for the coil. */}
        <RBox size={[0.16, 0.16, 0.05]} r={0.02} position={SOCKET} color={colorHex.hullDark} />
        <mesh ref={plug} geometry={rbox(0.08, 0.08, 0.1, 0.02)} position={[SOCKET[0], SOCKET[1], SOCKET[2] + 0.06]}>
          <meshStandardMaterial color={colorHex.warn} />
        </mesh>
        <CableSeg refA={cableA} refB={cableB} />
        <RBox size={[0.06, 0.06, 0.1]} r={0.02} position={[HOOK[0], HOOK[1] + 0.2, HOOK[2]]} color={colorHex.metal} />
        <group ref={coil} position={HOOK} visible={false}>
          {[0, 0.035].map((z) => (
            <mesh key={z} position={[0, 0, z]}>
              <torusGeometry args={[0.14, 0.02, 6, 20]} />
              <meshStandardMaterial color={0x2a3048} roughness={0.8} />
            </mesh>
          ))}
        </group>
        <Lamp station="airlock" rt={rt} work={work} at={[0.78, DOOR_V1 + 0.25, BULK_D + 0.05]} />
      </group>

      {/* Water containers stacked in the left corner (Sol 12 creative option). */}
      <group position={[JUG_X[0]!, FLOOR, -0.78]}>
        <instancedMesh ref={jugs} args={[rbox(0.34, 0.44, 0.3, 0.07), undefined, JUG_SLOTS.length]}>
          <meshStandardMaterial color={colorHex.accent} roughness={0.25} transparent opacity={0.8} emissive={colorHex.accentDim} emissiveIntensity={0.15} />
        </instancedMesh>
        <instancedMesh ref={caps} args={[capGeo, undefined, JUG_SLOTS.length]}>
          <meshStandardMaterial color={colorHex.hull} />
        </instancedMesh>
      </group>

      {/* Outside, next to the door: supply barrels. */}
      <Model name="barrels" position={[12.9, 0, 1.9]} scale={1.4} fallback={<RBox size={[0.7, 0.5, 0.6]} position={[12.9, 0.25, 1.9]} color={colorHex.hullDark} />} />

      <Fountain at={bh([HOLE[0], HOLE[1], HOLE[2] + 0.03])} rate={() => fx.current.steam} color={0xe8f4f6} size={0.14} speed={0.45} spread={0.18} life={1.4} />
      <Fountain at={bh([-0.6, -0.55, BULK_D + 0.1])} rate={() => fx.current.puff} color={colorHex.marsDust} size={0.09} speed={0.3} spread={0.2} life={0.9} />
    </group>
  );
}

/** Seal strip layout in BH: [u, v, width, height] for left, right and top. */
const STRIPS: [number, number, number, number][] = [
  [-DOOR_W / 2 - 0.05, DOOR_VC, 0.09, DOOR_H],
  [DOOR_W / 2 + 0.05, DOOR_VC, 0.09, DOOR_H],
  [0, DOOR_V1 + 0.05, DOOR_W + 0.19, 0.09],
];

const tmpO = new THREE.Object3D();

/** Cable from the plug down to the floor and along it to the door port. Both pieces are
 *  anchored at the socket end, so scaling them down pulls the cable in. */
function CableSeg({ refA, refB }: { refA: RefObject<THREE.Mesh | null>; refB: RefObject<THREE.Mesh | null> }) {
  const down = SOCKET[1] - (DOOR_V0 + 0.03);
  const along = SOCKET[0] - (DOOR_W / 2 - 0.1);
  const geo = useMemo(() => {
    const a = new THREE.CylinderGeometry(0.018, 0.018, down, 6);
    a.translate(0, -down / 2, 0);
    const b = new THREE.CylinderGeometry(0.018, 0.018, along, 6);
    b.translate(0, along / 2, 0);
    return { a, b };
  }, [down, along]);
  return (
    <>
      <mesh ref={refA} geometry={geo.a} position={[SOCKET[0], SOCKET[1], SOCKET[2] + 0.08]}>
        <meshStandardMaterial color={0x2a3048} />
      </mesh>
      <mesh ref={refB} geometry={geo.b} position={[SOCKET[0], DOOR_V0 + 0.03, SOCKET[2] + 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color={0x2a3048} />
      </mesh>
    </>
  );
}
