// Greenhouse dome west of the hab: a work bench with soil (salt crust when the soil is bad),
// two side benches, plants (instanced leaves), purple grow lights, a hose reel, a console with
// a sealing lever, a bulkhead door at the tunnel and a leak point on the dome (Sol 13).
// Jobs are acted out on these parts; results stay from work.chosen (clean dark soil, hydroponic
// trays, hardy plants, patch / tape on the dome, sealed and dark dome, dead plants after the
// greenhouse circuit was switched off).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { Lamp, powerGlow, rbox, seg, stationAct, type StationProps } from '../core';
import { EYE, GREENHOUSE_AT, GREENHOUSE_R, HAB_R, type V3 } from '../world';
import { decay, Jet, layCable, makeCable } from './s1-fx';

const ST = 'greenhouse';
const [GX, GZ] = GREENHOUSE_AT;
const TOP = 0.75; // soil surface height
// Work bench (long axis along z), right where the close-up camera looks.
const WB_X = -14.2;
const WB_Z = -0.6;
const SEG_Z = [-1.2, -0.8, -0.4, 0.0];
const WORK_PLANTS: [number, number][] = [];
for (const z of SEG_Z) for (const x of [-14.38, -14.02]) WORK_PLANTS.push([x, z]);
const HARDY: [number, number][] = [
  [WB_X, -1.0],
  [WB_X, -0.6],
  [WB_X, -0.2],
];
// Side benches (long axis along x).
const SIDE_Z = [-2.7, 2.3];
const SIDE_X = -13.2;
const SIDE_PLANTS: [number, number][] = [];
for (const z of SIDE_Z) for (const dz of [-0.17, 0.17]) for (let i = 0; i < 5; i++) SIDE_PLANTS.push([-14.4 + i * 0.6, z + dz]);
const LEAVES = 4;
// Hose reel and nozzle.
const REEL = new THREE.Vector3(-13.45, 0.3, 0.75);
const NOZZLE_REST = new THREE.Vector3(-13.45, 0.58, 0.75);
// Console (with the sealing lever), facing the work camera.
const CON: V3 = [-13.85, 0, -1.75];
const CON_YAW = Math.atan2(-12.7 - CON[0], -0.3 - CON[2]);
// Leak point on the dome and its outward normal.
const LEAK = new THREE.Vector3(-16.53, 1.3, -1.2);
const CENTRE = new THREE.Vector3(GX, 0, GZ);
const NORMAL = LEAK.clone().sub(CENTRE).normalize();
const LEAK_IN = LEAK.clone().addScaledVector(NORMAL, -0.04);
const PATCH_FROM = new THREE.Vector3(-13.5, 1.15, -0.5);
// Bulkhead at the tunnel end.
const DOOR_X = GX + GREENHOUSE_R - 0.25;
const DOOR_EYE = new THREE.Vector3(DOOR_X, EYE, 0);

/** Grow light: a vivid violet (red + blue LEDs), clearly different from every other room. */
const LIGHT = 0xa64dff;

// ------------------------------------------------------------------ what the state says

interface GH {
  salt: number;
  dark: number;
  hydro: boolean;
  hardy: boolean;
  vigor: number;
  dead: boolean;
  lightsOff: boolean;
  sealed: boolean;
  leak: number;
  patch: 0 | 1 | 2;
}

function readGH(w: WorkLook, g: GH): GH {
  const c = w.chosen.s3_soil;
  const open = w.open.includes('s3_soil');
  const age = w.age.s3_soil ?? 0;
  g.dead = w.chosen.s9_shed === 'greenhouseOff';
  g.hydro = !open && c === 'hydro';
  g.hardy = !open && c === 'hardy';
  g.salt = open ? Math.min(1, 0.7 + 0.15 * age) : c === 'hardy' ? 0.45 : c === 'defer' ? 0.8 : c === 'wash' || c === 'hydro' ? 0 : 0.12;
  g.dark = !open && c === 'wash' ? 1 : 0;
  g.vigor = g.dead ? 0 : open ? Math.max(0.25, 0.45 - 0.1 * age) : c === 'hardy' ? 0.7 : c === 'defer' ? 0.45 : c === 'wash' || c === 'hydro' ? 1 : 0.9;
  const lb = w.chosen.s13_leakB;
  const leakOpen = w.open.includes('s13_leakB');
  g.sealed = !leakOpen && lb === 'sealOff';
  if (g.sealed && !g.dead) g.vigor = Math.min(g.vigor, 0.65);
  g.lightsOff = g.dead || g.sealed;
  g.leak = leakOpen ? 0.55 + 0.35 * Math.min(3, w.age.s13_leakB ?? 0) : g.sealed && w.mods.includes('leakSmall') ? 0.25 : 0;
  g.patch = leakOpen ? 0 : lb === 'patchKit' ? 1 : lb === 'teaLeaves' ? 2 : 0;
  return g;
}
const newGH = (): GH => ({ salt: 0, dark: 0, hydro: false, hardy: false, vigor: 1, dead: false, lightsOff: false, sealed: false, leak: 0, patch: 0 });

// ------------------------------------------------------------------ component

export default function GreenhouseStation({ rt, work }: StationProps) {
  const workLeaves = useRef<THREE.InstancedMesh>(null);
  const sideLeaves = useRef<THREE.InstancedMesh>(null);
  const workLeafMat = useRef<THREE.MeshStandardMaterial>(null);
  const sideLeafMat = useRef<THREE.MeshStandardMaterial>(null);
  const hardy = useRef<THREE.InstancedMesh>(null);
  const soilTray = useRef<THREE.Group>(null);
  const hydroTray = useRef<THREE.Group>(null);
  const soilMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const crustMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const sideSoil = useRef<THREE.Group>(null);
  const sideWater = useRef<THREE.Group>(null);
  const stripMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const nozzle = useRef<THREE.Group>(null);
  const hose = useRef<THREE.InstancedMesh>(null);
  const trowel = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const o2bar = useRef<THREE.Mesh>(null);
  const lever = useRef<THREE.Group>(null);
  const crack = useRef<THREE.Group>(null);
  const patch = useRef<THREE.Group>(null);
  const patchRim = useRef<THREE.MeshStandardMaterial>(null);
  const tape = useRef<THREE.Group>(null);
  const tea = useRef<THREE.InstancedMesh>(null);
  const door = useRef<THREE.Group>(null);

  const leafGeo = useMemo(() => new THREE.ConeGeometry(0.055, 0.26, 5).scale(1, 1, 0.45).translate(0, 0.13, 0), []);
  const hardyGeo = useMemo(() => new THREE.IcosahedronGeometry(0.075, 0).scale(1, 0.75, 1).translate(0, 0.05, 0), []);
  const leakQ = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(LEAK);
    o.lookAt(CENTRE);
    return o.quaternion.clone();
  }, []);
  const crustTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 160; i++) {
      const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 128;
      const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * 128;
      const r = 3 + ((i * 7) % 9);
      g.globalAlpha = 0.45 + ((i * 3) % 5) / 10;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  // Shared by both side benches.
  const side = useMemo(
    () => ({
      soil: new THREE.MeshStandardMaterial({ color: colorHex.marsBrown, roughness: 1 }),
      crust: new THREE.MeshStandardMaterial({ color: colorHex.text, map: crustTex, transparent: true, opacity: 0, depthWrite: false, roughness: 1 }),
      tray: new THREE.MeshStandardMaterial({ color: colorHex.hullDark }),
    }),
    [crustTex],
  );

  const s = useMemo(
    () => ({
      g: newGH(),
      gFrom: newGH(),
      o: new THREE.Object3D(),
      col: new THREE.Color(),
      cDead: new THREE.Color(colorHex.marsBrown).lerp(new THREE.Color(colorHex.grey), 0.45),
      cPale: new THREE.Color(colorHex.plant).lerp(new THREE.Color(colorHex.grey), 0.6),
      cGood: new THREE.Color(0x3fc46a),
      cDry: new THREE.Color(colorHex.marsBrown),
      cWet: new THREE.Color(colorHex.marsBrown).lerp(new THREE.Color(colorHex.bgDeep), 0.5),
      cTray: new THREE.Color(colorHex.hullDark),
      cWhite: new THREE.Color(colorHex.filterNew),
      v: new THREE.Vector3(),
      cable: makeCable(),
      nozBack: new THREE.Vector3(),
      sprayO: new THREE.Vector3(),
      sprayDir: new THREE.Vector3(-0.3, -1, 0).normalize(),
      sprayRate: 0,
      sprayBig: true,
      bubbleO: new THREE.Vector3(WB_X, 0.95, WB_Z),
      up: new THREE.Vector3(0, 1, 0),
      bubbleRate: 0,
      steamO: LEAK_IN.clone(),
      steamDir: NORMAL.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.5, 0)).normalize(),
      steamRate: 0,
      wVig: -1,
      sVig: -1,
      level: -1,
      salt: [0, 0, 0, 0],
      dark: [0, 0, 0, 0],
      flash: 0,
      lastPhase: 'none' as string,
      dug: -1,
      doorOpen: 1,
      tendGlow: 0,
    }),
    [],
  );

  const plantColor = (v: number, out: THREE.Color) => (v < 0.5 ? out.copy(s.cDead).lerp(s.cPale, v / 0.5) : out.copy(s.cPale).lerp(s.cGood, (v - 0.5) / 0.5));

  const layPlants = (mesh: THREE.InstancedMesh, pts: [number, number][], vig: number, dead: boolean, t: number, lift: number, i0: number) => {
    const droop = 1 - vig;
    pts.forEach(([x, z], k) => {
      const ph = (k + i0) * 1.7;
      for (let j = 0; j < LEAVES; j++) {
        const side = j < LEAVES - 1;
        const yaw = ph + (j * Math.PI * 2) / (LEAVES - 1);
        const tilt = (side ? 0.35 + droop * 0.95 : 0.1 + droop * 0.4) + Math.sin(t * 1.3 + ph) * 0.04;
        const sc = (side ? 1 : 0.75) * (0.8 + 0.2 * vig) * (dead ? 0.8 : 1);
        s.o.position.set(x, TOP + lift, z);
        s.o.rotation.set(tilt, yaw, 0, 'YXZ');
        s.o.scale.set(sc, sc, sc);
        s.o.updateMatrix();
        mesh.setMatrixAt(k * LEAVES + j, s.o.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const R = rt.current;
    const a = stationAct(R, ST);
    const w = a && a.before ? a.from : work;
    const doing = !!a && a.before;
    const p = a ? a.p : 0;
    const opt = a?.optionId ?? null;
    const fid = a?.faultId ?? null;
    const g = readGH(w, s.g);
    const job = (f: string, o: string) => doing && fid === f && opt === o;
    const isWash = job('s3_soil', 'wash');
    const isHydro = job('s3_soil', 'hydro');
    const isHardy = job('s3_soil', 'hardy');
    const isTend = doing && a!.routineId === 'tend';
    const isO2 = job('s5_oxygen', 'plants');
    const isKit = job('s13_leakB', 'patchKit');
    const isTea = job('s13_leakB', 'teaLeaves');
    const isSeal = job('s13_leakB', 'sealOff');

    // Finish moment.
    const phase = a?.phase ?? 'none';
    if (phase === 'finish' && s.lastPhase !== 'finish' && a && a.kind !== 'wait') {
      s.flash = 1;
      const at = fid === 's13_leakB' && opt !== 'sealOff' ? s.v.copy(LEAK_IN) : s.v.set(WB_X, TOP + 0.2, WB_Z);
      R.puff(at, 6);
    }
    s.lastPhase = phase;
    s.flash = decay(s.flash, dt, 0.9);

    // ---- soil: salt crust and dark wet soil per segment (washing clears it where the spray passes)
    const nz = 0.3 - 1.8 * Math.max(0, Math.min(1, (p - 0.1) / 0.8));
    for (let i = 0; i < SEG_Z.length; i++) {
      let salt = g.salt;
      let dark = g.dark;
      if (isWash) {
        const k = Math.max(0, Math.min(1, (SEG_Z[i]! + 0.2 - nz) / 0.4));
        salt = g.salt * (1 - k);
        dark = k;
      }
      s.salt[i]! += (salt - s.salt[i]!) * (doing ? 1 : 1 - Math.exp(-dt * 3));
      s.dark[i]! += (dark - s.dark[i]!) * (doing ? 1 : 1 - Math.exp(-dt * 3));
      const sm = soilMats.current[i];
      if (sm) sm.color.copy(s.cDry).lerp(s.cWet, s.dark[i]!);
      const cm = crustMats.current[i];
      if (cm) {
        cm.opacity = s.salt[i]! * 0.95;
        cm.visible = s.salt[i]! > 0.01;
      }
    }
    side.crust.opacity = g.salt * 0.95;
    side.crust.visible = g.salt > 0.01 && !g.hydro;
    side.soil.color.copy(s.cDry).lerp(s.cWet, g.dark);
    side.tray.color.copy(g.hydro ? s.cWhite : s.cTray);
    if (sideSoil.current) sideSoil.current.visible = !g.hydro;
    if (sideWater.current) sideWater.current.visible = g.hydro;

    // ---- hydroponics: plants lift, soil tray out to the floor, white tray in, plants down
    let lift = 0;
    const st = soilTray.current;
    const ht = hydroTray.current;
    if (st && ht) {
      if (isHydro) {
        lift = 0.35 * (seg(p, 0, 0.2) - seg(p, 0.75, 0.95));
        const k = seg(p, 0.18, 0.45);
        st.position.set(0, -0.57 * k, 1.75 * k);
        st.rotation.x = 0;
        const k2 = seg(p, 0.45, 0.75);
        ht.visible = p > 0.42;
        ht.position.set(0.6 * (1 - k2), 0.5 * (1 - k2), 0);
        if (p > 0.8 && p < 0.84) R.puff(s.v.set(WB_X, TOP, WB_Z), 1);
      } else {
        ht.visible = g.hydro;
        ht.position.set(0, 0, 0);
        st.position.set(0, g.hydro ? -0.57 : 0, g.hydro ? 1.75 : 0);
      }
    }

    // ---- plant vigour (work bench animates; side benches switch at the finish)
    let wv = g.vigor;
    if (doing) {
      const from = g.vigor;
      if (isWash) wv = from + (1 - from) * seg(p, 0.55, 1);
      else if (isHydro) wv = from + (1 - from) * seg(p, 0.75, 1);
      else if (isTend) wv = Math.max(from, from + (1 - from) * seg(p, 0.2, 0.9));
    }
    if (isTend) s.tendGlow = Math.sin(p * Math.PI) * 0.5 + 0.2;
    s.tendGlow = decay(s.tendGlow, dt, 0.15);
    if (s.wVig < 0) s.wVig = wv;
    s.wVig += (wv - s.wVig) * (doing ? 1 : 1 - Math.exp(-dt * 1.2));
    if (s.sVig < 0) s.sVig = g.vigor;
    s.sVig += (g.vigor - s.sVig) * (1 - Math.exp(-dt * 1.2));
    if (workLeaves.current) layPlants(workLeaves.current, WORK_PLANTS, s.wVig, g.dead, t, lift, 0);
    if (sideLeaves.current) layPlants(sideLeaves.current, SIDE_PLANTS, s.sVig, g.dead, t, 0, 8);
    if (workLeafMat.current) {
      plantColor(s.wVig, workLeafMat.current.color);
      workLeafMat.current.emissiveIntensity = 0.08 + s.tendGlow * 0.6 + s.flash * 0.3;
    }
    if (sideLeafMat.current) plantColor(s.sVig, sideLeafMat.current.color);

    // ---- hardy plants: the trowel digs three holes, a squat plant pops up in each
    const hm = hardy.current;
    if (hm) {
      HARDY.forEach(([x, z], j) => {
        let sc = g.hardy ? 1 : 0;
        if (isHardy) sc = seg(p * 3 - j, 0.65, 0.95);
        s.o.position.set(x, TOP, z);
        s.o.rotation.set(0, j * 1.1, 0);
        s.o.scale.setScalar(Math.max(0.001, sc));
        s.o.updateMatrix();
        hm.setMatrixAt(j, s.o.matrix);
      });
      hm.instanceMatrix.needsUpdate = true;
    }
    const tr = trowel.current;
    if (tr) {
      tr.visible = isHardy && p > 0.01;
      if (isHardy) {
        const j = Math.min(2, Math.floor(p * 3));
        const u = p * 3 - j;
        const [x, z] = HARDY[j]!;
        const down = seg(u, 0.2, 0.4) - seg(u, 0.55, 0.75);
        tr.position.set(x + 0.12, TOP + 0.32 - 0.25 * down, z + (1 - seg(u, 0, 0.25)) * 0.3);
        tr.rotation.set(0, 0, 0.5 + Math.sin(t * 18) * 0.15 * down);
        if (u > 0.4 && s.dug !== j) {
          s.dug = j;
          R.puff(s.v.set(x, TOP + 0.03, z), 3);
        }
      } else s.dug = -1;
    }

    // ---- hose nozzle: washing sweeps along the bench; tending mists gently
    const nzl = nozzle.current;
    if (nzl) {
      if (isWash || isTend) {
        const zz = isWash ? nz : WB_Z + Math.sin(p * Math.PI * 3) * 0.6;
        const k = seg(p, 0, 0.1);
        nzl.position.copy(NOZZLE_REST).lerp(s.v.set(WB_X + 0.25, 1.1, zz), k);
        nzl.rotation.set(0, 0, 0.35 * k);
      } else {
        nzl.position.copy(NOZZLE_REST);
        nzl.rotation.set(0, 0, 0);
      }
      s.sprayO.set(nzl.position.x - 0.04, nzl.position.y - 0.12, nzl.position.z);
      s.nozBack.set(nzl.position.x + 0.03, nzl.position.y + 0.1, nzl.position.z);
      if (hose.current) layCable(hose.current, s.cable, REEL, s.nozBack, 0.35, 0.06);
    }
    s.sprayRate = isWash && p > 0.08 && p < 0.92 ? 2.4 : isTend && p > 0.08 && p < 0.92 ? 1.0 : 0;

    // ---- grow light (off when the circuit or the dome is shut, dim with low power; oxygen job boosts it)
    let level = g.lightsOff ? 0 : powerGlow(w.power);
    if (isSeal) level *= 1 - seg(p, 0.45, 0.85);
    if (isO2) level *= 1 + 0.7 * Math.sin(p * Math.PI);
    if (s.level < 0) s.level = level;
    s.level += (level - s.level) * (doing ? 1 : 1 - Math.exp(-dt * 3));
    if (light.current) light.current.intensity = 3 + 38 * s.level;
    if (stripMat.current) stripMat.current.emissiveIntensity = 0.05 + 2.6 * s.level;
    s.bubbleRate = isO2 && p > 0.15 ? 1.2 : 0;

    // ---- console: alarm blink, oxygen bar; sealing lever
    const glow = powerGlow(w.power);
    if (screenMat.current) {
      const alarm = !!w.alarm[ST];
      screenMat.current.emissive.setHex(alarm ? colorHex.danger : s.flash > 0.05 ? colorHex.ok : colorHex.accent);
      screenMat.current.emissiveIntensity = (alarm ? (Math.sin(t * 7) > 0 ? 1 : 0.3) : 0.5 + s.flash * 0.8) * glow;
    }
    if (o2bar.current) {
      const k = isO2 ? 0.3 + 0.65 * seg(p, 0.1, 0.9) : a?.optionId === 'plants' && phase === 'finish' ? 0.95 : 0.5;
      o2bar.current.scale.x = k;
      o2bar.current.position.x = -0.13 + 0.13 * k;
    }
    if (lever.current) lever.current.rotation.x = isSeal ? 0.25 + (Math.PI - 0.5) * seg(p, 0.05, 0.4) : g.sealed ? Math.PI - 0.25 : 0.25;

    // ---- leak on the dome: steam, crack; patch kit / tea leaves + tape
    let leak = g.leak;
    if (isKit) leak *= 1 - seg(p, 0.55, 0.75);
    if (isTea) leak *= 1 - seg(p, 0.7, 0.9);
    s.steamRate = leak;
    if (crack.current) crack.current.visible = g.patch === 0 && (g.leak > 0 || isKit || isTea);
    const pa = patch.current;
    if (pa) {
      pa.visible = g.patch === 1 || (isKit && p > 0.02);
      if (isKit) {
        const k = seg(p, 0.02, 0.55);
        pa.position.copy(PATCH_FROM).lerp(LEAK_IN, k);
        pa.scale.setScalar(0.5 + 0.5 * k + 0.15 * Math.sin(seg(p, 0.55, 0.8) * Math.PI));
      } else {
        pa.position.copy(LEAK_IN);
        pa.scale.setScalar(1);
      }
    }
    if (patchRim.current) {
      patchRim.current.emissiveIntensity = 0.2 + s.flash * 1.5;
    }
    const tp = tape.current;
    if (tp) {
      tp.visible = g.patch === 2 || (isTea && p > 0.55);
      tp.children.forEach((c, i) => (c.visible = !isTea || p > 0.6 + i * 0.15));
    }
    const tm = tea.current;
    if (tm) {
      tm.visible = isTea && p < 0.62;
      if (tm.visible) {
        for (let i = 0; i < tm.count; i++) {
          const k = Math.max(0, Math.min(1, (p - i * 0.03) / 0.4));
          const bx = WB_X + 0.15 + Math.sin(i * 2.3) * 0.2;
          const bz = WB_Z + Math.sin(i * 1.7) * 0.5;
          // Quadratic path from the bench up and over to the hole.
          const u = 1 - k;
          const cx = (bx + LEAK.x) / 2;
          const cy = 2.0;
          const cz = (bz + LEAK.z) / 2;
          s.o.position.set(u * u * bx + 2 * u * k * cx + k * k * LEAK_IN.x, u * u * (TOP + 0.3) + 2 * u * k * cy + k * k * LEAK_IN.y, u * u * bz + 2 * u * k * cz + k * k * LEAK_IN.z);
          s.o.rotation.set(t * 3 + i, t * 2 + i * 0.7, 0);
          s.o.scale.setScalar(k > 0.97 || k <= 0 ? 0.001 : 1);
          s.o.updateMatrix();
          tm.setMatrixAt(i, s.o.matrix);
        }
        tm.instanceMatrix.needsUpdate = true;
      }
    }

    // ---- bulkhead at the tunnel: shut when the dome is sealed (opens when someone comes near)
    const dr = door.current;
    if (dr) {
      let shut = g.sealed ? 1 : 0;
      if (isSeal) shut = seg(p, 0.4, 0.9);
      else if (g.sealed && camera.position.distanceTo(DOOR_EYE) < 2.8) shut = 0;
      s.doorOpen += (1 - shut - s.doorOpen) * (isSeal ? 1 : 1 - Math.exp(-dt * 5));
      dr.visible = s.doorOpen < 0.98;
      dr.position.z = s.doorOpen * 1.35;
    }
  });

  const inner = -HAB_R;
  const outer = GX + GREENHOUSE_R - 0.2;
  const leafMat = (ref: typeof workLeafMat) => <meshStandardMaterial ref={ref} color={0x3fc46a} emissive={0x2f9a52} emissiveIntensity={0.3} roughness={0.8} flatShading />;

  return (
    <group>
      {/* Tunnel from the hab, with a floor strip. */}
      <mesh position={[(inner + outer) / 2, 1.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.35, 1.35, Math.abs(outer - inner) + 0.3, 18, 1, true]} />
        <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[(inner + outer) / 2, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.abs(outer - inner) + 0.3, 1.7]} />
        <meshStandardMaterial color={colorHex.surface2} />
      </mesh>
      {/* Bulkhead frame + sliding door (shown only when the dome is sealed off). */}
      <mesh position={[DOOR_X, 1.3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.3, 0.09, 8, 28]} />
        <meshStandardMaterial color={colorHex.hullDark} metalness={0.3} />
      </mesh>
      <group ref={door} position={[DOOR_X, 0, 1.35]} visible={false}>
        <mesh position={[0, 1.1, 0]} geometry={rbox(0.08, 2.1, 1.35, 0.03)}>
          <meshStandardMaterial color={colorHex.metal} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.045, 0.6, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color={colorHex.warn} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Dome: floor, base ring, glass, frame. */}
      <group position={[GX, 0, GZ]}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[GREENHOUSE_R, 40]} />
          <meshStandardMaterial color={colorHex.surface2} />
        </mesh>
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[GREENHOUSE_R, 0.1, 6, 40]} />
          <meshStandardMaterial color={colorHex.hullDark} />
        </mesh>
        <mesh position={[0, 0.02, 0]} raycast={() => null}>
          <sphereGeometry args={[GREENHOUSE_R, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={0xd7f3f3} transparent opacity={0.16} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.02, 0]} raycast={() => null}>
          <sphereGeometry args={[GREENHOUSE_R + 0.01, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color={0xe8fbfa} wireframe transparent opacity={0.4} />
        </mesh>
      </group>

      {/* ---------------- work bench */}
      <mesh position={[WB_X, 0.31, WB_Z]} geometry={rbox(0.75, 0.62, 1.75, 0.04)} castShadow receiveShadow>
        <meshStandardMaterial color={colorHex.hullDark} />
      </mesh>
      <group ref={soilTray}>
        <mesh position={[WB_X, TOP - 0.06, WB_Z]} geometry={rbox(0.72, 0.13, 1.68, 0.03)}>
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        {SEG_Z.map((z, i) => (
          <group key={z}>
            <mesh position={[WB_X, TOP - 0.005, z]}>
              <boxGeometry args={[0.62, 0.02, 0.4]} />
              <meshStandardMaterial ref={(m) => void (soilMats.current[i] = m)} color={colorHex.marsBrown} roughness={1} />
            </mesh>
            <mesh position={[WB_X, TOP + 0.008, z]} rotation={[-Math.PI / 2, 0, i * Math.PI]}>
              <planeGeometry args={[0.6, 0.39]} />
              <meshStandardMaterial ref={(m) => void (crustMats.current[i] = m)} color={colorHex.text} map={crustTex} transparent opacity={0} depthWrite={false} roughness={1} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={hydroTray} visible={false}>
        <mesh position={[WB_X, TOP - 0.06, WB_Z]} geometry={rbox(0.72, 0.14, 1.68, 0.03)}>
          <meshStandardMaterial color={colorHex.filterNew} roughness={0.4} />
        </mesh>
        <mesh position={[WB_X, TOP + 0.012, WB_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.62, 1.58]} />
          <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accentDim} emissiveIntensity={0.4} transparent opacity={0.6} roughness={0.1} />
        </mesh>
      </group>
      <instancedMesh ref={workLeaves} args={[leafGeo, undefined, WORK_PLANTS.length * LEAVES]} frustumCulled={false} castShadow>
        {leafMat(workLeafMat)}
      </instancedMesh>
      <instancedMesh ref={hardy} args={[hardyGeo, undefined, HARDY.length]} frustumCulled={false}>
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.7} flatShading />
      </instancedMesh>

      {/* ---------------- side benches */}
      {SIDE_Z.map((z) => (
        <group key={z}>
          <mesh position={[SIDE_X, 0.31, z]} geometry={rbox(2.95, 0.62, 0.72, 0.04)} receiveShadow>
            <meshStandardMaterial color={colorHex.hullDark} />
          </mesh>
          <mesh position={[SIDE_X, TOP - 0.06, z]} geometry={rbox(2.9, 0.13, 0.66, 0.03)} material={side.tray} />
        </group>
      ))}
      <group ref={sideSoil}>
        {SIDE_Z.map((z) => (
          <group key={z}>
            <mesh position={[SIDE_X, TOP - 0.005, z]} material={side.soil}>
              <boxGeometry args={[2.8, 0.02, 0.58]} />
            </mesh>
            <mesh position={[SIDE_X, TOP + 0.008, z]} rotation={[-Math.PI / 2, 0, 0]} material={side.crust}>
              <planeGeometry args={[2.78, 0.56]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={sideWater} visible={false}>
        {SIDE_Z.map((z) => (
          <mesh key={z} position={[SIDE_X, TOP + 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.8, 0.58]} />
            <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accentDim} emissiveIntensity={0.4} transparent opacity={0.6} roughness={0.1} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={sideLeaves} args={[leafGeo, undefined, SIDE_PLANTS.length * LEAVES]} frustumCulled={false}>
        {leafMat(sideLeafMat)}
      </instancedMesh>

      {/* ---------------- grow lights */}
      <mesh position={[WB_X, 1.95, WB_Z]} geometry={rbox(0.22, 0.05, 1.5, 0.02)}>
        <meshStandardMaterial ref={stripMat} color={LIGHT} emissive={LIGHT} emissiveIntensity={2.4} />
      </mesh>
      {SIDE_Z.map((z) => (
        <mesh key={z} position={[SIDE_X, 2.05, z]} geometry={rbox(2.4, 0.05, 0.22, 0.02)}>
          <meshStandardMaterial color={LIGHT} emissive={LIGHT} emissiveIntensity={2.2} />
        </mesh>
      ))}
      <pointLight ref={light} position={[-13.6, 2.7, -0.3]} intensity={14} distance={9} color={LIGHT} />

      {/* ---------------- hose reel + nozzle */}
      <mesh position={REEL.toArray()} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.2, 0.06, 8, 18]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.6} />
      </mesh>
      <mesh position={[REEL.x, 0.2, REEL.z]} geometry={rbox(0.12, 0.36, 0.34, 0.03)}>
        <meshStandardMaterial color={colorHex.hullDark} />
      </mesh>
      <group ref={nozzle}>
        <mesh>
          <cylinderGeometry args={[0.025, 0.035, 0.22, 10]} />
          <meshStandardMaterial color={colorHex.metal} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={colorHex.warn} />
        </mesh>
      </group>
      <instancedMesh ref={hose} args={[undefined, undefined, 16]} frustumCulled={false}>
        <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.7} />
      </instancedMesh>
      <Jet origin={s.sprayO} dir={s.sprayDir} rate={() => s.sprayRate} color={colorHex.accent} size={0.06} speed={1.3} spread={0.25} gravity={2.5} life={0.55} />
      <Jet origin={s.bubbleO} dir={s.up} rate={() => s.bubbleRate} color={colorHex.accent} size={0.07} speed={0.5} spread={0.3} life={1.6} opacity={0.6} />

      {/* ---------------- trowel (hardy plants) */}
      <group ref={trowel} visible={false}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.02, 0.022, 0.16, 8]} />
          <meshStandardMaterial color={colorHex.accentDim} />
        </mesh>
        <mesh position={[0, -0.02, 0]} geometry={rbox(0.08, 0.13, 0.015, 0.006)}>
          <meshStandardMaterial color={colorHex.metal} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>

      {/* ---------------- console with the sealing lever */}
      <group position={CON} rotation={[0, CON_YAW, 0]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.04, 0.06, 0.9, 8]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        <group position={[0, 0.98, 0]} rotation={[-0.35, 0, 0]}>
          <mesh geometry={rbox(0.4, 0.28, 0.06, 0.025)}>
            <meshStandardMaterial color={colorHex.hullDark} />
          </mesh>
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[0.34, 0.22]} />
            <meshStandardMaterial ref={screenMat} color={colorHex.bgDeep} emissive={colorHex.accent} emissiveIntensity={0.5} />
          </mesh>
          <mesh ref={o2bar} position={[-0.065, -0.04, 0.036]}>
            <planeGeometry args={[0.26, 0.05]} />
            <meshBasicMaterial color={colorHex.text} />
          </mesh>
        </group>
        <group ref={lever} position={[0.26, 0.82, 0.02]} rotation={[0.25, 0, 0]}>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.035, 0.18, 0.035]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
          <mesh position={[0, 0.19, 0]} geometry={rbox(0.09, 0.06, 0.06, 0.02)}>
            <meshStandardMaterial color={colorHex.warn} />
          </mesh>
        </group>
      </group>
      <Lamp station={ST} rt={rt} work={work} at={[CON[0], 1.33, CON[2]]} />

      {/* ---------------- leak point on the dome */}
      <group ref={crack} position={LEAK_IN.toArray()} quaternion={leakQ}>
        <mesh rotation={[0, 0, 0.5]}>
          <planeGeometry args={[0.32, 0.025]} />
          <meshBasicMaterial color={colorHex.bgDeep} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[0, 0, -0.9]}>
          <planeGeometry args={[0.24, 0.02]} />
          <meshBasicMaterial color={colorHex.bgDeep} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, -0.005]}>
          <ringGeometry args={[0.08, 0.2, 18]} />
          <meshBasicMaterial color={colorHex.text} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <Jet origin={s.steamO} dir={s.steamDir} rate={() => s.steamRate} color={colorHex.text} size={0.22} speed={0.4} spread={0.16} life={1.3} opacity={0.65} />
      <group ref={patch} quaternion={leakQ} visible={false}>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.2, 20]} />
          <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <torusGeometry args={[0.2, 0.025, 6, 20]} />
          <meshStandardMaterial ref={patchRim} color={colorHex.accentDim} emissive={colorHex.ok} emissiveIntensity={0.2} />
        </mesh>
      </group>
      <group ref={tape} position={LEAK_IN.toArray()} quaternion={leakQ} visible={false}>
        {[0.6, -0.6].map((rz) => (
          <mesh key={rz} position={[0, 0, 0.012]} rotation={[0, 0, rz]}>
            <planeGeometry args={[0.42, 0.08]} />
            <meshStandardMaterial color={colorHex.tape} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={tea} args={[undefined, undefined, 10]} frustumCulled={false} visible={false}>
        <planeGeometry args={[0.05, 0.03]} />
        <meshStandardMaterial color={colorHex.plant} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
