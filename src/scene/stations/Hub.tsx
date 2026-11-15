// Hub work point (north wall of the hab): the life-support bay.
// Top: air fans (wake-up, oxygen). Middle left: filter slot. Middle right: console screen
// and breaker levers. Bottom: water pump unit, valve wheel on the pipe, beacon socket.
// Every hub choice is acted out on one of these; results stay (new filter, tape, fans
// running, shiny pump, oil can, beacon cable plugged in).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import { Fountain, Lamp, powerGlow, RBox, seg, stationAct, type StationProps } from '../core';
import type { WorkLook } from '../look';
import { type V3 } from '../world';

const WALL_Z = -5.62; // cabinet centre depth
const FRONT = -5.36; // cabinet front face
const SLOT: V3 = [-0.42, 1.18, 0];
const Z0 = -5.33; // cartridge seated
const SCREEN: V3 = [0.5, 1.58, FRONT + 0.05];
const FAN: V3 = [-0.05, 2.12, FRONT + 0.02];
const PUMP: V3 = [-0.25, 0.42, -5.2];
const VALVE: V3 = [0.98, 0.78, -5.2];
const SOCKET: V3 = [0.62, 0.62, FRONT + 0.02];

/** Console screen drawn on a canvas: bars, a message envelope, a send wave, an alarm. */
function useScreen() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const draw = (mode: 'idle' | 'alarm' | 'message' | 'schedule' | 'beacon', p: number, t: number, alarmOn: boolean) => {
      g.fillStyle = mode === 'alarm' ? (alarmOn ? '#5a1d3a' : '#2a1426') : '#0c2430';
      g.fillRect(0, 0, 256, 160);
      g.strokeStyle = 'rgba(56,208,214,0.35)';
      g.lineWidth = 1;
      for (let y = 20; y < 160; y += 20) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(256, y);
        g.stroke();
      }
      if (mode === 'alarm') {
        g.fillStyle = alarmOn ? '#e2457f' : '#7a2a4c';
        g.beginPath();
        g.moveTo(128, 30);
        g.lineTo(180, 125);
        g.lineTo(76, 125);
        g.closePath();
        g.fill();
        g.fillStyle = '#1d2030';
        g.fillRect(123, 60, 10, 38);
        g.fillRect(123, 104, 10, 10);
        return void (tex.needsUpdate = true);
      }
      if (mode === 'message') {
        // Envelope, typed lines, then a wave travelling up to the dish.
        g.fillStyle = '#38d0d6';
        g.fillRect(24, 40, 90, 60);
        g.fillStyle = '#0c2430';
        g.beginPath();
        g.moveTo(24, 40);
        g.lineTo(69, 75);
        g.lineTo(114, 40);
        g.closePath();
        g.fill();
        const lines = Math.floor(seg(p, 0, 0.6) * 5);
        g.fillStyle = '#bcc5da';
        for (let i = 0; i < lines; i++) g.fillRect(130, 38 + i * 14, 70 + ((i * 37) % 40), 6);
        if (p > 0.6) {
          g.strokeStyle = '#3ccf9e';
          g.lineWidth = 3;
          for (let k = 0; k < 3; k++) {
            const r = ((t * 60 + k * 25) % 75) + 5;
            g.beginPath();
            g.arc(200, 140, r, Math.PI * 1.15, Math.PI * 1.85);
            g.stroke();
          }
        }
        return void (tex.needsUpdate = true);
      }
      if (mode === 'schedule') {
        // A day/night bar chart being set to "half at night".
        for (let i = 0; i < 12; i++) {
          const night = i >= 6;
          const h = night ? 60 - seg(p, 0.1, 0.8) * 30 : 60;
          g.fillStyle = night ? '#b98ab8' : '#38d0d6';
          g.fillRect(14 + i * 19, 140 - h, 13, h);
        }
        return void (tex.needsUpdate = true);
      }
      if (mode === 'beacon') {
        const lvl = p;
        g.fillStyle = '#f0d64a';
        g.beginPath();
        g.arc(128, 80, 10 + lvl * 30, 0, Math.PI * 2);
        g.globalAlpha = 0.35;
        g.fill();
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(128, 80, 10, 0, Math.PI * 2);
        g.fill();
        return void (tex.needsUpdate = true);
      }
      // Idle: three moving status bars.
      for (let i = 0; i < 3; i++) {
        const v = 0.55 + Math.sin(t * (0.6 + i * 0.3) + i) * 0.15;
        g.fillStyle = ['#38d0d6', '#3ccf9e', '#bcc5da'][i]!;
        g.fillRect(20, 30 + i * 40, 216 * v, 18);
      }
      tex.needsUpdate = true;
    };
    return { tex, draw };
  }, []);
}

function Cartridge({ dirty, matRef }: { dirty: boolean; matRef?: React.Ref<THREE.MeshStandardMaterial> }) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.5, 22]} />
        <meshStandardMaterial ref={matRef} color={dirty ? colorHex.filterDirty : colorHex.filterNew} roughness={0.7} />
      </mesh>
      {/* Pleats. */}
      {[-0.15, -0.05, 0.05].map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z]}>
          <torusGeometry args={[0.152, 0.008, 4, 22]} />
          <meshStandardMaterial color={dirty ? 0x4d3d3b : 0xd5dbe5} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.19]}>
        <cylinderGeometry args={[0.158, 0.158, 0.06, 22]} />
        <meshStandardMaterial color={dirty ? colorHex.metal : colorHex.accent} emissive={dirty ? 0 : colorHex.accent} emissiveIntensity={dirty ? 0 : 0.35} />
      </mesh>
      <mesh position={[0, 0, 0.26]}>
        <torusGeometry args={[0.07, 0.018, 8, 16]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
    </>
  );
}

export default function Hub({ rt, work }: StationProps) {
  const oldC = useRef<THREE.Group>(null);
  const newC = useRef<THREE.Group>(null);
  const oldMat = useRef<THREE.MeshStandardMaterial>(null);
  const lock = useRef<THREE.Mesh>(null);
  const tape = useRef<THREE.Group>(null);
  const fans = useRef<THREE.Group>(null);
  const fanGlow = useRef<THREE.MeshStandardMaterial>(null);
  const levers = useRef<THREE.Group>(null);
  const valve = useRef<THREE.Group>(null);
  const water = useRef<THREE.MeshStandardMaterial>(null);
  const pump = useRef<THREE.Group>(null);
  const pumpLid = useRef<THREE.Group>(null);
  const pumpMat = useRef<THREE.MeshStandardMaterial>(null);
  const oilCan = useRef<THREE.Group>(null);
  const plug = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const screen = useScreen();
  const st = useMemo(() => ({ fanAngle: 0, fanSpeed: 0, spark: 0, puff: 0, drip: 0, flow: 0 }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const a = stationAct(rt.current, 'hub');
    const w: WorkLook = a && a.before ? a.from : work;
    const p = a ? a.p : 0;
    const doing = !!a && (a.phase === 'do' || a.phase === 'finish');
    const fid = a?.faultId ?? null;
    const oid = a?.optionId ?? null;
    const glow = powerGlow(work.power);

    // ---------------- filter slot
    const o = oldC.current;
    const n = newC.current;
    if (o && n) {
      o.visible = w.filter !== 'new';
      n.visible = w.filter === 'new';
      o.position.set(SLOT[0], SLOT[1], Z0);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(1);
      n.position.set(SLOT[0], SLOT[1], Z0);
      if (oldMat.current) oldMat.current.color.setHex(w.filter === 'clogged' ? colorHex.filterDirty : 0x9aa1b3);
      if (lock.current) lock.current.rotation.z = 0;
      if (tape.current) {
        tape.current.visible = w.filter === 'taped';
        tape.current.children.forEach((c) => (c.visible = true));
      }
      const filterJob = fid === 's2_filter' || fid === 's10_co2';
      if (a && filterJob && a.kind === 'replace') {
        // Slow and readable: unlock, pull out, set aside, bring the new one, push in, lock.
        const unlock = seg(p, 0, 0.1);
        const pull = seg(p, 0.08, 0.32);
        const aside = seg(p, 0.32, 0.5);
        const bring = seg(p, 0.48, 0.62);
        const push = seg(p, 0.62, 0.88);
        if (lock.current) lock.current.rotation.z = unlock * 1.2 - seg(p, 0.88, 0.97) * 1.2;
        o.visible = p < 0.5;
        o.position.set(SLOT[0] - aside * 0.8, SLOT[1] - aside * 1.0, Z0 + pull * 0.6 + aside * 0.15);
        o.rotation.set(aside * 0.6, 0, aside * 0.4);
        n.visible = p >= 0.48;
        n.position.set(SLOT[0] + (1 - bring) * 0.6, SLOT[1] - (1 - bring) * 0.5, Z0 + 0.6 * (1 - push) + (1 - bring) * 0.45);
        if (doing && pull > 0.05 && pull < 0.95 && (st.puff += dt * 8) > 1) {
          st.puff = 0;
          rt.current.puff(new THREE.Vector3(SLOT[0], SLOT[1], Z0 + 0.35 + pull * 0.5), 2);
        }
      }
      if (a && filterJob && a.kind === 'patch' && tape.current) {
        tape.current.visible = true;
        tape.current.children.forEach((c, i) => (c.visible = p > 0.12 + i * 0.25));
      }
      if (a && filterJob && a.kind === 'wipe' && doing) {
        // Tap / shake: the cartridge comes half out and shakes, dust falls.
        const out = seg(p, 0, 0.2) * (1 - seg(p, 0.8, 1));
        o.position.z = Z0 + out * 0.35;
        o.rotation.z = Math.sin(t * 30) * 0.08 * out;
        if ((st.puff += dt * 10) > 1 && out > 0.5) {
          st.puff = 0;
          rt.current.puff(new THREE.Vector3(SLOT[0], SLOT[1] - 0.1, Z0 + 0.4), 2);
        }
      }
    }

    // ---------------- fans (wake-up / oxygen): stopped until woken, faster at full power
    const awake = !w.open.includes('s1_wakeup') && glow > 0.1;
    let target = awake ? (w.chosen.s5_oxygen === 'fullPower' && w.sol === 5 ? 2.5 : 1) * glow : 0;
    if (a && fid === 's1_wakeup') target = (oid === 'allAtOnce' ? seg(p, 0.2, 0.4) : seg(p, 0.1, 0.9)) * 1.4;
    if (a && fid === 's5_oxygen' && oid === 'fullPower') target = 1 + seg(p, 0.2, 0.9) * 2;
    st.fanSpeed += (target - st.fanSpeed) * (1 - Math.exp(-dt * 2));
    st.fanAngle += st.fanSpeed * dt * 12;
    if (fans.current) fans.current.children.forEach((c, i) => (c.rotation.z = st.fanAngle * (i % 2 ? -1 : 1)));
    if (fanGlow.current) fanGlow.current.emissiveIntensity = 0.1 + Math.min(1.5, st.fanSpeed) * 0.6;

    // ---------------- breaker levers: switch jobs flip them (one by one or all at once)
    if (levers.current) {
      const isSwitch = a && a.kind === 'switch' && fid !== 's2_filter';
      levers.current.children.forEach((c, i) => {
        let up = awake ? 1 : 0;
        if (isSwitch) up = oid === 'allAtOnce' || oid === 'fullPower' ? seg(p, 0.2, 0.35) : seg(p, 0.1 + i * 0.25, 0.25 + i * 0.25);
        if (isSwitch && oid === 'dim') up = 1 - seg(p, 0.2 + i * 0.2, 0.35 + i * 0.2) * (i === 2 ? 0 : 1);
        c.rotation.x = -0.7 + up * 1.4;
      });
    }

    // ---------------- valve + water (backflush)
    const flushing = a && fid === 's2_filter' && oid === 'backflush';
    if (valve.current) valve.current.rotation.z = flushing ? -seg(p, 0, 0.5) * Math.PI * 3 + seg(p, 0.85, 1) * Math.PI * 3 : 0;
    st.flow += ((flushing && p > 0.4 && p < 0.9 ? 1 : 0) - st.flow) * (1 - Math.exp(-dt * 4));
    if (water.current) {
      water.current.opacity = 0.25 + st.flow * 0.6;
      water.current.emissiveIntensity = st.flow * 0.6;
    }

    // ---------------- pump: rattles while broken, overhaul (lid off, parts swapped), oil
    const pumpBroken = w.open.includes('s2_pump');
    if (pump.current) {
      const shake = pumpBroken ? Math.sin(t * 40) * 0.006 * (1 + (w.age.s2_pump ?? 0)) : 0;
      pump.current.position.set(PUMP[0] + shake, PUMP[1], PUMP[2]);
    }
    if (pumpLid.current) {
      const lift = a && fid === 's2_pump' && oid === 'overhaul' ? seg(p, 0.05, 0.25) * (1 - seg(p, 0.75, 0.95)) : 0;
      pumpLid.current.position.y = 0.3 + lift * 0.35;
      pumpLid.current.rotation.x = -lift * 0.9;
    }
    if (pumpMat.current) {
      const fresh = w.chosen.s2_pump === 'overhaul' || (a && fid === 's2_pump' && oid === 'overhaul' && p > 0.5);
      pumpMat.current.color.setHex(fresh ? colorHex.hull : pumpBroken ? 0x7a7f8f : colorHex.hullDark);
      pumpMat.current.emissiveIntensity = a && fid === 's2_pump' && a.phase === 'finish' ? 0.6 : 0;
    }
    if (oilCan.current) {
      const oiling = a && fid === 's2_pump' && oid === 'oil';
      oilCan.current.visible = w.chosen.s2_pump === 'oil' || !!oiling;
      if (oiling) {
        const tilt = seg(p, 0.1, 0.3) * (1 - seg(p, 0.8, 0.95));
        oilCan.current.position.set(PUMP[0] + 0.15, PUMP[1] + 0.55 - (1 - seg(p, 0, 0.15)) * 0.3, PUMP[2] + 0.1);
        oilCan.current.rotation.z = tilt * 1.1;
      } else {
        oilCan.current.position.set(PUMP[0] + 0.5, PUMP[1] + 0.33, PUMP[2] + 0.05);
        oilCan.current.rotation.z = 0;
      }
    }
    st.spark = pumpBroken && !(a && fid === 's2_pump' && doing) ? 0.6 + (w.age.s2_pump ?? 0) * 0.5 : 0;
    st.drip = a && fid === 's2_pump' && oid === 'oil' && p > 0.3 && p < 0.8 ? 1 : 0;

    // ---------------- beacon cable (Sol 15 beacon: plug in)
    if (plug.current && cable.current) {
      const beaconChosen = w.chosen.s15_beacon === 'fullBeacon' || w.chosen.s15_beacon === 'dimBeacon';
      let inS = beaconChosen ? 1 : 0;
      if (a && fid === 's15_beacon' && a.kind === 'plug') inS = seg(p, 0.15, 0.85);
      plug.current.position.set(SOCKET[0] + 0.25 * (1 - inS), SOCKET[1] - 0.35 * (1 - inS), SOCKET[2] + 0.06 + 0.25 * (1 - inS));
      cable.current.visible = true;
    }

    // ---------------- console screen
    let mode: Parameters<typeof screen.draw>[0] = work.alarm.hub || (a && a.before && a.from.alarm.hub) ? 'alarm' : 'idle';
    let sp = 0;
    if (a && a.kind === 'console') {
      mode = fid === 's7_message' ? 'message' : 'schedule';
      sp = p;
    }
    if (a && fid === 's15_beacon') {
      mode = 'beacon';
      sp = seg(p, 0.6, 1) * (oid === 'dimBeacon' ? 0.4 : 1);
    }
    if (a && a.phase === 'finish' && mode === 'alarm') mode = 'idle';
    screen.draw(mode, sp, t, Math.sin(t * 7) > 0);
    if (screenMat.current) screenMat.current.emissiveIntensity = 0.15 + glow * 1.0;
  });

  return (
    <group>
      {/* Cabinet with framed panels. */}
      <RBox size={[2.5, 2.5, 0.5]} position={[0, 1.25, WALL_Z]} color={0x5a6582} />
      <RBox size={[2.36, 0.06, 0.04]} position={[0, 1.95, FRONT]} r={0.01} color={colorHex.accent} />
      <RBox size={[2.36, 0.06, 0.04]} position={[0, 0.85, FRONT]} r={0.01} color={colorHex.accent} />
      {/* Fan housing (top). */}
      <RBox size={[1.3, 0.42, 0.06]} r={0.02} position={[FAN[0], FAN[1], FRONT + 0.01]} color={0x3a4157} />
      {[-0.4, 0, 0.4].map((x) => (
        <group key={x} position={[FAN[0] + x, FAN[1], FAN[2] + 0.02]}>
          <mesh>
            <circleGeometry args={[0.17, 24]} />
            <meshStandardMaterial ref={x === 0 ? fanGlow : undefined} color={0x16303a} emissive={colorHex.accent} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <torusGeometry args={[0.17, 0.018, 6, 24]} />
            <meshStandardMaterial color={colorHex.hullDark} />
          </mesh>
        </group>
      ))}
      <group ref={fans}>
        {[-0.4, 0, 0.4].map((x) => (
          <group key={x} position={[FAN[0] + x, FAN[1], FAN[2] + 0.04]}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} rotation={[0.35, 0, (k * Math.PI * 2) / 3]} position={[0, 0, 0]}>
                <boxGeometry args={[0.05, 0.28, 0.008]} />
                <meshStandardMaterial color={0x9aa1b3} metalness={0.4} roughness={0.4} />
              </mesh>
            ))}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
              <meshStandardMaterial color={colorHex.metal} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Filter slot. */}
      <RBox size={[0.62, 0.62, 0.08]} r={0.03} position={[SLOT[0], SLOT[1], FRONT + 0.01]} color={colorHex.metal} metal={0.5} rough={0.4} />
      <mesh position={[SLOT[0], SLOT[1], FRONT + 0.055]}>
        <circleGeometry args={[0.18, 24]} />
        <meshStandardMaterial color={0x141a2c} />
      </mesh>
      <mesh ref={lock} position={[SLOT[0] + 0.25, SLOT[1] + 0.22, FRONT + 0.07]}>
        <boxGeometry args={[0.06, 0.22, 0.05]} />
        <meshStandardMaterial color={colorHex.warn} />
      </mesh>
      <group ref={oldC}>
        <Cartridge dirty matRef={oldMat} />
      </group>
      <group ref={newC}>
        <Cartridge dirty={false} />
      </group>
      <group ref={tape} position={[SLOT[0], SLOT[1], FRONT + 0.1]}>
        {[-0.6, 0, 0.6].map((rz, i) => (
          <mesh key={i} rotation={[0, 0, rz]}>
            <planeGeometry args={[0.66, 0.1]} />
            <meshStandardMaterial color={colorHex.tape} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Console screen. */}
      <RBox size={[0.78, 0.52, 0.06]} r={0.02} position={[SCREEN[0], SCREEN[1], FRONT + 0.01]} color={0x1b2338} />
      <mesh position={SCREEN}>
        <planeGeometry args={[0.68, 0.42]} />
        <meshStandardMaterial ref={screenMat} map={screen.tex} emissiveMap={screen.tex} color={0xffffff} emissive={0xffffff} emissiveIntensity={1} />
      </mesh>
      {/* Breaker levers. */}
      <RBox size={[0.7, 0.32, 0.05]} r={0.02} position={[0.5, 1.08, FRONT + 0.01]} color={0x3a4157} />
      <group ref={levers}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0.3 + i * 0.2, 1.08, FRONT + 0.05]}>
            <mesh position={[0, 0.06, 0.04]}>
              <boxGeometry args={[0.05, 0.14, 0.05]} />
              <meshStandardMaterial color={i === 2 ? colorHex.warn : colorHex.hull} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Pump unit with lid. */}
      <group ref={pump} position={PUMP}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[0.8, 0.3, 0.4]} />
          <meshStandardMaterial ref={pumpMat} color={colorHex.hullDark} emissive={colorHex.ok} emissiveIntensity={0} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0.48, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.18, 16]} />
          <meshStandardMaterial color={colorHex.metal} metalness={0.5} roughness={0.35} />
        </mesh>
        <group ref={pumpLid} position={[0, 0.3, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.82, 0.04, 0.42]} />
            <meshStandardMaterial color={colorHex.accentDim} />
          </mesh>
        </group>
      </group>
      <Fountain at={[PUMP[0] + 0.45, PUMP[1] + 0.2, PUMP[2] + 0.2]} rate={() => st.spark} color={0xf3f5fa} size={0.05} speed={1.0} spread={0.4} life={0.35} gravity={3} />
      <Fountain at={[PUMP[0] + 0.15, PUMP[1] + 0.45, PUMP[2] + 0.1]} rate={() => st.drip} color={0x9fd7c9} size={0.05} speed={-0.2} spread={0.02} life={0.6} gravity={2} />
      <group ref={oilCan}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.07, 0.16, 12]} />
          <meshStandardMaterial color={colorHex.ok} />
        </mesh>
        <mesh position={[0.06, 0.08, 0]} rotation={[0, 0, -0.8]}>
          <cylinderGeometry args={[0.01, 0.015, 0.14, 6]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
      </group>

      {/* Pipes, valve wheel and a clear section where water flows when flushing. */}
      <mesh position={[0.98, 1.25, -5.25]}>
        <cylinderGeometry args={[0.06, 0.06, 2.5, 10]} />
        <meshStandardMaterial color={colorHex.metal} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.98, 1.45, -5.25]}>
        <cylinderGeometry args={[0.075, 0.075, 0.5, 12]} />
        <meshStandardMaterial ref={water} color={0x7fd6ea} emissive={0x38d0d6} emissiveIntensity={0} transparent opacity={0.3} />
      </mesh>
      <group ref={valve} position={VALVE}>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[0.13, 0.022, 6, 18]} />
          <meshStandardMaterial color={colorHex.danger} />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
            <boxGeometry args={[0.26, 0.02, 0.02]} />
            <meshStandardMaterial color={colorHex.danger} />
          </mesh>
        ))}
      </group>
      <mesh position={[-1.05, 1.25, -5.25]}>
        <cylinderGeometry args={[0.05, 0.05, 2.5, 10]} />
        <meshStandardMaterial color={colorHex.accentDim} />
      </mesh>

      {/* Beacon socket and cable. */}
      <RBox size={[0.16, 0.16, 0.05]} r={0.02} position={SOCKET} color={0x2a2f40} />
      <group ref={plug}>
        <mesh>
          <boxGeometry args={[0.07, 0.07, 0.1]} />
          <meshStandardMaterial color={colorHex.warn} />
        </mesh>
      </group>
      <mesh ref={cable} position={[SOCKET[0] + 0.25, SOCKET[1] - 0.45, SOCKET[2] + 0.2]} rotation={[0.6, 0, 0.3]}>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
        <meshStandardMaterial color={0x2a2f40} />
      </mesh>

      <Lamp station="hub" rt={rt} work={work} at={[-1.0, 2.2, FRONT + 0.04]} size={0.07} />
    </group>
  );
}

