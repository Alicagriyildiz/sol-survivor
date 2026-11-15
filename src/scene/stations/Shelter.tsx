// Shelter: a buried, cramped round room south-west of the hab, reached by a short tunnel
// from the hab door at SHELTER_DEG. Outside it is a regolith mound with a periscope.
// Inside, the outer wall is where the shielding is built (bags of regolith or water
// containers), with a heater panel, a periscope screen and a dose meter above it.
//
// Everything is built in a local frame: origin at SHELTER_AT, +x pointing away from the hab
// (along the SHELTER_DEG ray), so the tunnel runs along -x and the outer wall is at +x.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex, colors } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { Lamp, Model, powerGlow, RBox, rbox, seg, softDot, stationAct, type StationProps } from '../core';
import { HAB_R, SHELTER_AT, SHELTER_DEG, SHELTER_DIST, SHELTER_H, SHELTER_R, wallPoint, type V3 } from '../world';
import { canvasTexture, centreOut, clamp01, hash1, initSlots, lerp, routineCount, showSlots, type Slot } from './s2-util';

const R = SHELTER_R;
const H = SHELTER_H;
const FLOOR = 0.08;
/** Tunnel: from the hab wall to the room, along -x. */
const T_START = -(SHELTER_DIST - HAB_R) - 0.05;
const T_END = -R + 0.1;
const T_R = 1.3;
const T_Y = 1.05;
/** Bulkhead between tunnel and room (it shows the wall thickness at the doorway). */
const BULK_X = -R + 0.15;
/** Main mound (half-ellipsoid) and the tunnel berm. */
const MOUND: V3 = [3.6, 3.3, 3.6];
const MOUND_GAP = 0.4;
const MOUND_CAP = Math.acos(2.45 / MOUND[1]);
const BERM_R = 2.3;
const BERM_Y = 0.3;
/** Band of panels above the shield wall (heater, periscope screen, dose meter). */
const BAND_Y = 1.62;
const BAND_R = R - 0.06;
const PHI_HEATER = -0.44;
const PHI_SCREEN = 0;
const PHI_METER = 0.44;

// ------------------------------------------------------------------ what the shelter shows

interface View {
  reinforced: boolean;
  water: boolean;
  bags: number;
  jugs: number;
  /** 0 none, ~0.35 thin wall (problem open), 1 cracked (deferred). */
  crack: number;
  heaterOff: boolean;
  /** Dose meter reading 0..1. */
  dose: number;
}

/** Dose fraction that reaches the astronaut for each sol 12 choice (content/scenario.ts speHit). */
function doseOf(w: WorkLook): number {
  const c = w.chosen.s12_spe;
  if (!c || w.sol < 12) return 0.06;
  const k = w.flags.shelterReinforced ? 0 : w.flags.shelterWater ? 1 : 2;
  if (c === 'hideAll') return [0.1, 0.2, 0.3][k]!;
  if (c === 'hideShort') return [0.25, 0.35, 0.5][k]!;
  if (c === 'waterCorner') return 0.45;
  return 0.8;
}

function viewOf(w: WorkLook): View {
  const reinforced = !!w.flags.shelterReinforced;
  const water = !!w.flags.shelterWater;
  const bags = Math.min(BAG_SLOTS.length, (reinforced ? MAIN_BAGS : 0) + 4 * routineCount(w, 'bags'));
  const crack = reinforced || water ? 0 : w.chosen.s6_shelter === 'defer' ? 1 : w.open.includes('s6_shelter') ? 0.35 : 0;
  return { reinforced, water, bags, jugs: water ? JUG_SLOTS.length : 0, crack, heaterOff: w.chosen.s9_shed === 'shelterHeat', dose: doseOf(w) };
}

// ------------------------------------------------------------------ instance slots (local frame)

const MAIN_ROWS = 4;
const ROW_N = 9;
const MAIN_BAGS = MAIN_ROWS * ROW_N;
const BAG_H = 0.3;

/** Regolith bags: 4 rows along the outer wall (Sol 6), then two low rows in front (extra bag jobs). */
const BAG_SLOTS: Slot[] = (() => {
  const out: Slot[] = [];
  for (let row = 0; row < MAIN_ROWS; row++)
    for (const i of centreOut(ROW_N)) {
      const k = out.length;
      out.push({ phi: -0.92 + i * 0.23 + (row % 2 ? 0.1 : 0), r: R - 0.27, y: FLOOR + BAG_H / 2 + row * BAG_H, yaw: (hash1(k) - 0.5) * 0.12, s: 0.96 + hash1(k + 50) * 0.08 });
    }
  for (let row = 0; row < 2; row++)
    for (const i of centreOut(7)) {
      const k = out.length;
      out.push({ phi: -0.69 + i * 0.23 + (row % 2 ? 0.1 : 0), r: R - 0.74, y: FLOOR + BAG_H / 2 + row * BAG_H, yaw: (hash1(k) - 0.5) * 0.16, s: 0.95 + hash1(k + 50) * 0.08 });
    }
  return out;
})();

/** Water containers: two rows of eight along the outer wall. */
const JUG_SLOTS: Slot[] = (() => {
  const out: Slot[] = [];
  for (let row = 0; row < 2; row++)
    for (const i of centreOut(8)) out.push({ phi: -0.8 + i * 0.2286, r: R - 0.25, y: FLOOR + 0.25 + row * 0.52, yaw: (hash1(out.length + 9) - 0.5) * 0.06, s: 1 });
  return out;
})();

/** Bags around the mound outside when the wall is reinforced (not on the tunnel side). */
const RING_SLOTS: Slot[] = (() => {
  const out: Slot[] = [];
  const n = 14;
  for (const i of centreOut(n)) {
    const phi = 0.62 + (i / (n - 1)) * (Math.PI * 2 - 1.24);
    out.push({ phi, r: MOUND[0] + 0.15, y: 0.15, yaw: (hash1(i + 70) - 0.5) * 0.3, s: 1.15 });
  }
  return out;
})();

// ------------------------------------------------------------------ textures (drawn once)

function frostTexture() {
  return canvasTexture(256, 128, (g) => {
    g.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 140; i++) {
      const x = hash1(i) * 256;
      const y = 128 - Math.pow(hash1(i + 300), 1.6) * 128;
      const len = 4 + hash1(i + 600) * 14;
      g.strokeStyle = `rgba(240,250,255,${0.35 + hash1(i + 900) * 0.5})`;
      g.lineWidth = 1 + hash1(i + 1200) * 1.5;
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3 + hash1(i + 1500);
        g.beginPath();
        g.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(230,244,250,0.05)');
    grd.addColorStop(1, 'rgba(230,244,250,0.45)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
  });
}

/** Crack path (dark) or its glow (white, soft) on a transparent canvas. */
function crackTexture(glow: boolean) {
  return canvasTexture(64, 128, (g) => {
    g.clearRect(0, 0, 64, 128);
    const pts: [number, number][] = [];
    let x = 30;
    for (let y = 4; y <= 124; y += 12) {
      pts.push([x, y]);
      x = 32 + (hash1(y) - 0.5) * 26;
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const line = (w: number, style: string) => {
      g.strokeStyle = style;
      g.lineWidth = w;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.stroke();
      // Two side branches.
      g.beginPath();
      g.moveTo(pts[3]![0], pts[3]![1]);
      g.lineTo(pts[3]![0] + 14, pts[3]![1] + 10);
      g.moveTo(pts[7]![0], pts[7]![1]);
      g.lineTo(pts[7]![0] - 12, pts[7]![1] + 12);
      g.stroke();
    };
    if (glow) {
      g.filter = 'blur(4px)';
      line(10, 'rgba(255,255,255,0.9)');
      g.filter = 'none';
      line(2, 'rgba(255,255,255,1)');
    } else line(3, 'rgba(20,22,34,1)');
  });
}

/** Periscope picture: sky gradient over a ground strip (tinted per frame by the material color). */
function skyTexture() {
  return canvasTexture(64, 32, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 32);
    grd.addColorStop(0, '#c8c8d0');
    grd.addColorStop(0.65, '#ffffff');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 32);
    g.fillStyle = colors.marsBrown;
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(0, 24);
    g.lineTo(14, 21);
    g.lineTo(30, 24);
    g.lineTo(46, 20);
    g.lineTo(64, 23);
    g.lineTo(64, 32);
    g.fill();
  });
}

/** Particle shimmer for the periscope screen (scrolled every frame). */
function shimmerTexture() {
  return canvasTexture(
    64,
    64,
    (g) => {
      g.clearRect(0, 0, 64, 64);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,255,255,${0.4 + hash1(i + 40) * 0.6})`;
        const s = 1 + Math.floor(hash1(i + 80) * 2);
        g.fillRect(Math.floor(hash1(i) * 64), Math.floor(hash1(i + 20) * 64), s, s);
      }
    },
    true,
  );
}

/** Dose meter face: track with tick marks and a small trefoil sign (state is the bar length, not only color). */
function meterTexture() {
  return canvasTexture(128, 64, (g) => {
    g.fillStyle = '#151d36';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#bcc5da';
    g.lineWidth = 2;
    g.strokeRect(30, 26, 92, 18);
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(30 + i * 23, 44);
      g.lineTo(30 + i * 23, 52);
      g.stroke();
    }
    // Trefoil.
    g.fillStyle = colors.warn;
    g.beginPath();
    g.arc(15, 35, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#151d36';
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      g.beginPath();
      g.moveTo(15, 35);
      g.arc(15, 35, 9, a - 0.5, a + 0.5);
      g.fill();
    }
    g.fillStyle = colors.warn;
    g.beginPath();
    g.arc(15, 35, 2.5, 0, Math.PI * 2);
    g.fill();
  });
}

function grilleTexture() {
  return canvasTexture(64, 32, (g) => {
    g.fillStyle = '#20263a';
    g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) g.fillRect(4 + i * 8.5, 4, 4, 24);
  });
}

// ------------------------------------------------------------------ geometry helpers

/** Patch of the inner wall (cylinder segment) between angles phi0..phi1 (local frame), seen from inside. */
function wallPatch(r: number, h: number, phi0: number, phi1: number) {
  return new THREE.CylinderGeometry(r, r, h, 14, 1, true, Math.PI / 2 - phi1, phi1 - phi0);
}

/** Group transform that places a flat panel on the round wall at angle phi, facing the centre. */
const onWall = (phi: number, r: number, y: number) => ({
  position: [Math.cos(phi) * r, y, Math.sin(phi) * r] as V3,
  rotation: [0, -phi - Math.PI / 2, 0] as V3,
});

// ------------------------------------------------------------------ particles reaching inside (SPE)

function Sparks({ rate, crack }: { rate: () => number; crack: () => number }) {
  const N = 60;
  const ref = useRef<THREE.Points>(null);
  const st = useMemo(() => ({ pos: new Float32Array(N * 3).fill(-999), vel: new Float32Array(N * 3), age: new Float32Array(N).fill(99), acc: 0, k: 0 }), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    st.acc += rate() * dt;
    const fromCrack = crack();
    let alive = false;
    while (st.acc >= 1) {
      st.acc -= 1;
      const i = st.k++ % N;
      const u = hash1(st.k);
      const v = hash1(st.k + 999);
      const atCrack = fromCrack > 0.5 && hash1(st.k + 333) < 0.6;
      const phi = atCrack ? (u - 0.5) * 0.08 : (u - 0.5) * 1.8;
      const y = atCrack ? 0.35 + v * 0.95 : 0.25 + v * 1.9;
      const r = R - 0.08;
      st.pos[i * 3] = Math.cos(phi) * r;
      st.pos[i * 3 + 1] = y;
      st.pos[i * 3 + 2] = Math.sin(phi) * r;
      const sp = 0.7 + hash1(st.k + 77) * 0.6;
      st.vel[i * 3] = -Math.cos(phi) * sp;
      st.vel[i * 3 + 1] = (hash1(st.k + 55) - 0.5) * 0.3;
      st.vel[i * 3 + 2] = -Math.sin(phi) * sp + (hash1(st.k + 66) - 0.5) * 0.4;
      st.age[i] = 0;
    }
    for (let i = 0; i < N; i++) {
      if (st.age[i]! > 1.6) {
        st.pos[i * 3 + 1] = -999;
        continue;
      }
      alive = true;
      st.age[i]! += dt;
      for (let k = 0; k < 3; k++) st.pos[i * 3 + k]! += st.vel[i * 3 + k]! * dt;
    }
    if (ref.current) {
      ref.current.visible = alive;
      if (alive) (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });
  return (
    <points ref={ref} frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={colorHex.skyEventHorizon} size={0.07} transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} map={softDot()} />
    </points>
  );
}

// ------------------------------------------------------------------ the station

export default function Shelter({ rt, work, look }: StationProps) {
  // Textures and odd geometries, made once.
  const tex = useMemo(
    () => ({ frost: frostTexture(), crack: crackTexture(false), glow: crackTexture(true), sky: skyTexture(), shimmer: shimmerTexture(), meter: meterTexture(), grille: grilleTexture() }),
    [],
  );
  const geo = useMemo(() => {
    const cap = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10);
    cap.translate(0, 0.28, 0);
    const bar = new THREE.PlaneGeometry(1, 1);
    bar.translate(0.5, 0, 0);
    return {
      wall: new THREE.CylinderGeometry(R, R, H, 30, 1, true, (3 * Math.PI) / 2 + 0.6, Math.PI * 2 - 1.2),
      frost: wallPatch(R - 0.035, 2.0, -0.95, 0.95),
      crack: wallPatch(R - 0.03, 1.1, -0.14, 0.14),
      glow: wallPatch(R - 0.05, 1.3, -0.2, 0.2),
      cap,
      bar,
    };
  }, []);

  const bagsRef = useRef<THREE.InstancedMesh>(null);
  const bagMat = useRef<THREE.MeshStandardMaterial>(null);
  const jugsRef = useRef<THREE.InstancedMesh>(null);
  const capsRef = useRef<THREE.InstancedMesh>(null);
  const jugMat = useRef<THREE.MeshStandardMaterial>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const hump = useRef<THREE.Mesh>(null);
  const frostMat = useRef<THREE.MeshStandardMaterial>(null);
  const crackMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const grilleMat = useRef<THREE.MeshBasicMaterial>(null);
  const lever = useRef<THREE.Group>(null);
  const heatDot = useRef<THREE.MeshStandardMaterial>(null);
  const skyMat = useRef<THREE.MeshBasicMaterial>(null);
  const shimmerMat = useRef<THREE.MeshBasicMaterial>(null);
  const bar = useRef<THREE.Mesh>(null);
  const barMat = useRef<THREE.MeshBasicMaterial>(null);
  const tick = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const lampMat = useRef<THREE.MeshStandardMaterial>(null);
  const shovel = useRef<THREE.Group>(null);
  const pile = useRef<THREE.Mesh>(null);
  const fx = useRef({ event: 0, sparkRate: 0, crack: 0, doseShown: 0.06 });

  useLayoutEffect(() => {
    initSlots(bagsRef.current, BAG_SLOTS);
    initSlots(jugsRef.current, JUG_SLOTS);
    initSlots(capsRef.current, JUG_SLOTS);
    initSlots(ringRef.current, RING_SLOTS);
    const m = bagsRef.current;
    if (m) {
      const a = new THREE.Color(colorHex.marsDust);
      const b = new THREE.Color(colorHex.marsRose);
      const c = new THREE.Color();
      for (let i = 0; i < BAG_SLOTS.length; i++) m.setColorAt(i, c.copy(a).lerp(b, hash1(i + 400) * 0.7));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, []);

  const col = useMemo(
    () => ({
      white: new THREE.Color(0xffffff),
      frost: new THREE.Color(0xdcecf4),
      jug: new THREE.Color(colorHex.accent),
      sky: new THREE.Color(colorHex.skyTop),
      skyEvent: new THREE.Color(colorHex.skyEventTop),
      heatOn: new THREE.Color(colorHex.skyHorizon),
      heatOff: new THREE.Color(0x2a3048),
      ok: new THREE.Color(colorHex.ok),
      warn: new THREE.Color(colorHex.warn),
      danger: new THREE.Color(colorHex.danger),
      grey: new THREE.Color(colorHex.grey),
      tmp: new THREE.Color(),
    }),
    [],
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const a = stationAct(rt.current, 'shelter');
    const shown = viewOf(a && a.before ? a.from : work);
    let bags = shown.bags;
    let jugs = shown.jugs;
    let crack = shown.crack;
    let heat = shown.heaterOff ? 0 : 1;
    let frost = shown.heaterOff ? 1 : 0;
    let leverA = shown.heaterOff ? 1 : 0;
    let dose = shown.dose;
    let grow = shown.reinforced ? 1 : 0;
    let speJob = 0;
    let digging = false;
    let digP = 0;
    let flash = 0;
    if (a && a.phase !== 'wait') {
      const p = a.p;
      const from = viewOf(a.from);
      const to = viewOf(a.to);
      if (a.phase === 'finish') flash = Math.max(0, 1 - a.t / 1.2);
      if (a.routineId === 'bags') {
        bags = lerp(from.bags, Math.min(BAG_SLOTS.length, Math.max(to.bags, from.bags + 4)), p);
        digging = a.phase === 'do';
        digP = p;
      } else if (a.faultId === 's6_shelter') {
        if (a.optionId === 'regolith') {
          bags = lerp(from.bags, to.bags, p);
          grow = lerp(from.reinforced ? 1 : 0, to.reinforced ? 1 : 0, seg(p, 0.1, 1));
          digging = a.phase === 'do';
          digP = p;
        } else if (a.optionId === 'waterWall') jugs = lerp(from.jugs, to.jugs, p);
        else crack = lerp(from.crack, to.crack, seg(p, 0.15, 1));
      } else if (a.faultId === 's9_shed') {
        leverA = seg(p, 0, 0.3);
        heat = 1 - seg(p, 0.2, 0.55);
        frost = seg(p, 0.4, 1);
      } else if (a.faultId === 's12_spe') {
        dose = lerp(from.dose, to.dose, p);
        speJob = a.phase === 'do' ? 1 : 1 - seg(a.t, 0, 1.5);
      }
    }
    const glow = powerGlow(work.power);

    // Shield wall: bags (regolith) or water containers, placed one by one.
    showSlots(bagsRef.current, BAG_SLOTS, bags);
    showSlots(jugsRef.current, JUG_SLOTS, jugs, 0.7, 0.4);
    showSlots(capsRef.current, JUG_SLOTS, jugs, 0.7, 0.4);
    showSlots(ringRef.current, RING_SLOTS, grow * RING_SLOTS.length, 0.8, -0.3);
    if (hump.current) {
      hump.current.visible = grow > 0.01;
      hump.current.scale.set(2.7 * (0.6 + 0.4 * grow), 1.15 * grow + 0.01, 2.7 * (0.6 + 0.4 * grow));
    }
    if (bagMat.current) {
      bagMat.current.color.copy(col.white).lerp(col.frost, frost * 0.45);
      bagMat.current.emissiveIntensity = flash * 0.5;
    }
    if (jugMat.current) {
      jugMat.current.color.copy(col.jug).lerp(col.frost, frost * 0.5);
      jugMat.current.emissiveIntensity = 0.12 + flash * 0.6;
    }

    // Frost and the heater panel.
    if (frostMat.current) {
      frostMat.current.opacity = frost * 0.85;
      frostMat.current.visible = frost > 0.01;
    }
    if (grilleMat.current) grilleMat.current.color.copy(col.heatOff).lerp(col.heatOn, heat * glow);
    if (lever.current) lever.current.rotation.x = -0.5 + leverA * 1.0;
    if (heatDot.current) {
      heatDot.current.color.copy(heat > 0.5 ? col.ok : col.grey);
      heatDot.current.emissive.copy(heatDot.current.color);
      heatDot.current.emissiveIntensity = heat > 0.5 ? 1.2 * glow : 0.05;
    }

    // Crack in the thin wall: a hairline while the problem is open, a lit crack once deferred.
    const f = fx.current;
    f.crack = crack;
    if (crackMat.current) {
      crackMat.current.opacity = clamp01(crack * 1.4);
      crackMat.current.visible = crack > 0.01;
    }

    // Solar particle event: violet sky in the periscope, shimmer, sparks reaching inside.
    const target = Math.max(look.solarEvent ? 1 : 0, speJob);
    f.event += (target - f.event) * (1 - Math.exp(-dt * 2.5));
    const e = f.event;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    const shieldK = shown.reinforced ? 0.18 : shown.water ? 0.4 : 1;
    f.sparkRate = e * 26 * shieldK + (crack > 0.5 ? e * 8 : 0);
    if (glowMat.current) {
      glowMat.current.opacity = crack > 0.5 ? clamp01((crack - 0.5) * 2) * (0.35 + 0.25 * Math.sin(t * 1.7) + e * pulse * 0.4) : 0;
      glowMat.current.visible = crack > 0.5;
    }
    if (skyMat.current) {
      skyMat.current.color.copy(col.sky).lerp(col.skyEvent, e * (0.6 + 0.4 * pulse)).multiplyScalar(0.25 + 0.75 * glow + e * pulse * 0.35 + flash * 0.3);
    }
    if (shimmerMat.current && tex.shimmer) {
      shimmerMat.current.opacity = e * (0.55 + 0.35 * pulse);
      shimmerMat.current.visible = e > 0.02;
      tex.shimmer.offset.set((t * 0.37) % 1, (t * 0.91) % 1);
    }

    // Dose meter: the bar rises to the reading (slowly ticking up while sitting it out).
    f.doseShown += (dose - f.doseShown) * (1 - Math.exp(-dt * 6));
    const d = clamp01(f.doseShown + (e > 0.05 ? 0.012 * Math.sin(t * 9) * e : 0));
    if (bar.current) bar.current.scale.set(Math.max(0.005, d * 0.36), 0.055, 1);
    if (barMat.current) {
      col.tmp.copy(d < 0.34 ? col.ok : d < 0.6 ? col.warn : col.danger);
      barMat.current.color.copy(col.tmp).multiplyScalar(0.4 + 0.6 * Math.max(glow, 0.5));
    }
    if (tick.current) {
      const period = e > 0.05 ? 0.28 : 1.6;
      tick.current.opacity = (t % period) / period < 0.25 ? 1 : 0.15;
    }

    // Emergency light: dim pink-violet, on battery even when the base power is low.
    const em = Math.max(glow, 0.5);
    if (light.current) light.current.intensity = (5.5 * em + e * pulse * 3 + flash * 3) * (1 - frost * 0.15);
    if (lampMat.current) lampMat.current.emissiveIntensity = 1.2 * em + e * pulse;

    // Digging: shovel scoops from a pile of loose regolith to the wall.
    if (shovel.current) {
      shovel.current.visible = digging;
      if (digging) {
        const c = (digP * 7) % 1;
        const k = seg(c, 0.3, 0.8);
        const back = seg(c, 0.85, 1);
        const m = k * (1 - back);
        shovel.current.position.set(lerp(1.35, 1.75, m), lerp(0.28, 0.62, m) + Math.sin(Math.PI * m) * 0.45, lerp(0.75, 0.05, m));
        shovel.current.rotation.set(lerp(0.5, -0.4, m) - seg(c, 0.0, 0.3) * 0.35 * (1 - m), -0.9, seg(c, 0.75, 0.9) * 0.9 * (1 - back));
      }
    }
    if (pile.current) {
      pile.current.visible = digging;
      pile.current.scale.set(0.5, 0.32 * (1 - digP * 0.75) + 0.02, 0.45);
    }
  });

  const [sx, sz] = SHELTER_AT;
  const rotY = (SHELTER_DEG * Math.PI) / 180;
  const tunnelLen = T_END - T_START;
  const bermLen = T_END - 0.1 - (T_START + 0.05);
  const doorLamp = wallPoint(SHELTER_DEG, 2.62, 0.2);
  const doorLampRot = (SHELTER_DEG * Math.PI) / 180 + Math.PI / 2;

  return (
    <>
      {/* Status lamp above the shelter door, inside the hab. */}
      <group position={doorLamp} rotation={[0, doorLampRot, 0]}>
        <Lamp station="shelter" rt={rt} work={work} at={[0, 0, 0]} size={0.07} />
      </group>
      <group position={[sx, 0, sz]} rotation={[0, rotY, 0]}>
        {/* ---------------- outside: mound, berm over the tunnel, periscope ---------------- */}
        <mesh scale={MOUND} castShadow receiveShadow>
          <sphereGeometry args={[1, 22, 4, 0, Math.PI * 2, 0, MOUND_CAP]} />
          <meshLambertMaterial color={colorHex.marsRose} flatShading />
        </mesh>
        <mesh scale={MOUND} castShadow receiveShadow>
          <sphereGeometry args={[1, 22, 5, MOUND_GAP, Math.PI * 2 - 2 * MOUND_GAP, MOUND_CAP, Math.PI / 2 - MOUND_CAP]} />
          <meshLambertMaterial color={colorHex.marsRose} flatShading />
        </mesh>
        <mesh position={[(T_START + 0.05 + T_END - 0.1) / 2, BERM_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[BERM_R, BERM_R, bermLen, 12, 1, true]} />
          <meshLambertMaterial color={colorHex.marsBrown} flatShading />
        </mesh>
        {/* Extra regolith layer on top once the wall is reinforced. */}
        <mesh ref={hump} position={[0.2, 2.3, 0]} visible={false} castShadow>
          <sphereGeometry args={[1, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color={colorHex.marsBrown} flatShading />
        </mesh>
        <instancedMesh ref={ringRef} args={[rbox(0.5, 0.3, 0.42, 0.11), undefined, RING_SLOTS.length]} castShadow>
          <meshStandardMaterial color={colorHex.marsDust} roughness={1} />
        </instancedMesh>
        {/* Periscope head on top of the mound. */}
        <mesh position={[2.05, 2.85, 0.5]}>
          <cylinderGeometry args={[0.06, 0.06, 1.3, 8]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        <RBox size={[0.3, 0.2, 0.22]} r={0.05} position={[2.1, 3.55, 0.5]} color={colorHex.hullDark} />
        <mesh position={[2.26, 3.55, 0.5]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.07, 14]} />
          <meshStandardMaterial color={0x9fd7ea} emissive={colorHex.accent} emissiveIntensity={0.4} />
        </mesh>

        {/* ---------------- tunnel from the hab door ---------------- */}
        <mesh position={[(T_START + T_END) / 2, T_Y, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[T_R, T_R, tunnelLen, 18, 1, true]} />
          <meshStandardMaterial color={colorHex.hullDark} roughness={0.85} side={THREE.BackSide} />
        </mesh>
        <mesh position={[(T_START + T_END) / 2, FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[tunnelLen, 1.76]} />
          <meshStandardMaterial color={colorHex.metal} roughness={0.9} />
        </mesh>
        {[T_START + 1.1, T_START + 2.5].map((x) => (
          <mesh key={x} position={[x, T_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[T_R - 0.04, 0.06, 6, 20]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        ))}
        <mesh position={[(T_START + T_END) / 2, T_Y + T_R - 0.08, 0]}>
          <boxGeometry args={[tunnelLen * 0.8, 0.03, 0.12]} />
          <meshStandardMaterial color={0xeefcff} emissive={0xeefcff} emissiveIntensity={0.9 * powerGlow(work.power)} />
        </mesh>

        {/* ---------------- bulkhead (thick wall at the doorway) ---------------- */}
        <group position={[BULK_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <RBox size={[0.95, 2.3, 0.4]} r={0.06} position={[-1.13, 1.15, 0]} color={colorHex.grey} />
          <RBox size={[0.95, 2.3, 0.4]} r={0.06} position={[1.13, 1.15, 0]} color={colorHex.grey} />
          <RBox size={[1.4, 0.32, 0.4]} r={0.06} position={[0, 2.12, 0]} color={colorHex.grey} />
          <mesh position={[0, 2.0, 0.21]}>
            <boxGeometry args={[1.3, 0.05, 0.02]} />
            <meshBasicMaterial color={colorHex.warn} />
          </mesh>
        </group>

        {/* ---------------- the room ---------------- */}
        <mesh geometry={geo.wall} position={[0, H / 2, 0]} receiveShadow>
          <meshStandardMaterial color={colorHex.grey} roughness={0.9} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[R + 0.05, 30]} />
          <meshStandardMaterial color={colorHex.hullDark} roughness={0.9} />
        </mesh>
        <mesh position={[0, FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[R + 0.05, 30]} />
          <meshStandardMaterial color={colorHex.metal} roughness={0.95} />
        </mesh>
        {/* Ceiling ribs. */}
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} position={[0, H - 0.05, 0]} rotation={[0, r, 0]}>
            <boxGeometry args={[R * 2 - 0.1, 0.08, 0.12]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        ))}
        {/* Emergency light. */}
        <mesh position={[0.2, H - 0.12, 0]}>
          <boxGeometry args={[0.5, 0.06, 0.18]} />
          <meshStandardMaterial ref={lampMat} color={colorHex.skyEventHorizon} emissive={colorHex.skyEventHorizon} emissiveIntensity={1.2} />
        </mesh>
        <pointLight ref={light} position={[0.2, H - 0.35, 0]} intensity={5} distance={6} decay={1.6} color={colorHex.skyEventHorizon} />

        {/* Bench on the side wall, and a small water barrel. */}
        <group {...onWall(1.75, R - 0.3, 0)}>
          <RBox size={[1.3, 0.09, 0.42]} r={0.03} position={[0, 0.46, 0]} color={colorHex.hullDark} />
          <RBox size={[1.1, 0.4, 0.3]} r={0.03} position={[0, 0.22, -0.04]} color={colorHex.metal} />
        </group>
        <Model name="barrel" position={[Math.cos(2.35) * (R - 0.45), FLOOR, Math.sin(2.35) * (R - 0.45)]} scale={0.9} shadows={false} fallback={<mesh position={[Math.cos(2.35) * (R - 0.45), 0.4, Math.sin(2.35) * (R - 0.45)]}><cylinderGeometry args={[0.25, 0.25, 0.7, 12]} /><meshStandardMaterial color={colorHex.hullDark} /></mesh>} />

        {/* Thin wall: crack line with faint light leaking through. */}
        <mesh geometry={geo.crack} position={[0, 0.85, 0]} raycast={() => null}>
          <meshBasicMaterial ref={crackMat} map={tex.crack} transparent depthWrite={false} side={THREE.BackSide} visible={false} />
        </mesh>
        <mesh geometry={geo.glow} position={[0, 0.85, 0]} raycast={() => null}>
          <meshBasicMaterial ref={glowMat} map={tex.glow} color={colorHex.skyEventHorizon} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} visible={false} />
        </mesh>
        {/* Frost on the outer wall (heater off). */}
        <mesh geometry={geo.frost} position={[0, 1.08, 0]} raycast={() => null}>
          <meshStandardMaterial ref={frostMat} map={tex.frost} color={0xffffff} transparent opacity={0} depthWrite={false} roughness={0.3} side={THREE.BackSide} visible={false} />
        </mesh>

        {/* Shield wall: bags of regolith, or water containers. */}
        <instancedMesh ref={bagsRef} args={[rbox(0.5, BAG_H, 0.42, 0.11), undefined, BAG_SLOTS.length]} castShadow receiveShadow>
          <meshStandardMaterial ref={bagMat} color={0xffffff} roughness={1} emissive={colorHex.marsDust} emissiveIntensity={0} />
        </instancedMesh>
        <instancedMesh ref={jugsRef} args={[rbox(0.4, 0.5, 0.32, 0.08), undefined, JUG_SLOTS.length]}>
          <meshStandardMaterial ref={jugMat} color={colorHex.accent} roughness={0.25} metalness={0.05} transparent opacity={0.78} emissive={colorHex.accentDim} emissiveIntensity={0.12} />
        </instancedMesh>
        <instancedMesh ref={capsRef} args={[geo.cap, undefined, JUG_SLOTS.length]}>
          <meshStandardMaterial color={colorHex.hull} />
        </instancedMesh>

        {/* Work band above the wall: heater, periscope screen, dose meter. */}
        <group {...onWall(PHI_HEATER, BAND_R, BAND_Y)}>
          <RBox size={[0.58, 0.36, 0.06]} r={0.02} color={colorHex.hullDark} />
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[0.46, 0.24]} />
            <meshBasicMaterial ref={grilleMat} map={tex.grille} color={colorHex.skyHorizon} />
          </mesh>
          <group ref={lever} position={[0.34, 0, 0.04]}>
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[0.035, 0.14, 0.035]} />
              <meshStandardMaterial color={colorHex.warn} />
            </mesh>
          </group>
          <mesh position={[0.34, -0.12, 0.04]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial ref={heatDot} color={colorHex.ok} emissive={colorHex.ok} emissiveIntensity={1} />
          </mesh>
        </group>
        <group {...onWall(PHI_SCREEN, BAND_R, BAND_Y + 0.02)}>
          <RBox size={[0.78, 0.42, 0.06]} r={0.02} color={colorHex.metal} />
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[0.68, 0.32]} />
            <meshBasicMaterial ref={skyMat} map={tex.sky} color={colorHex.skyTop} />
          </mesh>
          <mesh position={[0, 0, 0.036]} raycast={() => null}>
            <planeGeometry args={[0.68, 0.32]} />
            <meshBasicMaterial ref={shimmerMat} map={tex.shimmer} color={colorHex.skyEventHorizon} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} visible={false} />
          </mesh>
          {/* Periscope tube up through the ceiling. */}
          <mesh position={[0, 0.42, -0.02]}>
            <cylinderGeometry args={[0.06, 0.06, 0.45, 8]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        </group>
        <group {...onWall(PHI_METER, BAND_R, BAND_Y)}>
          <RBox size={[0.5, 0.28, 0.06]} r={0.02} color={colorHex.hullDark} />
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[0.44, 0.22]} />
            <meshBasicMaterial map={tex.meter} />
          </mesh>
          <mesh ref={bar} geometry={geo.bar} position={[-0.11, -0.022, 0.036]}>
            <meshBasicMaterial ref={barMat} color={colorHex.ok} />
          </mesh>
          <mesh position={[0.17, 0.075, 0.036]}>
            <circleGeometry args={[0.018, 10]} />
            <meshBasicMaterial ref={tick} color={colorHex.skyEventHorizon} transparent />
          </mesh>
        </group>
        <Lamp station="shelter" rt={rt} work={work} at={[Math.cos(-0.78) * (R - 0.1), 1.98, Math.sin(-0.78) * (R - 0.1)]} size={0.06} />

        {/* Dig job: loose regolith pile and the shovel. */}
        <mesh ref={pile} position={[1.35, FLOOR, 0.78]} visible={false}>
          <sphereGeometry args={[1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color={colorHex.marsRose} flatShading />
        </mesh>
        <group ref={shovel} visible={false}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
            <meshStandardMaterial color={colorHex.hullDark} />
          </mesh>
          <mesh geometry={rbox(0.22, 0.26, 0.04, 0.015)} position={[0, -0.08, 0]}>
            <meshStandardMaterial color={colorHex.metal} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.02, 0.03]}>
            <sphereGeometry args={[0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color={colorHex.marsRose} flatShading />
          </mesh>
        </group>

        <Sparks rate={() => fx.current.sparkRate} crack={() => fx.current.crack} />
      </group>
    </>
  );
}
