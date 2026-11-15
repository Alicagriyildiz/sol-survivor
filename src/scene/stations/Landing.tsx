// Landing pad far outside (EVA).
import { colorHex } from '../../ui/tokens';
import { Blinker, type StationProps } from '../core';
import { LANDING_AT,} from '../world';

function Landing({ locked }: { locked: boolean }) {
  const [x, z] = LANDING_AT;
  return (
    <group position={[x, 0.02, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5, 40]} />
        <meshLambertMaterial color={0xa49ca4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.8, 4.3, 40]} />
        <meshBasicMaterial color={locked ? colorHex.grey : colorHex.warn} />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, r]} position={[0, 0.03, 0]}>
          <planeGeometry args={[4.6, 0.5]} />
          <meshBasicMaterial color={0xf3f5fa} />
        </mesh>
      ))}
      <mesh position={[5.6, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.8, 8]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
      <Blinker at={[5.6, 2.9, 0]} color={colorHex.accent} period={1.0} />
      {[0, 1, 2, 3].map((i) => (
        <Blinker key={i} at={[Math.cos((i * Math.PI) / 2) * 4.6, 0.15, Math.sin((i * Math.PI) / 2) * 4.6]} color={colorHex.warn} period={2} phase={i * 0.25} />
      ))}
    </group>
  );
}

export default function LandingStation({ work }: StationProps) {
  return <Landing locked={work.sol < 13 || work.storm} />;
}
