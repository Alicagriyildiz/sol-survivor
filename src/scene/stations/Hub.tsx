// Hub work point: life-support rack (filter slot), console, pipes.
import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { ease, Lamp, RBox, showsBefore, type RT, type StationProps } from '../core';
import { type V3 } from '../world';

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

export default function Hub({ rt, work }: StationProps) {
  return <HubRack rt={rt} work={work} />;
}
