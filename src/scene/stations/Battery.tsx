// Battery corner on the hab wall (BATTERY_DEG): cell rack with battery-icon fill bars, a charge
// dial, a breaker panel (greenhouse and heater circuits), a socket with a charging cable, a
// cooling pump with its pipe loop, and a small console. Jobs are acted out on these parts and
// the results stay (from work.chosen): plug in, breakers down, new / borrowed pump, half the
// cells behind a shutter.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { Lamp, Model, powerGlow, RBox, rbox, seg, stationAct, type StationProps } from '../core';
import { BATTERY_DEG, wallPoint, type V3 } from '../world';
import { decay, Jet, layCable, makeCable } from './s1-fx';

const ST = 'battery';
const ANG = (BATTERY_DEG * Math.PI) / 180;
const ORIGIN = wallPoint(BATTERY_DEG, 0, 0);
/** Local frame: +z points into the room (towards the viewer), +x is the viewer's right. */
const ROT: V3 = [0, ANG - Math.PI / 2, 0];

// Rack
const RACK_X = -0.2;
const COLS = [-0.4, 0.0];
const ROWS = [0.38, 0.7, 1.02, 1.34];
const NCELL = COLS.length * ROWS.length;
const CELL_Z = 0.58;
const BAR_W = 0.25;
// Shutter over the right column (halfBattery)
const SHUT_TOP = 1.53;
const SHUT_H = 1.3;
// Dial and console (left column)
const DIAL: V3 = [-0.98, 1.32, 0.34];
const CONSOLE: V3 = [-0.98, 0.86, 0.34];
// Breaker panel (right, below the window sill)
const PANEL: V3 = [0.5, 0.62, 0.3];
const LEVER_X = [-0.13, 0.05];
const LEVER_Y = 0.74;
const LEVER_ON = 0.25;
const LEVER_OFF = Math.PI - 0.25;
const SOCKET: V3 = [0.66, 0.42, 0.37];
const PLUG_IN = new THREE.Vector3(0.66, 0.42, 0.43);
const PLUG_PRE = new THREE.Vector3(0.66, 0.42, 0.66);
const PLUG_REST = new THREE.Vector3(0.48, 0.06, 0.78);
const CABLE_FROM = new THREE.Vector3(0.88, 0.28, 0.62);
// Pumps
const SEAT = new THREE.Vector3(-1.0, 0.17, 0.42);
const SEAT_FRONT = new THREE.Vector3(-1.0, 0.25, 0.8);
const BOOST = new THREE.Vector3(-1.0, 0.17, 0.86);
const ASIDE = new THREE.Vector3(-1.38, 0.13, 1.02);
const NEW_FROM = new THREE.Vector3(-0.3, 0.6, 1.35);
const BORROW_FROM = new THREE.Vector3(-1.8, 0.65, 1.15);

const FILL_OK = colorHex.ok;
const FILL_LOW = colorHex.warn;
const FILL_EMPTY = colorHex.danger;

// ------------------------------------------------------------------ what the state says

/** Shown battery fill. Sol 8 is dramatised: empty storm reserve until charged, full / half after. */
function shownFill(w: WorkLook) {
  let f = w.charge;
  const c = w.chosen.s8_charge;
  if (w.open.includes('s8_charge') || (w.sol === 8 && c === 'defer')) f = Math.min(f, 0.15);
  else if (w.sol === 8 && c === 'full') f = Math.max(f, 1);
  else if (w.sol === 8 && c === 'half') f = Math.max(f, 0.55);
  return f;
}
const isHot = (w: WorkLook) => w.open.includes('s14_pump') || w.open.includes('s14_radiator');
const hotAge = (w: WorkLook) => Math.max(w.age.s14_pump ?? 0, w.age.s14_radiator ?? 0);
const halfOff = (w: WorkLook) => w.chosen.s14_pump === 'halfBattery' || w.chosen.s14_radiator === 'halfBattery';
const plugged = (w: WorkLook) => w.sol >= 8 && (w.chosen.s8_charge === 'full' || w.chosen.s8_charge === 'half');
const mainPump = (w: WorkLook): 'old' | 'new' | 'borrowed' =>
  w.chosen.s14_pump === 'replacePump' ? 'new' : w.chosen.s14_pump === 'borrowPump' ? 'borrowed' : 'old';
const booster = (w: WorkLook) => w.chosen.s14_radiator === 'borrowPump';

// ------------------------------------------------------------------ parts

/** A cooling pump: body, motor, fan (spins when it works). */
function Pump({ body, motor, fanRef, groupRef }: { body: number; motor: number; fanRef: (o: THREE.Group | null) => void; groupRef: (o: THREE.Group | null) => void }) {
  return (
    <group ref={groupRef}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.3, 16]} />
        <meshStandardMaterial color={body} roughness={0.5} metalness={0.3} />
      </mesh>
      <RBox size={[0.14, 0.2, 0.2]} r={0.03} position={[0.2, 0, 0]} color={motor} />
      <group ref={fanRef} position={[-0.165, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 14]} />
          <meshStandardMaterial color={colorHex.bgDeep} />
        </mesh>
        <mesh position={[-0.015, 0, 0]}>
          <boxGeometry args={[0.012, 0.18, 0.035]} />
          <meshStandardMaterial color={colorHex.text} />
        </mesh>
      </group>
    </group>
  );
}

const deg = (d: number) => (d * Math.PI) / 180;

export default function Battery({ rt, work }: StationProps) {
  const root = useRef<THREE.Group>(null);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const windows = useRef<THREE.InstancedMesh>(null);
  const bars = useRef<THREE.InstancedMesh>(null);
  const barMat = useRef<THREE.MeshBasicMaterial>(null);
  const shutter = useRef<THREE.Group>(null);
  const stripe = useRef<THREE.Mesh>(null);
  const heatMat = useRef<THREE.MeshStandardMaterial>(null);
  const needle = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const cbars = useRef<THREE.InstancedMesh>(null);
  const cbarMat = useRef<THREE.MeshBasicMaterial>(null);
  const tick = useRef<THREE.Group>(null);
  const levers = useRef<(THREE.Group | null)[]>([null, null]);
  const ledMats = useRef<(THREE.MeshStandardMaterial | null)[]>([null, null]);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const plug = useRef<THREE.Group>(null);
  const cable = useRef<THREE.InstancedMesh>(null);
  const pumps = useRef<Record<'old' | 'new' | 'borrowed', THREE.Group | null>>({ old: null, new: null, borrowed: null });
  const fans = useRef<Record<'old' | 'new' | 'borrowed', THREE.Group | null>>({ old: null, new: null, borrowed: null });

  const s = useMemo(
    () => ({
      o: new THREE.Object3D(),
      col: new THREE.Color(),
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      plugBack: new THREE.Vector3(),
      cable: makeCable(),
      fill: -1,
      shut: -1,
      levers: [LEVER_ON, LEVER_ON],
      flash: 0,
      lastPhase: 'none' as string,
      steamOrigin: new THREE.Vector3(RACK_X, 1.62, 0.35),
      steamDir: new THREE.Vector3(0, 1, 0.12),
      steamRate: 0,
    }),
    [],
  );

  // Static instances: cell bodies and the dark battery-icon windows.
  useLayoutEffect(() => {
    const o = s.o;
    for (let i = 0; i < NCELL; i++) {
      const x = RACK_X + COLS[i % 2]!;
      const y = ROWS[Math.floor(i / 2)]!;
      o.position.set(x, y, CELL_Z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      bodies.current?.setMatrixAt(i, o.matrix);
      o.position.set(x, y, CELL_Z + 0.042);
      o.updateMatrix();
      windows.current?.setMatrixAt(i, o.matrix);
    }
    // Create the per-instance colours before the first render (the shader needs them).
    for (let i = 0; i < NCELL; i++) bars.current?.setColorAt(i, s.col.setHex(FILL_OK));
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (windows.current) windows.current.instanceMatrix.needsUpdate = true;
  }, [s]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const R = rt.current;
    const a = stationAct(R, ST);
    const w = a && a.before ? a.from : work;
    const doing = !!a && a.before;
    const p = a ? a.p : 0;
    const opt = a?.optionId ?? null;
    const glow = powerGlow(w.power);

    // Finish moment: flash + puff at the part that was worked on.
    const phase = a?.phase ?? 'none';
    if (phase === 'finish' && s.lastPhase !== 'finish' && a && a.kind !== 'wait') {
      s.flash = 1;
      const at =
        a.kind === 'plug' ? s.v.set(SOCKET[0], SOCKET[1], SOCKET[2] + 0.1)
        : a.kind === 'switch' && opt === 'halfBattery' ? s.v.set(RACK_X, 0.9, 0.7)
        : a.kind === 'switch' ? s.v.set(PANEL[0], LEVER_Y, 0.45)
        : a.kind === 'replace' ? s.v.copy(opt === 'borrowPump' && a.faultId === 's14_radiator' ? BOOST : SEAT)
        : s.v.set(CONSOLE[0], CONSOLE[1], CONSOLE[2] + 0.1);
      if (root.current) R.puff(root.current.localToWorld(s.w.copy(at)), 6);
    }
    s.lastPhase = phase;
    s.flash = decay(s.flash, dt, 0.9);

    // ---- charge fill (cells + dial)
    const target = shownFill(w);
    if (s.fill < 0) s.fill = target;
    if (a && a.kind === 'plug' && doing) s.fill = THREE.MathUtils.lerp(shownFill(a.from), shownFill(a.to), seg(p, 0.55, 1));
    else s.fill += (target - s.fill) * (1 - Math.exp(-dt * 3));
    const fill = s.fill;
    const charging = !!a && a.kind === 'plug' && phase !== 'wait' && p > 0.5;

    // ---- shutter over the right column
    let shut = halfOff(w) ? 1 : 0;
    if (doing && opt === 'halfBattery') shut = seg(p, 0.12, 0.8);
    if (s.shut < 0) s.shut = shut;
    s.shut += (shut - s.shut) * (doing ? 1 : 1 - Math.exp(-dt * 4));
    const sh = s.shut;
    if (shutter.current) {
      shutter.current.visible = sh > 0.02;
      shutter.current.scale.y = Math.max(0.02, sh);
    }
    if (stripe.current) {
      stripe.current.visible = sh > 0.02;
      stripe.current.position.y = SHUT_TOP - SHUT_H * sh - 0.02;
    }
    const shutBottom = SHUT_TOP - SHUT_H * sh;

    // ---- cell bars (battery icons): rows fill bottom-up, so "how many full" reads the charge
    const m = bars.current;
    if (m) {
      const base = fill < 0.2 ? FILL_EMPTY : fill < 0.5 ? FILL_LOW : FILL_OK;
      const wave = charging ? (t * 2.2) % 1 : -1;
      for (let i = 0; i < NCELL; i++) {
        const c = i % 2;
        const r = Math.floor(i / 2);
        const y = ROWS[r]!;
        const off = c === 1 && shutBottom < y + 0.13;
        const level = off ? 0 : Math.max(0, Math.min(1, fill * ROWS.length - r));
        const k = Math.max(0.03, level);
        s.o.position.set(RACK_X + COLS[c]! - BAR_W / 2 + (BAR_W * k) / 2, y, CELL_Z + 0.046);
        s.o.rotation.set(0, 0, 0);
        s.o.scale.set(k, 1, 1);
        s.o.updateMatrix();
        m.setMatrixAt(i, s.o.matrix);
        const pulse = wave >= 0 && Math.abs(wave * ROWS.length - r - 0.5) < 0.5 ? 0.6 : 0;
        s.col.setHex(off ? colorHex.border : base).multiplyScalar(off ? 0.35 : Math.min(1.6, glow * (0.85 + pulse) + s.flash * 0.5));
        m.setColorAt(i, s.col);
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    if (needle.current) needle.current.rotation.z = deg(120) - deg(240) * Math.max(0, Math.min(1, fill));

    // ---- heat: steam above the rack, red pulsing strip, pump fan stopped
    const hot = isHot(w);
    s.steamRate = hot ? 0.45 + 0.3 * Math.min(3, hotAge(w)) : 0;
    if (heatMat.current) {
      const hm = heatMat.current;
      if (hot) {
        hm.color.setHex(colorHex.danger);
        hm.emissive.setHex(colorHex.danger);
        hm.emissiveIntensity = 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(t * 6));
      } else {
        hm.color.setHex(colorHex.accentDim);
        hm.emissive.setHex(colorHex.accent);
        hm.emissiveIntensity = (0.35 + s.flash) * glow;
      }
    }

    // ---- breakers: greenhouse (0) and heater (1)
    const offs = [w.chosen.s9_shed === 'greenhouseOff', w.chosen.s9_shed === 'heaterDown'];
    for (let i = 0; i < 2; i++) {
      let rx = offs[i] ? LEVER_OFF : LEVER_ON;
      let lit = !offs[i];
      const mine = doing && a!.faultId === 's9_shed' && opt === (i === 0 ? 'greenhouseOff' : 'heaterDown');
      if (mine) {
        const k = seg(p, 0.1, 0.6);
        rx = LEVER_ON + (LEVER_OFF - LEVER_ON) * k;
        lit = p < 0.62 || Math.sin(t * 40) > 0.6;
        if (p > 0.75) lit = false;
      }
      s.levers[i] = s.levers[i]! + (rx - s.levers[i]!) * (mine ? 1 : 1 - Math.exp(-dt * 6));
      const lv = levers.current[i];
      if (lv) lv.rotation.x = s.levers[i]!;
      const lm = ledMats.current[i];
      if (lm) {
        lm.color.setHex(lit ? colorHex.ok : colorHex.bgDeep);
        lm.emissive.setHex(colorHex.ok);
        lm.emissiveIntensity = lit ? 1.4 * glow : 0;
      }
    }

    // ---- plug + cable
    const pl = plug.current;
    if (pl) {
      let rx = Math.PI / 2;
      if (doing && a!.kind === 'plug') {
        const k1 = seg(p, 0.02, 0.35);
        const k2 = seg(p, 0.35, 0.55);
        pl.position.copy(PLUG_REST).lerp(PLUG_PRE, k1).lerp(PLUG_IN, k2);
        rx = (1 - k1) * Math.PI / 2;
      } else if (plugged(w)) {
        pl.position.copy(PLUG_IN);
        rx = 0;
      } else pl.position.copy(PLUG_REST);
      pl.rotation.x = rx;
      // Back of the plug (cable end): local +z rotated about x.
      s.plugBack.set(0, -Math.sin(rx) * 0.07, Math.cos(rx) * 0.07).add(pl.position);
      if (cable.current) layCable(cable.current, s.cable, CABLE_FROM, s.plugBack, 0.3);
    }
    if (ringMat.current) {
      const on = plugged(w) || (doing && a!.kind === 'plug' && p > 0.55);
      ringMat.current.emissive.setHex(on ? colorHex.ok : colorHex.accentDim);
      ringMat.current.emissiveIntensity = (on ? (charging ? 1 + 0.8 * Math.sin(t * 9) : 0.9) : 0.15) * glow;
    }

    // ---- pumps
    const P = pumps.current;
    const F = fans.current;
    const main = mainPump(w);
    const boost = booster(w);
    if (P.old && P.new && P.borrowed) {
      // Rest poses from the state.
      P.old.visible = true;
      if (main === 'old') {
        P.old.position.copy(SEAT);
        P.old.rotation.set(0, 0, 0);
      } else {
        P.old.position.copy(ASIDE);
        P.old.rotation.set(0, 0.6, 0.35);
      }
      P.new.visible = main === 'new';
      P.new.position.copy(SEAT);
      P.new.rotation.set(0, 0, 0);
      P.borrowed.visible = main === 'borrowed' || boost;
      P.borrowed.position.copy(main === 'borrowed' ? SEAT : BOOST);
      P.borrowed.rotation.set(0, 0, 0);
      // The swap, acted out.
      if (doing && a!.kind === 'replace') {
        const toBoost = a!.faultId === 's14_radiator';
        const incoming = opt === 'borrowPump' ? P.borrowed : P.new;
        if (!toBoost) {
          const k1 = seg(p, 0.0, 0.25);
          const k2 = seg(p, 0.22, 0.45);
          P.old.position.copy(SEAT).lerp(SEAT_FRONT, k1).lerp(ASIDE, k2);
          P.old.rotation.set(0, 0.6 * k2, 0.35 * k2);
        }
        const end = toBoost ? BOOST : SEAT;
        const k3 = seg(p, 0.42, 0.78);
        const k4 = seg(p, 0.76, 0.95);
        incoming.visible = p > 0.4;
        incoming.position.copy(opt === 'borrowPump' ? BORROW_FROM : NEW_FROM).lerp(SEAT_FRONT, k3);
        if (toBoost) incoming.position.x += (BOOST.x - SEAT_FRONT.x) * k3;
        incoming.position.lerp(end, k4);
        incoming.rotation.set(0, (1 - k3) * 0.8, 0);
      }
      // Fans: the pump in the seat runs unless it is the broken one (or there is no power).
      const spin = dt * 14 * (w.power === 'off' ? 0 : 1);
      const brokenSeat = w.open.includes('s14_pump');
      if (F.old && main === 'old' && !brokenSeat && !(doing && a!.kind === 'replace' && a!.faultId === 's14_pump')) F.old.rotation.x += spin;
      const newRuns = !doing || a!.kind !== 'replace' || p > 0.95;
      if (F.new && P.new.visible && newRuns) F.new.rotation.x += spin;
      if (F.borrowed && P.borrowed.visible && newRuns) F.borrowed.rotation.x += spin * 1.2;
    }

    // ---- console: screen + bars (tune: bars jump, then settle even)
    const alarm = !!w.alarm[ST];
    if (screenMat.current) {
      const sm = screenMat.current;
      const ok = s.flash > 0.05 && a?.routineId === 'tune';
      sm.emissive.setHex(alarm ? colorHex.danger : ok ? colorHex.ok : colorHex.accent);
      sm.emissiveIntensity = (alarm ? (Math.sin(t * 7) > 0 ? 1.0 : 0.3) : 0.55 + s.flash * 0.8) * glow;
    }
    const cb = cbars.current;
    if (cb) {
      const tuning = doing && a!.kind === 'console';
      const settle = tuning ? seg(p, 0.25, 0.95) : a && a.kind === 'console' ? 1 : 0;
      for (let i = 0; i < 5; i++) {
        const calm = [0.5, 0.8, 0.55, 0.9, 0.65][i]! * (0.9 + 0.1 * Math.sin(t * 2 + i));
        const wild = 0.5 + 0.45 * Math.sin(t * 13 + i * 2.1);
        const base = tuning ? wild : calm;
        const h = Math.max(0.05, base + (0.78 - base) * settle);
        s.o.position.set(-0.12 + i * 0.06, -0.09, 0.04);
        s.o.rotation.set(0, 0, 0);
        s.o.scale.set(1, h * 0.17, 1);
        s.o.updateMatrix();
        cb.setMatrixAt(i, s.o.matrix);
      }
      cb.instanceMatrix.needsUpdate = true;
    }
    if (cbarMat.current) cbarMat.current.color.setHex(colorHex.text).multiplyScalar(Math.max(0.1, glow));
    if (tick.current) tick.current.visible = phase === 'finish' && a?.routineId === 'tune';
  });

  const barGeo = useMemo(() => new THREE.PlaneGeometry(BAR_W, 0.095), []);
  const cbarGeo = useMemo(() => new THREE.PlaneGeometry(0.042, 1).translate(0, 0.5, 0), []);

  return (
    <group ref={root} position={ORIGIN} rotation={ROT}>
      {/* ---------------- rack */}
      <RBox size={[0.9, 1.52, 0.5]} position={[RACK_X, 0.86, 0.3]} color={colorHex.hullDark} />
      <RBox size={[0.94, 0.08, 0.54]} position={[RACK_X, 0.06, 0.3]} color={colorHex.metal} />
      <instancedMesh ref={bodies} args={[undefined, undefined, NCELL]} geometry={rbox(0.36, 0.26, 0.08, 0.025)} frustumCulled={false} receiveShadow>
        <meshStandardMaterial color={colorHex.surface2} roughness={0.5} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={windows} args={[undefined, undefined, NCELL]} frustumCulled={false}>
        <planeGeometry args={[0.29, 0.125]} />
        <meshBasicMaterial color={colorHex.bgDeep} />
      </instancedMesh>
      {/* Battery-icon terminal nubs (one strip per column). */}
      {COLS.map((c) => (
        <mesh key={c} position={[RACK_X + c + 0.158, 0.86, CELL_Z + 0.042]}>
          <planeGeometry args={[0.022, 1.0]} />
          <meshBasicMaterial color={colorHex.surface} />
        </mesh>
      ))}
      <instancedMesh ref={bars} args={[barGeo, undefined, NCELL]} frustumCulled={false}>
        <meshBasicMaterial ref={barMat} color={0xffffff} toneMapped={false} />
      </instancedMesh>
      {/* Heat strip on the rack top: teal when cool, red-magenta pulsing when hot. */}
      <mesh position={[RACK_X, 1.575, 0.556]}>
        <boxGeometry args={[0.8, 0.05, 0.02]} />
        <meshStandardMaterial ref={heatMat} color={colorHex.accentDim} emissive={colorHex.accent} emissiveIntensity={0.3} />
      </mesh>
      <Jet origin={s.steamOrigin} dir={s.steamDir} rate={() => s.steamRate} color={colorHex.text} size={0.16} speed={0.45} spread={0.18} life={1.5} opacity={0.6} />
      {/* Shutter (halfBattery): rolls down over the right column. */}
      <group ref={shutter} position={[RACK_X + COLS[1]!, SHUT_TOP, 0.665]} visible={false}>
        <mesh position={[0, -SHUT_H / 2, 0]} geometry={rbox(0.42, SHUT_H, 0.03, 0.012)}>
          <meshStandardMaterial color={colorHex.metal} roughness={0.6} metalness={0.4} />
        </mesh>
      </group>
      <mesh ref={stripe} position={[RACK_X + COLS[1]!, SHUT_TOP, 0.684]} visible={false}>
        <planeGeometry args={[0.42, 0.04]} />
        <meshBasicMaterial color={colorHex.warn} />
      </mesh>
      <Lamp station={ST} rt={rt} work={work} at={[RACK_X, 1.72, 0.45]} />

      {/* ---------------- coolant loop */}
      <mesh position={[-0.7, 0.92, 0.2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.5, 10]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-0.35, 1.66, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-0.6, 0.1, 0.24]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 10]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-0.7, 1.66, 0.2]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
      <Pump body={colorHex.metal} motor={colorHex.hullDark} groupRef={(o) => void (pumps.current.old = o)} fanRef={(o) => void (fans.current.old = o)} />
      <Pump body={colorHex.hull} motor={colorHex.accentDim} groupRef={(o) => void (pumps.current.new = o)} fanRef={(o) => void (fans.current.new = o)} />
      <Pump body={colorHex.accent} motor={colorHex.hull} groupRef={(o) => void (pumps.current.borrowed = o)} fanRef={(o) => void (fans.current.borrowed = o)} />
      <Model
        name="machine_barrel"
        position={[-1.6, 0, 0.45]}
        rotation={[0, Math.PI / 2, 0]}
        scale={0.9}
        shadows={false}
        fallback={<RBox size={[0.5, 0.55, 0.5]} position={[-1.6, 0.28, 0.45]} color={colorHex.hullDark} />}
      />

      {/* ---------------- charge dial */}
      <group position={DIAL}>
        <RBox size={[0.42, 0.42, 0.06]} r={0.03} color={colorHex.metal} />
        <mesh position={[0, 0, 0.032]}>
          <circleGeometry args={[0.17, 28]} />
          <meshStandardMaterial color={colorHex.text} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.036]}>
          <ringGeometry args={[0.12, 0.155, 10, 1, deg(162), deg(48)]} />
          <meshBasicMaterial color={colorHex.danger} />
        </mesh>
        <mesh position={[0, 0, 0.036]}>
          <ringGeometry args={[0.12, 0.155, 12, 1, deg(90), deg(72)]} />
          <meshBasicMaterial color={colorHex.warn} />
        </mesh>
        <mesh position={[0, 0, 0.036]}>
          <ringGeometry args={[0.12, 0.155, 16, 1, deg(-30), deg(120)]} />
          <meshBasicMaterial color={colorHex.ok} />
        </mesh>
        <group ref={needle} position={[0, 0, 0.042]}>
          <mesh position={[0, 0.065, 0]}>
            <boxGeometry args={[0.02, 0.14, 0.008]} />
            <meshBasicMaterial color={colorHex.bgDeep} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.048]}>
          <circleGeometry args={[0.025, 12]} />
          <meshBasicMaterial color={colorHex.metal} />
        </mesh>
      </group>

      {/* ---------------- console */}
      <group position={CONSOLE}>
        <RBox size={[0.42, 0.32, 0.06]} r={0.025} color={colorHex.metal} />
        <mesh position={[0, 0, 0.032]}>
          <planeGeometry args={[0.36, 0.25]} />
          <meshStandardMaterial ref={screenMat} color={colorHex.bgDeep} emissive={colorHex.accent} emissiveIntensity={0.5} />
        </mesh>
        <instancedMesh ref={cbars} args={[cbarGeo, undefined, 5]} frustumCulled={false}>
          <meshBasicMaterial ref={cbarMat} color={colorHex.text} />
        </instancedMesh>
        <group ref={tick} position={[0.12, 0.05, 0.045]} visible={false}>
          <mesh position={[-0.025, -0.015, 0]} rotation={[0, 0, deg(45)]}>
            <planeGeometry args={[0.018, 0.06]} />
            <meshBasicMaterial color={colorHex.ok} />
          </mesh>
          <mesh position={[0.015, 0.005, 0]} rotation={[0, 0, deg(-35)]}>
            <planeGeometry args={[0.018, 0.11]} />
            <meshBasicMaterial color={colorHex.ok} />
          </mesh>
        </group>
      </group>

      {/* ---------------- breaker panel: greenhouse + heater circuits, socket */}
      <group position={[PANEL[0], 0, 0]}>
        <RBox size={[0.5, 0.66, 0.1]} r={0.03} position={[0, PANEL[1], PANEL[2]]} color={colorHex.hullDark} />
        {LEVER_X.map((x, i) => (
          <group key={i}>
            <group ref={(o) => void (levers.current[i] = o)} position={[x, LEVER_Y, 0.36]} rotation={[LEVER_ON, 0, 0]}>
              <mesh position={[0, 0.09, 0]}>
                <boxGeometry args={[0.035, 0.18, 0.035]} />
                <meshStandardMaterial color={colorHex.metal} metalness={0.5} />
              </mesh>
              <RBox size={[0.1, 0.06, 0.06]} r={0.02} position={[0, 0.19, 0]} color={colorHex.warn} />
            </group>
            <mesh position={[x + 0.08, 0.89, 0.36]}>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial ref={(m) => void (ledMats.current[i] = m)} color={colorHex.ok} emissive={colorHex.ok} emissiveIntensity={1} />
            </mesh>
          </group>
        ))}
        {/* Circuit icons under the levers: a leaf (greenhouse), heater coils (heater). */}
        <mesh position={[LEVER_X[0]!, 0.6, 0.36]} rotation={[0, 0, deg(-30)]} scale={[1, 1, 0.4]}>
          <coneGeometry args={[0.03, 0.08, 6]} />
          <meshStandardMaterial color={colorHex.plant} />
        </mesh>
        <mesh position={[LEVER_X[1]!, 0.6, 0.36]}>
          <torusGeometry args={[0.028, 0.008, 6, 14]} />
          <meshStandardMaterial color={colorHex.danger} />
        </mesh>
        {/* Socket */}
        <mesh position={[SOCKET[0] - PANEL[0], SOCKET[1], SOCKET[2]]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.03, 18]} />
          <meshStandardMaterial color={colorHex.bgDeep} />
        </mesh>
        <mesh position={[SOCKET[0] - PANEL[0], SOCKET[1], SOCKET[2] + 0.017]}>
          <torusGeometry args={[0.068, 0.012, 6, 20]} />
          <meshStandardMaterial ref={ringMat} color={colorHex.metal} emissive={colorHex.accentDim} emissiveIntensity={0.2} />
        </mesh>
      </group>
      <group ref={plug}>
        <RBox size={[0.1, 0.1, 0.12]} r={0.025} color={colorHex.hull} />
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[0.07, 0.07, 0.03]} />
          <meshStandardMaterial color={colorHex.accentDim} />
        </mesh>
      </group>
      <instancedMesh ref={cable} args={[undefined, undefined, 14]} frustumCulled={false}>
        <cylinderGeometry args={[0.016, 0.016, 1, 6]} />
        <meshStandardMaterial color={colorHex.bgDeep} roughness={0.8} />
      </instancedMesh>
      {/* Charger unit on the floor (the cable comes from here). */}
      <Model
        name="machine_generator"
        position={[1.05, 0, 0.55]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={0.75}
        shadows={false}
        fallback={<RBox size={[0.5, 0.35, 0.6]} position={[1.05, 0.18, 0.6]} color={colorHex.hullDark} />}
      />
    </group>
  );
}
