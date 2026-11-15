// Battery station: rack on the hab wall.
import { type MutableRefObject } from 'react';
import { colorHex } from '../../ui/tokens';
import type { SceneLook, WorkLook } from '../look';
import { Lamp, RBox, type RT, type StationProps } from '../core';
import { wallPoint,} from '../world';

function BatteryRack({ rt, work, power }: { rt: MutableRefObject<RT>; work: WorkLook; power: SceneLook['lights'] }) {
  const p = wallPoint(40, 0, 0.55);
  const rotY = (40 * Math.PI) / 180 + Math.PI / 2;
  const fill = power === 'on' ? 0.8 : power === 'dim' ? 0.45 : 0.15;
  return (
    <group position={p} rotation={[0, rotY - Math.PI / 2, 0]}>
      <group rotation={[0, -Math.PI / 2, 0]}>
        <RBox size={[1.7, 2.0, 0.6]} position={[0, 1.0, 0]} color={colorHex.hullDark} />
        {[0, 1, 2].map((r) =>
          [0, 1].map((c) => (
            <RBox key={`${r}${c}`} size={[0.65, 0.42, 0.1]} r={0.03} position={[-0.38 + c * 0.76, 0.5 + r * 0.55, 0.33]} color={0x35405e} metal={0.3} rough={0.5} />
          )),
        )}
        <mesh position={[0, 1.9, 0.31]}>
          <planeGeometry args={[1.2, 0.1]} />
          <meshBasicMaterial color={0x1b2338} />
        </mesh>
        <mesh position={[-0.6 + 0.6 * fill, 1.9, 0.315]}>
          <planeGeometry args={[1.2 * fill, 0.08]} />
          <meshBasicMaterial color={fill > 0.5 ? colorHex.ok : colorHex.warn} />
        </mesh>
      </group>
      <Lamp station="battery" rt={rt} work={work} at={[0.33, 2.1, 0.75]} />
    </group>
  );
}

export default function Battery({ rt, work, look }: StationProps) {
  return <BatteryRack rt={rt} work={work} power={look.lights} />;
}
