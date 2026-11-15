// Airlock: tunnel from the hab to the outer door (door seal is the work point).
import { type MutableRefObject } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import type { WorkLook } from '../look';
import { Door, Lamp, RBox, type RT, type StationProps } from '../core';
import { AIRLOCK_OUT, HAB_R,} from '../world';

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

export default function Airlock({ rt, work }: StationProps) {
  return <AirlockTunnel rt={rt} work={work} />;
}
