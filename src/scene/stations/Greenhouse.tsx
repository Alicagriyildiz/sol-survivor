// Greenhouse: glass dome west of the hab, plant trays.
import { type MutableRefObject } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import type { SceneLook, WorkLook } from '../look';
import { Lamp, RBox, type RT, type StationProps } from '../core';
import { GREENHOUSE_AT, GREENHOUSE_R, HAB_R,} from '../world';

function Greenhouse({ rt, work, look }: { rt: MutableRefObject<RT>; work: WorkLook; look: SceneLook }) {
  const [gx, gz] = GREENHOUSE_AT;
  const inner = -HAB_R;
  const outer = gx + GREENHOUSE_R - 0.2;
  const lightOn = look.lights === 'on' ? 1 : look.lights === 'dim' ? 0.4 : 0.05;
  return (
    <group>
      <mesh position={[(inner + outer) / 2, 1.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.35, 1.35, Math.abs(outer - inner) + 0.3, 18, 1, true]} />
        <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} />
      </mesh>
      <group position={[gx, 0, gz]}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[GREENHOUSE_R, 40]} />
          <meshStandardMaterial color={0x4a5370} />
        </mesh>
        <mesh position={[0, 0.02, 0]} raycast={() => null}>
          <sphereGeometry args={[GREENHOUSE_R, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={0xd7f3f3} transparent opacity={0.16} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.02, 0]} raycast={() => null}>
          <sphereGeometry args={[GREENHOUSE_R + 0.01, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color={0xe8fbfa} wireframe transparent opacity={0.4} />
        </mesh>
        {[-1.2, 0, 1.2].map((z) => (
          <group key={z} position={[-1.7, 0, z]}>
            <RBox size={[1.0, 0.7, 0.9]} position={[0, 0.35, 0]} color={colorHex.hullDark} />
            <mesh position={[0, 0.72, 0]}>
              <boxGeometry args={[0.9, 0.06, 0.8]} />
              <meshLambertMaterial color={colorHex.marsBrown} />
            </mesh>
            {[-0.25, 0.25].map((x) =>
              [-0.22, 0.22].map((zz) => (
                <mesh key={`${x}${zz}`} position={[x, 0.95, zz]} castShadow>
                  <coneGeometry args={[0.13, 0.45, 6]} />
                  <meshStandardMaterial color={colorHex.plant} emissive={colorHex.plant} emissiveIntensity={0.1} />
                </mesh>
              )),
            )}
          </group>
        ))}
        <pointLight position={[0, 3.2, 0]} intensity={lightOn * 14} distance={9} color={0xf0e4ff} />
        <Lamp station="greenhouse" rt={rt} work={work} at={[-1.7, 1.6, -1.9]} />
      </group>
    </group>
  );
}

export default function GreenhouseStation({ rt, work, look }: StationProps) {
  return <Greenhouse rt={rt} work={work} look={look} />;
}
