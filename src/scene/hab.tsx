// The round habitat: wall segments with doors and windows, lit ceiling panels, pipes and
// cable trays, floor markings, a crew desk, crates; outside: roof dome, turning dish,
// vents and blinking lights. Lights and screens follow the base power.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { colorHex } from '../ui/tokens';
import { Blinker, Door, Model, powerGlow, RBox, type RT } from './core';
import type { SceneLook } from './look';
import { HAB_R, WALL_H, wallPoint, type V3 } from './world';

const SEGS = 24;
const SEG_DEG = 360 / SEGS;
const SEG_W = 2 * HAB_R * Math.sin(Math.PI / SEGS) + 0.04;
const DOORS: Record<number, string> = { 0: 'airlock', 180: 'greenhouse', 225: 'shelter' };
const WINDOWS = new Set([15, 30, 150, 210, 270, 315, 330]);
/** Wall segments that carry a lit panel (not behind station racks). */
const BUSY = new Set([45, 60, 75, 90, 105]);

const lightLevel = (l: SceneLook['lights']) => powerGlow(l);
/** Inside wall colour: a soft blue-grey, so the room is not a white box. */
const WALL = 0x3a4560;
const WALL_LOW = 0x232a3d;

function Segment({ deg, rt }: { deg: number; rt: MutableRefObject<RT> }) {
  const a = (deg * Math.PI) / 180;
  const pos: V3 = [Math.cos(a) * HAB_R, 0, -Math.sin(a) * HAB_R];
  const rotY = a + Math.PI / 2;
  if (DOORS[deg]) {
    return (
      <>
        <Door at={pos} rotY={rotY} rt={rt} />
        <RBox size={[SEG_W, WALL_H - 2.42, 0.2]} position={[pos[0], 2.42 + (WALL_H - 2.42) / 2, pos[2]]} rotation={[0, rotY, 0]} color={WALL} />
      </>
    );
  }
  if (WINDOWS.has(deg)) {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        <RBox size={[SEG_W, 0.95, 0.22]} position={[0, 0.475, 0]} color={WALL} />
        <RBox size={[SEG_W, 0.85, 0.22]} position={[0, WALL_H - 0.425, 0]} color={WALL} />
        <RBox size={[0.12, 1.2, 0.26]} position={[-SEG_W / 2 + 0.06, 1.55, 0]} color={colorHex.hullDark} />
        <RBox size={[0.12, 1.2, 0.26]} position={[SEG_W / 2 - 0.06, 1.55, 0]} color={colorHex.hullDark} />
        <RBox size={[SEG_W - 0.1, 0.08, 0.3]} position={[0, 0.98, 0.04]} color={colorHex.hullDark} />
        <mesh position={[0, 1.55, 0]} raycast={() => null}>
          <planeGeometry args={[SEG_W - 0.2, 1.2]} />
          <meshStandardMaterial color={0xbfe6ef} transparent opacity={0.12} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <RBox size={[SEG_W, WALL_H, 0.2]} position={[0, WALL_H / 2, 0]} color={WALL} />
      {/* Darker lower band and a teal accent line, so the room has structure. */}
      <RBox size={[SEG_W, 0.5, 0.06]} position={[0, 0.3, 0.12]} r={0.02} color={WALL_LOW} />
      {/* Outside face: light hull panel. Inside face (-z): the wall itself is dark navy, with
          glowing teal light strips, so the interior reads as a lit spacecraft, not a white room. */}
      <mesh position={[0, 1.5, 0.102]} raycast={() => null}>
        <planeGeometry args={[SEG_W - 0.12, 2.5]} />
        <meshStandardMaterial color={0xd3d8e2} roughness={0.7} />
      </mesh>
      {([[1.95, 0.07, colorHex.accent], [2.62, 0.04, 0x9fe8ee], [0.58, 0.035, colorHex.accent]] as const).map(([y, h, c]) => (
        <mesh key={y} position={[0, y, -0.106]} rotation={[0, Math.PI, 0]} raycast={() => null}>
          <planeGeometry args={[SEG_W, h]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Ceiling light panels and the light itself: dim and dark when power drops. */
function RoomLights({ look }: { look: SceneLook }) {
  const panelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe9fbfc, emissive: 0xe9fbfc, emissiveIntensity: 1.6, side: THREE.DoubleSide }), []);
  const main = useRef<THREE.PointLight>(null);
  const work = useRef<THREE.PointLight>(null);
  const level = useRef(lightLevel(look.lights));
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    level.current += (lightLevel(look.lights) - level.current) * (1 - Math.exp(-dt * 3));
    const l = level.current;
    panelMat.emissiveIntensity = 0.1 + l * 1.3;
    if (main.current) main.current.intensity = 1 + l * 13;
    if (work.current) work.current.intensity = 0.3 + l * 4;
  });
  const ring = useMemo(() => {
    const out: V3[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.13;
      out.push([Math.cos(a) * 3.4, WALL_H + 0.35, -Math.sin(a) * 3.4]);
    }
    return out;
  }, []);
  return (
    <>
      {ring.map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2 - 0.42, 0, -Math.atan2(p[2], p[0]) - Math.PI / 2]} raycast={() => null} material={panelMat}>
          <planeGeometry args={[0.9, 0.35]} />
        </mesh>
      ))}
      <pointLight ref={main} position={[0, WALL_H, 0]} intensity={30} distance={18} decay={1.5} color={0xeef9ff} />
      <pointLight ref={work} position={[0, 2.0, -3.4]} intensity={7} distance={6} decay={1.6} color={0xdff6ff} />
    </>
  );
}

/** Pipes and a cable tray running around the top of the wall. */
function Pipes() {
  return (
    <group>
      <mesh position={[0, WALL_H - 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HAB_R - 0.3, 0.06, 8, 72]} />
        <meshStandardMaterial color={colorHex.metal} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, WALL_H - 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HAB_R - 0.28, 0.04, 6, 72]} />
        <meshStandardMaterial color={colorHex.accentDim} roughness={0.5} />
      </mesh>
      <mesh position={[0, WALL_H - 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HAB_R - 0.25, 0.03, 6, 72]} />
        <meshStandardMaterial color={0x3a4157} />
      </mesh>
    </group>
  );
}

/** Things in the room that make it lived-in: desk, chair, crates, lockers. */
function Furniture({ look }: { look: SceneLook }) {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (screen.current) screen.current.emissiveIntensity = powerGlow(look.lights) * (0.9 + Math.sin(clock.elapsedTime * 1.7) * 0.08);
  });
  const desk = wallPoint(258, 0, 0.75);
  const deskRot = (258 * Math.PI) / 180 + Math.PI / 2;
  const crates = wallPoint(130, 0, 0.7);
  const lockers = wallPoint(292, 0, 0.45);
  return (
    <group>
      <group position={desk} rotation={[0, deskRot, 0]}>
        <RBox size={[1.6, 0.06, 0.7]} r={0.02} position={[0, 0.78, 0]} color={colorHex.hullDark} />
        <RBox size={[0.08, 0.76, 0.6]} position={[-0.72, 0.38, 0]} color={colorHex.metal} />
        <RBox size={[0.08, 0.76, 0.6]} position={[0.72, 0.38, 0]} color={colorHex.metal} />
        <RBox size={[0.7, 0.45, 0.04]} r={0.02} position={[0, 1.1, -0.2]} color={0x1b2338} />
        <mesh position={[0, 1.1, -0.175]}>
          <planeGeometry args={[0.62, 0.37]} />
          <meshStandardMaterial ref={screen} color={0x0f2a33} emissive={colorHex.accent} emissiveIntensity={0.9} />
        </mesh>
        <Model name="desk_chair" position={[0.1, 0, 0.55]} rotation={[0, Math.PI, 0]} scale={1.1} shadows={false} />
      </group>
      <group position={crates} rotation={[0, (130 * Math.PI) / 180 + Math.PI / 2, 0]}>
        <Model name="barrels" scale={1.6} position={[-0.4, 0, 0]} fallback={<RBox size={[0.7, 0.4, 0.6]} position={[-0.4, 0.2, 0]} color={colorHex.hullDark} />} />
        <Model name="machine_barrel" scale={1.3} position={[0.6, 0, 0.1]} fallback={<RBox size={[0.6, 0.7, 0.6]} position={[0.6, 0.35, 0]} color={colorHex.hullDark} />} />
      </group>
      <group position={lockers} rotation={[0, (292 * Math.PI) / 180 + Math.PI / 2, 0]}>
        {[-0.45, 0, 0.45].map((x) => (
          <group key={x}>
            <RBox size={[0.42, 1.9, 0.4]} r={0.03} position={[x, 0.95, 0]} color={x === 0 ? colorHex.accentDim : colorHex.hullDark} />
            <mesh position={[x + 0.13, 1.05, 0.21]}>
              <boxGeometry args={[0.03, 0.18, 0.02]} />
              <meshStandardMaterial color={colorHex.hull} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Floor() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[HAB_R + 0.1, 48]} />
        <meshStandardMaterial color={0x2b3246} roughness={0.55} metalness={0.15} />
      </mesh>
      {[1.7, 3.6].map((r) => (
        <mesh key={r} position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[r, r + 0.05, 64]} />
          <meshBasicMaterial color={0x3f8f9a} />
        </mesh>
      ))}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.55, 0.62, 48]} />
        <meshBasicMaterial color={colorHex.accentDim} />
      </mesh>
      {/* Walk lines from the centre to each door. */}
      {[0, 180, 225].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.cos(a) * 3.6, 0.068, -Math.sin(a) * 3.6]} rotation={[-Math.PI / 2, 0, a]} raycast={() => null}>
            <planeGeometry args={[4.2, 0.1]} />
            <meshBasicMaterial color={colorHex.warn} transparent opacity={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Hab({ rt, look }: { rt: MutableRefObject<RT>; look: SceneLook }) {
  const segs: ReactNode[] = [];
  for (let k = 0; k < SEGS; k++) {
    const deg = k * SEG_DEG;
    segs.push(<Segment key={k} deg={deg} rt={rt} />);
    // Ribs between segments.
    const a = ((deg + SEG_DEG / 2) * Math.PI) / 180;
    if (!BUSY.has(deg))
      segs.push(<RBox key={`r${k}`} size={[0.14, WALL_H, 0.18]} r={0.03} position={[Math.cos(a) * (HAB_R - 0.13), WALL_H / 2, -Math.sin(a) * (HAB_R - 0.13)]} rotation={[0, a + Math.PI / 2, 0]} color={colorHex.hullDark} />);
  }
  return (
    <group>
      {segs}
      {/* Roof: low dome, casts shade inside. */}
      <mesh position={[0, WALL_H, 0]} scale={[1, 0.42, 1]} castShadow receiveShadow>
        <sphereGeometry args={[HAB_R + 0.12, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={colorHex.hull} roughness={0.7} />
      </mesh>
      <mesh position={[0, WALL_H + 0.01, 0]} scale={[1, 0.4, 1]}>
        <sphereGeometry args={[HAB_R - 0.05, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={0x262d42} roughness={0.9} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, WALL_H - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HAB_R - 0.4, HAB_R + 0.18, 48]} />
        <meshStandardMaterial color={colorHex.hullDark} side={THREE.DoubleSide} />
      </mesh>
      {/* Outside base ring where the hab sits on the ground. */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[HAB_R + 0.35, HAB_R + 0.5, 0.3, 48, 1, true]} />
        <meshStandardMaterial color={colorHex.hullDark} roughness={0.8} />
      </mesh>
      <Floor />
      <Pipes />
      <RoomLights look={look} />
      <Furniture look={look} />
      {/* Central table. */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 0.9, 12]} />
        <meshStandardMaterial color={colorHex.metal} />
      </mesh>
      <RBox size={[1.4, 0.06, 1.0]} r={0.03} position={[0, 0.96, 0]} color={colorHex.hullDark} />
    </group>
  );
}

/** Outside the hab: generator, tanks, crates, a parked cargo sled — the base looks lived-in. */
export function Yard() {
  const items: [Parameters<typeof Model>[0]['name'], V3, number, number][] = [
    ['machine_generatorLarge', [7.6, 0, -5.4], 2.2, 0.6],
    ['machine_barrelLarge', [9.6, 0, 3.4], 1.8, 0.2],
    ['barrels', [13.6, 0, 2.6], 2.2, 1.2],
    ['barrel', [14.2, 0, -2.4], 1.8, 0],
    ['craft_cargoA', [3.5, 0, 9.5], 2.4, 2.4],
    ['supports_low', [-2.0, 0, -8.2], 2.4, 0.3],
    ['machine_wirelessCable', [-7.5, 0, -6.5], 2.0, 2.2],
  ];
  return (
    <group>
      {items.map(([name, p, sc, ry], i) => (
        <Model key={i} name={name} position={p} scale={sc} rotation={[0, ry, 0]} />
      ))}
    </group>
  );
}

/** Hab roof outside: dish that turns, vents, blinking lights. */
export function Roof() {
  const dish = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (dish.current) dish.current.rotation.y = clock.elapsedTime * 0.3;
  });
  return (
    <group>
      <group ref={dish} position={[2.0, WALL_H + 2.0, 1.4]}>
        <Model
          name="satelliteDish_detailed"
          scale={2.4}
          fallback={
            <mesh rotation={[0.9, 0, 0]}>
              <sphereGeometry args={[0.7, 18, 8, 0, Math.PI * 2, 0, 0.9]} />
              <meshStandardMaterial color={colorHex.hull} side={THREE.DoubleSide} />
            </mesh>
          }
        />
      </group>
      <Model name="chimney_detailed" position={[-2.2, WALL_H + 1.2, -1.2]} scale={1.1} />
      <Model name="pipe_ring" position={[-0.6, WALL_H + 2.3, 0.8]} scale={0.9} />
      <Blinker at={[0, WALL_H + 2.6, 0]} color={colorHex.danger} period={1.4} />
      <Blinker at={[-3.4, WALL_H + 1.2, -2.6]} color={colorHex.accent} period={2.1} phase={0.5} />
      <Blinker at={[3.6, WALL_H + 1.1, 2.4]} color={colorHex.accent} period={2.1} phase={0.1} />
    </group>
  );
}
