// The astronaut's gloved hand in the lower right of the view, holding the tool for the
// job: brush (wipe), tape (patch), cartridge or wrench (replace), shovel (dig), cable
// plug (plug), tablet (console); an open glove for switches; resting while waiting.
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { colorHex } from '../ui/tokens';
import type { ActionKind } from '../content/actions';
import { rbox, type RT } from './core';
import { SPOTS } from './world';

export type Tool = 'brush' | 'filter' | 'tape' | 'wrench' | 'shovel' | 'plug' | 'tablet' | 'none';
const TOOLS: Tool[] = ['brush', 'filter', 'tape', 'wrench', 'shovel', 'plug', 'tablet'];
const FILTER_FAULTS = new Set(['s2_filter', 's10_co2']);

export function toolFor(kind: ActionKind | null, at: string, faultId: string | null): Tool {
  switch (kind) {
    case 'wipe':
      return 'brush';
    case 'patch':
      return 'tape';
    case 'replace':
      return faultId && FILTER_FAULTS.has(faultId) ? 'filter' : 'wrench';
    case 'dig':
      // The shelter and the landing pad have their own shovel / push board in the scene.
      return at === 'shelter' || at === 'landing' ? 'none' : 'shovel';
    case 'plug':
      return 'plug';
    case 'console':
      return 'tablet';
    case 'switch':
    case 'wait':
      return 'none';
    default:
      return SPOTS[at]?.outside ? 'brush' : 'wrench';
  }
}

const suitMat = () => new THREE.MeshStandardMaterial({ color: colorHex.suit, roughness: 0.75 });

export function Hand({ rt }: { rt: MutableRefObject<RT> }) {
  const g = useRef<THREE.Group>(null);
  const tools = useRef<Partial<Record<Tool, THREE.Group | null>>>({});
  const fingers = useRef<THREE.Group>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const { camera } = useThree();
  const tmp = useMemo(() => ({ off: new THREE.Vector3(), target: new THREE.Vector3(), cur: new THREE.Vector3(), up: new THREE.Vector3(0, 0.08, 0), init: false }), []);
  const suit = useMemo(suitMat, []);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const grp = g.current;
    if (!grp) return;
    const R = rt.current;
    const r = R.run;
    const active = r && r.phase !== 'wait' ? r : null;
    const tool = toolFor(active ? active.run.kind : null, R.at, active ? active.run.faultId : null);
    const handedOver = tool === 'filter' && active && active.p > 0.6;
    for (const k of TOOLS) {
      const o = tools.current[k];
      if (o) o.visible = k === tool && !handedOver;
    }
    const t = clock.elapsedTime;
    const walking = !!R.walk;
    const sway = walking ? Math.sin(t * 9) * 0.014 : Math.sin(t * 1.3) * 0.005;
    // Rest pose: lower right of the view.
    tmp.off.set(0.31 + sway, -0.31 + Math.abs(sway) * 0.6, -0.6);
    const doing = active && active.phase === 'do';
    const working = doing && (active.holding || active.mode === 'auto');
    let reach = 0;
    if (doing && active.run.kind !== 'wipe') reach = 0.55 + (working ? Math.sin(t * (active.run.kind === 'dig' ? 5 : 7)) * 0.12 : 0);
    if (active && active.run.kind === 'wait') reach = -0.3; // hand drops while waiting
    tmp.off.z -= reach * 0.22;
    tmp.off.x -= reach * 0.14;
    tmp.off.y += reach * 0.04;
    tmp.target.copy(tmp.off).applyQuaternion(camera.quaternion).add(camera.position);
    // Wiping on the solar panel: the brush goes where the panel is being cleaned.
    if (doing && active.run.kind === 'wipe' && R.brushOn) tmp.target.copy(R.brush).add(tmp.up);
    if (!tmp.init) {
      tmp.cur.copy(tmp.target);
      tmp.init = true;
    }
    tmp.cur.lerp(tmp.target, 1 - Math.exp(-dt * (doing ? 16 : 24)));
    grp.position.copy(tmp.cur);
    grp.quaternion.copy(camera.quaternion);
    grp.rotateX(doing && active.run.kind === 'wipe' ? -0.9 : doing && active.run.kind === 'dig' ? -0.35 + Math.sin(t * 5) * 0.25 * (working ? 1 : 0) : 0.15);
    grp.rotateZ(0.22);
    // Open hand for switches; fingers curl while pressing.
    if (fingers.current) fingers.current.rotation.x = tool === 'none' ? (working ? -0.2 + Math.sin(t * 8) * 0.25 : -0.1) : 0.9;
    if (screen.current) screen.current.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.2;
  });
  const metal = <meshStandardMaterial color={colorHex.metal} metalness={0.55} roughness={0.35} />;
  return (
    <group ref={g}>
      {/* Glove: palm, four fingers, thumb, cuff with a teal ring. */}
      <mesh geometry={rbox(0.09, 0.05, 0.1, 0.022)} position={[0, 0, 0.02]} material={suit} />
      <group ref={fingers} position={[0, 0, -0.03]}>
        {[-0.03, -0.01, 0.01, 0.03].map((x, i) => (
          <mesh key={x} geometry={rbox(0.019, 0.022, 0.06 - Math.abs(i - 1.5) * 0.006, 0.009)} position={[x, 0, -0.028]} material={suit} />
        ))}
      </group>
      <mesh geometry={rbox(0.024, 0.024, 0.055, 0.01)} position={[-0.055, 0.004, 0.0]} rotation={[0, 0.6, 0]} material={suit} />
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.052, 0.058, 0.09, 16]} />
        <meshStandardMaterial color={colorHex.suit} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.053, 0.008, 6, 20]} />
        <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accent} emissiveIntensity={0.3} />
      </mesh>

      <group ref={(o) => void (tools.current.brush = o)} position={[0, 0.02, -0.06]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.013, 0.013, 0.2, 8]} />
          {metal}
        </mesh>
        <mesh geometry={rbox(0.15, 0.035, 0.06, 0.012)} position={[0, -0.02, -0.11]}>
          <meshStandardMaterial color={colorHex.accentDim} />
        </mesh>
        <mesh position={[0, -0.048, -0.11]}>
          <boxGeometry args={[0.14, 0.03, 0.05]} />
          <meshStandardMaterial color={0xe6e2dc} roughness={1} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.filter = o)} position={[0, 0.06, -0.08]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.22, 18]} />
          <meshStandardMaterial color={colorHex.filterNew} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.08]}>
          <cylinderGeometry args={[0.072, 0.072, 0.03, 18]} />
          <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accent} emissiveIntensity={0.4} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.tape = o)} position={[0, 0.05, -0.05]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.042, 0.022, 8, 18]} />
          <meshStandardMaterial color={colorHex.tape} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.02, -0.06]} rotation={[0.4, 0, 0]}>
          <planeGeometry args={[0.04, 0.08]} />
          <meshStandardMaterial color={colorHex.tape} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.wrench = o)} position={[0, 0.02, -0.08]}>
        <mesh geometry={rbox(0.025, 0.02, 0.18, 0.008)}>{metal}</mesh>
        <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.025, 0.01, 6, 12, Math.PI * 1.5]} />
          {metal}
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.shovel = o)} position={[0, 0.02, -0.1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.28, 8]} />
          <meshStandardMaterial color={colorHex.hullDark} />
        </mesh>
        <mesh geometry={rbox(0.11, 0.015, 0.12, 0.006)} position={[0, -0.01, -0.19]} rotation={[0.2, 0, 0]}>
          {metal}
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.plug = o)} position={[0, 0.03, -0.07]}>
        <mesh geometry={rbox(0.04, 0.04, 0.07, 0.01)}>
          <meshStandardMaterial color={colorHex.warn} />
        </mesh>
        {[-0.01, 0.01].map((x) => (
          <mesh key={x} position={[x, 0, -0.045]}>
            <boxGeometry args={[0.005, 0.012, 0.025]} />
            {metal}
          </mesh>
        ))}
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
          <meshStandardMaterial color={0x2a2f40} />
        </mesh>
      </group>
      <group ref={(o) => void (tools.current.tablet = o)} position={[-0.02, 0.05, -0.08]} rotation={[-0.6, 0, 0]}>
        <mesh geometry={rbox(0.16, 0.012, 0.11, 0.008)}>
          <meshStandardMaterial color={0x1b2338} />
        </mesh>
        <mesh position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.14, 0.09]} />
          <meshStandardMaterial ref={screen} color={0x0f2a33} emissive={colorHex.accent} emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  );
}
