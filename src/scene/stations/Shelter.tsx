// Shelter: hatch in the hab wall, buried mound outside.
import { type MutableRefObject } from 'react';
import { colorHex } from '../../ui/tokens';
import type { SceneLook, WorkLook } from '../look';
import { Lamp, RBox, type RT, type StationProps } from '../core';
import { SHELTER_AT, wallPoint,} from '../world';

/** Round hatch to the buried shelter. */
function ShelterHatch({ rt, work }: { rt: MutableRefObject<RT>; work: WorkLook }) {
  const p = wallPoint(235, 0, 0.12);
  const rotY = (235 * Math.PI) / 180 + Math.PI / 2;
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <mesh position={[0, 1.1, 0]}>
        <torusGeometry args={[0.7, 0.1, 10, 28]} />
        <meshStandardMaterial color={colorHex.hullDark} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.1, 0.02]}>
        <circleGeometry args={[0.66, 28]} />
        <meshStandardMaterial color={colorHex.metal} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.1, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.03, 8, 20]} />
        <meshStandardMaterial color={colorHex.warn} />
      </mesh>
      <Lamp station="shelter" rt={rt} work={work} at={[0.85, 1.9, 0.1]} />
    </group>
  );
}

function ShelterMound({ look }: { look: SceneLook }) {
  const s = look.shelterBig ? 1.25 : 1;
  return (
    <group position={[SHELTER_AT[0], 0, SHELTER_AT[1]]}>
      <mesh scale={[3.2 * s, 1.7 * s, 2.8 * s]} castShadow receiveShadow>
        <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color={colorHex.marsRose} flatShading />
      </mesh>
      {look.shelterBig &&
        [-1.5, -0.5, 0.5, 1.5].map((x, i) => <RBox key={i} size={[0.8, 0.4, 0.5]} r={0.12} position={[x * 1.4, 0.2 + (i % 2) * 0.1, -2.9]} color={colorHex.marsRose} rough={1} />)}
      <mesh position={[2.8, 0.6, -2.0]} rotation={[0, -0.9, 0]}>
        <boxGeometry args={[1.0, 1.2, 0.3]} />
        <meshStandardMaterial color={colorHex.hullDark} />
      </mesh>
    </group>
  );
}

export default function Shelter({ rt, work, look }: StationProps) {
  return (
    <>
      <ShelterHatch rt={rt} work={work} />
      <ShelterMound look={look} />
    </>
  );
}
