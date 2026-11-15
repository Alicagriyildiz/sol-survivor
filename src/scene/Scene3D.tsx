// The 3D Mars base (lazy chunk). Read-only view of the game: it gets station info and a
// "look" derived from GameState, and reports clicks. Game logic stays in the core.
// Fixed camera, low-poly primitives, no textures/models/fonts, render on demand.
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { fmt, tr } from '../content';
import type { StationInfo } from '../ui/stationInfo';
import { colorHex, colors } from '../ui/tokens';
import { fmtHours } from '../ui/parts';
import type { SceneLook } from './look';
import { CAMERA_OFFSET, FRAME, PLACES, fitZoom, modeFor, path, places, pointAt, project, toWorld, walkSeconds, type Mode, type P2 } from './layout';

export interface Scene3DProps {
  stations: StationInfo[];
  /** Where the astronaut really is (state). */
  location: string;
  /** Where the astronaut should stand now (walking target, open panel, or location). */
  goal: string;
  look: SceneLook;
  onPick: (id: string) => void;
  onArrive: (id: string) => void;
  coachStation: string | null;
  coach: ReactNode;
  /** WebGL context lost: switch to the simple view. */
  onLost: () => void;
  /** Show the "tap a place" hint (first sol only). */
  hint: boolean;
}


const w3 = (p: P2, y = 0): [number, number, number] => {
  const [x, z] = toWorld(p);
  return [x, y, z];
};

const reduceMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// ------------------------------------------------------------------ camera & light

function Rig({ look, mode }: { look: SceneLook; mode: Mode }) {
  const { camera, size, scene, invalidate } = useThree();
  const [CX, CZ] = toWorld(FRAME[mode].center);
  useLayoutEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.position.set(CX + CAMERA_OFFSET[0], CAMERA_OFFSET[1], CZ + CAMERA_OFFSET[2]);
    cam.lookAt(CX, 0, CZ);
    cam.zoom = fitZoom(size.width, size.height, mode);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate, mode, CX, CZ]);

  const sky = look.night ? colors.night : look.storm ? '#a8908c' : look.solarEvent ? colors.skyEvent : colors.sky;
  useLayoutEffect(() => {
    scene.background = new THREE.Color(sky);
    scene.fog = look.storm ? new THREE.Fog(colors.marsDust, 36, 62) : null;
    invalidate();
  }, [scene, sky, look.storm, invalidate]);

  const hemi = look.night ? 0.35 : look.storm ? 0.85 : 1.15;
  const sun = look.night ? 0.15 : look.storm ? 0.35 : 1.25;
  return (
    <>
      <hemisphereLight args={[look.solarEvent ? colorHex.skyEvent : colorHex.sky, colorHex.marsBrown, hemi]} />
      <directionalLight position={[CX - 12, 25, CZ + 18]} intensity={sun} color={look.solarEvent ? '#f2dcef' : '#fff6f2'} />
    </>
  );
}

// ------------------------------------------------------------------ ground

/** Fixed rock positions (no randomness: the scene looks the same every time). */
const ROCKS: [number, number, number][] = [
  [-7, -3, 0.5], [-6, 4, 0.35], [6.5, -3.5, 0.45], [7.5, 3.5, 0.3], [-1, 7.2, 0.4], [5.5, 6.5, 0.55],
  [-5.5, 8, 0.3], [0, -5.5, 0.35], [-9, 1.5, 0.6], [9.5, 0, 0.5], [-12, 5, 0.4], [12.5, 4, 0.45],
  [-3.5, 11.5, 0.5], [4, 11, 0.4], [-14, 11, 0.6], [14, 12, 0.5], [2.5, -4.6, 0.3], [-8.5, -4.2, 0.4],
];

function Ground({ mode }: { mode: Mode }) {
  return (
    <group>
      {/* A big rectangle in (u, v) space: beyond its far edge the sky shows. */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={w3({ u: 0, v: -13 }, 0)}>
        <planeGeometry args={[120, 52]} />
        <meshLambertMaterial color={colorHex.marsGround} />
      </mesh>
      <Instances limit={ROCKS.length}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color={colorHex.marsBrown} />
        {ROCKS.map(([u, v, s], i) => (
          <Instance key={i} position={w3({ u, v }, s * 0.3)} scale={[s, s * 0.6, s * 0.9]} rotation={[0, i, 0]} />
        ))}
      </Instances>
      {/* Footpath from the airlock to the outside stations. */}
      <Path from="airlock" to="solar" mode={mode} />
      <Path from="airlock" to="landing" mode={mode} />
    </group>
  );
}

function Path({ from, to, mode }: { from: string; to: string; mode: Mode }) {
  const pts = path(from, to, mode).slice(1);
  return (
    <>
      {pts.slice(1).map((b, i) => {
        const a = pts[i]!;
        const [ax, , az] = w3(a);
        const [bx, , bz] = w3(b);
        const len = Math.hypot(bx - ax, bz - az);
        return (
          <mesh key={i} position={[(ax + bx) / 2, 0.02, (az + bz) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(bz - az, bx - ax) * -1]}>
            <planeGeometry args={[len, 0.5]} />
            <meshLambertMaterial color={colorHex.marsDust} transparent opacity={0.45} />
          </mesh>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ materials

/** Surface material; locked stations look faded. */
function Mat({ color, dim, opacity = 1, emissive, glow = 0 }: { color: number; dim?: boolean; opacity?: number; emissive?: number; glow?: number }) {
  const o = dim ? Math.min(opacity, 0.4) : opacity;
  return (
    <meshLambertMaterial
      color={dim ? colorHex.grey : color}
      transparent={o < 1}
      opacity={o}
      depthWrite={o >= 1}
      emissive={emissive ?? 0x000000}
      emissiveIntensity={glow}
    />
  );
}

const WALL = 0xd9dce6;
const WALL2 = 0xb7bccb;
const lightGlow = (l: SceneLook['lights']) => (l === 'on' ? 1 : l === 'dim' ? 0.35 : 0);

/** Corridor tube between two building centers. */
function Corridor({ a, b }: { a: P2; b: P2 }) {
  const [ax, , az] = w3(a);
  const [bx, , bz] = w3(b);
  const len = Math.hypot(bx - ax, bz - az);
  return (
    <group position={[(ax + bx) / 2, 0.38, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, len, 10]} />
        <Mat color={WALL2} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ stations

function Hub({ look }: { look: SceneLook }) {
  const glow = lightGlow(look.lights);
  return (
    <group position={w3(PLACES.hub!.at)}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[1.6, 1.7, 1.4, 16]} />
        <Mat color={WALL} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color={WALL2} />
      </mesh>
      {/* Window band: lit when there is power. */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.66, 0.85, Math.sin(a) * 1.66]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.06, 0.3, 0.55]} />
            <meshLambertMaterial color={glow > 0 ? colorHex.accent : 0x2a3350} emissive={colorHex.accent} emissiveIntensity={glow} />
          </mesh>
        );
      })}
      {/* Antenna and dish. */}
      <mesh position={[0.5, 3.4, -0.3]}>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 6]} />
        <Mat color={WALL2} />
      </mesh>
      <mesh position={[0.5, 4.1, -0.3]} rotation={[0.6, 0, 0.4]}>
        <coneGeometry args={[0.45, 0.25, 12, 1, true]} />
        <meshLambertMaterial color={WALL} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshLambertMaterial color={glow > 0 ? colorHex.ok : 0x334} emissive={colorHex.ok} emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

const PLANTS: [number, number][] = [[-0.6, -0.4], [0.5, -0.5], [0, 0.5], [-0.7, 0.5], [0.8, 0.3], [0.1, -0.1], [-0.2, 0.9]];

function Greenhouse({ look }: { look: SceneLook }) {
  const glow = lightGlow(look.lights);
  return (
    <group position={w3(PLACES.greenhouse!.at)}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.75, 1.8, 0.3, 20]} />
        <Mat color={WALL2} />
      </mesh>
      <Instances limit={PLANTS.length}>
        <coneGeometry args={[0.28, 0.8, 6]} />
        <meshLambertMaterial color={colorHex.plant} emissive={colorHex.plant} emissiveIntensity={glow * 0.25} />
        {PLANTS.map(([x, z], i) => (
          <Instance key={i} position={[x, 0.7, z]} scale={0.8 + (i % 3) * 0.2} />
        ))}
      </Instances>
      {/* Transparent dome. */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[1.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color={0xcff4f2} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[1.71, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={0xe8fbfa} wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function Shelter({ look }: { look: SceneLook }) {
  const s = look.shelterBig ? 1.3 : 1;
  return (
    <group position={w3(PLACES.shelter!.at)}>
      {/* Buried mound of regolith. */}
      <mesh scale={[1.7 * s, 1.0 * s, 1.5 * s]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color={colorHex.marsRose} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.85 * s, 1.65 * s, 1]}>
        <ringGeometry args={[0.92, 1.05, 24]} />
        <meshLambertMaterial color={colorHex.marsBrown} />
      </mesh>
      {/* Door frame facing the camera. */}
      <group position={w3({ u: 0.15, v: -1.35 * s }, 0)}>
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[0.7, 0.7, 0.35]} />
          <Mat color={WALL2} />
        </mesh>
        <mesh position={[0.12, 0.32, 0.12]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[0.42, 0.5, 0.2]} />
          <meshLambertMaterial color={0x2a3350} />
        </mesh>
      </group>
      {look.shelterBig && (
        <Instances limit={4}>
          <boxGeometry args={[0.5, 0.25, 0.3]} />
          <meshLambertMaterial color={colorHex.marsRose} />
          {[-1, -0.4, 0.4, 1].map((u, i) => (
            <Instance key={i} position={w3({ u: u * 1.6, v: 0.9 }, 0.15 + (i % 2) * 0.05)} rotation={[0, Math.PI / 4, 0]} />
          ))}
        </Instances>
      )}
    </group>
  );
}

function Battery({ look }: { look: SceneLook }) {
  const glow = lightGlow(look.lights);
  return (
    <group position={w3(PLACES.battery!.at)}>
      <mesh position={[0, 0.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[2.2, 1.2, 1.5]} />
        <Mat color={WALL} />
      </mesh>
      <Instances limit={6}>
        <cylinderGeometry args={[0.22, 0.22, 0.6, 10]} />
        <meshLambertMaterial color={0x5f6f99} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Instance key={i} position={w3({ u: -0.7 + (i % 3) * 0.7, v: i < 3 ? -0.3 : 0.3 }, 1.5)} />
        ))}
      </Instances>
      {/* Radiator fins. */}
      <Instances limit={4}>
        <boxGeometry args={[0.08, 1.1, 1.0]} />
        <meshLambertMaterial color={WALL2} />
        {[0, 1, 2, 3].map((i) => (
          <Instance key={i} position={w3({ u: 1.55 + i * 0.25, v: 0.2 }, 0.6)} rotation={[0, Math.PI / 4, 0]} />
        ))}
      </Instances>
      <mesh position={w3({ u: -0.4, v: -0.76 }, 0.75)} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.5, 0.12, 0.04]} />
        <meshLambertMaterial color={glow > 0 ? colorHex.ok : 0x334} emissive={colorHex.ok} emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

function Airlock() {
  return (
    <group position={w3(PLACES.airlock!.at)}>
      <group rotation={[0, -Math.PI / 4 + 0.35, 0]}>
        <mesh position={[0, 0.75, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.75, 0.75, 2.2, 14]} />
          <Mat color={WALL} />
        </mesh>
        <mesh position={[1.12, 0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.62, 0.1, 8, 16]} />
          <Mat color={colorHex.grey} />
        </mesh>
      </group>
      {/* Storage crates. */}
      <Instances limit={3}>
        <boxGeometry args={[0.6, 0.5, 0.6]} />
        <meshLambertMaterial color={colorHex.marsRose} />
        {[0, 1, 2].map((i) => (
          <Instance key={i} position={w3({ u: -1.2 + i * 0.55, v: -1.0 - (i % 2) * 0.3 }, 0.25 + (i === 1 ? 0 : 0))} rotation={[0, i * 0.5, 0]} />
        ))}
      </Instances>
    </group>
  );
}

const PANEL_ROWS = 2;
const PANEL_COLS = 4;

function Solar({ look, dim, at }: { look: SceneLook; dim: boolean; at: P2 }) {
  const dusty = look.panelsDusty || look.storm;
  const panels = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let r = 0; r < PANEL_ROWS; r++) for (let c = 0; c < PANEL_COLS; c++) out.push([(c - 1.5) * 1.3, 0.6, (r - 0.5) * 1.5]);
    return out;
  }, []);
  return (
    <group position={w3(at)} rotation={[0, Math.PI / 4, 0]}>
      <Instances limit={panels.length}>
        <boxGeometry args={[1.2, 0.06, 0.8]} />
        {dusty ? (
          <meshStandardMaterial color={dim ? colorHex.grey : colorHex.marsDust} roughness={1} metalness={0} transparent={dim} opacity={dim ? 0.45 : 1} />
        ) : (
          <meshStandardMaterial color={dim ? colorHex.grey : 0x3f6fc4} roughness={0.2} metalness={0.5} emissive={0x16306a} transparent={dim} opacity={dim ? 0.45 : 1} />
        )}
        {panels.map((p, i) => (
          <Instance key={i} position={p} rotation={[-0.35, 0, 0]} />
        ))}
      </Instances>
      <Instances limit={panels.length}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 5]} />
        <meshLambertMaterial color={colorHex.grey} />
        {panels.map(([x, , z], i) => (
          <Instance key={i} position={[x, 0.3, z]} />
        ))}
      </Instances>
    </group>
  );
}

function Landing({ dim, at }: { dim: boolean; at: P2 }) {
  return (
    <group position={w3(at)}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[2.3, 2.3, 0.06, 32]} />
        <Mat color={0x9aa1b3} dim={dim} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.75, 2.0, 32]} />
        <meshLambertMaterial color={dim ? colorHex.grey : colorHex.warn} transparent={dim} opacity={dim ? 0.5 : 1} />
      </mesh>
      {/* Cross marking. */}
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, r + Math.PI / 4]}>
          <planeGeometry args={[2.4, 0.32]} />
          <meshLambertMaterial color={dim ? colorHex.grey : 0xf3f5fa} transparent={dim} opacity={dim ? 0.5 : 1} />
        </mesh>
      ))}
      <mesh position={w3({ u: 2.2, v: 1.4 }, 0.8)}>
        <cylinderGeometry args={[0.06, 0.06, 1.6, 6]} />
        <Mat color={colorHex.grey} dim={dim} />
      </mesh>
    </group>
  );
}

function HitArea({ at, r, ...events }: { at: P2; r: number; onClick: (e: ThreeEvent<MouseEvent>) => void; onPointerOver: () => void; onPointerOut: () => void }) {
  return (
    <mesh position={w3(at, 0.9)} {...events}>
      <cylinderGeometry args={[r, r, 1.8, 12]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

// ------------------------------------------------------------------ markers & labels

/** Floating warning sign over a station with an open fault (shape + label text, not color alone). */
function FaultMarker({ id, mode }: { id: string; mode: Mode }) {
  const p = places(mode)[id]!;
  return (
    <group position={w3(p.at, p.labelY - 0.4)}>
      <mesh>
        <octahedronGeometry args={[0.38, 0]} />
        <meshLambertMaterial color={colorHex.warn} emissive={colorHex.warn} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.22, 12]} />
        <meshBasicMaterial color={colorHex.warn} />
      </mesh>
    </group>
  );
}

function Label({ st, at, short, onPick, coach, target }: { st: StationInfo; at: [number, number]; short: boolean; onPick: () => void; coach: ReactNode; target: boolean }) {
  const name = (short && tr.stationShort[st.id]) || tr.stations[st.id]!.name;
  return (
    <div className="s3-anchor" style={{ left: at[0], top: at[1] }}>
      <div className={`s3-label ${st.faults ? 'has-fault' : ''} ${st.locked ? 'locked' : ''} ${target ? 'coach-target' : ''}`} onClick={onPick} aria-hidden>
        <span className="s3-name">
          {st.locked && '🔒 '}
          {name}
        </span>
        {st.faults > 0 && <span className="s3-fault">⚠ {st.faults}</span>}
        {st.routine && !st.locked && st.routine.ok && <span className="s3-routine">🔧 {st.faults ? '' : fmtHours(st.routine.hours)}</span>}
      </div>
      {coach && <div className="s3-coach">{coach}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ astronaut

function Astronaut({ goal, mode, onArrive, skipRef }: { goal: string; mode: Mode; onArrive: (id: string) => void; skipRef: React.MutableRefObject<(() => boolean) | null> }) {
  const group = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const at = useRef(goal);
  const anim = useRef<{ pts: P2[]; t0: number; dur: number; goal: string } | null>(null);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const place = (p: P2, next?: P2) => {
    const g = group.current;
    if (!g) return;
    const [x, , z] = w3(p);
    g.position.set(x, 0, z);
    if (next) {
      const [nx, , nz] = w3(next);
      if (Math.hypot(nx - x, nz - z) > 1e-4) g.rotation.y = Math.atan2(nx - x, nz - z);
    }
  };

  const finish = () => {
    const a = anim.current;
    if (!a) return false;
    anim.current = null;
    place(a.pts[a.pts.length - 1]!);
    if (group.current) group.current.position.y = 0;
    at.current = a.goal;
    invalidate();
    arrive.current(a.goal);
    return true;
  };
  skipRef.current = finish;

  useLayoutEffect(() => {
    place(path(at.current, at.current, mode)[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (anim.current && anim.current.goal === goal) return;
    if (anim.current) finish();
    if (goal === at.current) {
      arrive.current(goal);
      return;
    }
    const pts = path(at.current, goal, mode);
    const dur = reduceMotion() ? 0 : walkSeconds(pts);
    anim.current = { pts, t0: performance.now(), dur, goal };
    if (dur === 0) finish();
    else invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const t = (performance.now() - a.t0) / (a.dur * 1000);
    if (t >= 1) {
      finish();
      return;
    }
    const p = pointAt(a.pts, t);
    place(p, pointAt(a.pts, Math.min(1, t + 0.02)));
    if (group.current) group.current.position.y = Math.abs(Math.sin(t * a.dur * 14)) * 0.12;
    invalidate();
  });

  return (
    <group ref={group} scale={1.3}>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.28, 0.5, 4, 10]} />
        <meshLambertMaterial color={0xf3f5fa} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.27, 14, 10]} />
        <meshLambertMaterial color={0xf3f5fa} />
      </mesh>
      <mesh position={[0, 1.22, 0.14]}>
        <sphereGeometry args={[0.18, 12, 8]} />
        <meshLambertMaterial color={colorHex.accentDim} emissive={colorHex.accent} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.7, -0.3]}>
        <boxGeometry args={[0.42, 0.5, 0.2]} />
        <meshLambertMaterial color={0xb7bccb} />
      </mesh>
      {/* Blob shadow (cheaper than real shadows). */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 14]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ scene

function ContextWatch({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}

export default function Scene3D({ stations, goal, look, onPick, onArrive, coachStation, coach, onLost, hint }: Scene3DProps) {
  const skipRef = useRef<(() => boolean) | null>(null);
  const lastSkip = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setSize([el.clientWidth, el.clientHeight]);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mode = modeFor(size[0]);
  const zoom = fitZoom(size[0], size[1], mode);
  const pl = places(mode);

  /** A click while walking skips the walk; it never queues another action. */
  const skip = () => {
    if (skipRef.current?.()) {
      lastSkip.current = performance.now();
      return true;
    }
    return false;
  };
  const pick = (id: string) => {
    if (skip()) return;
    if (performance.now() - lastSkip.current < 350) return;
    onPick(id);
  };
  const byId = (id: string) => stations.find((s) => s.id === id);
  const dim = (id: string) => !!byId(id)?.locked;
  const hit = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      pick(id);
    },
    onPointerOver: () => {
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  });
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  return (
    <section className={`scene3d ${look.storm ? 'storm' : ''} ${look.night ? 'night' : ''}`} aria-label={tr.ui.stations}>
      {coach && mode === 'compact' && <div className="s3-coach-top">{coach}</div>}
      <div className="scene3d-canvas" ref={box} onPointerDownCapture={() => skip()}>
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'low-power', alpha: false }}
          camera={{ near: 1, far: 140, zoom: 30 }}
          onPointerMissed={() => skip()}
        >
          <ContextWatch onLost={onLost} />
          <Rig look={look} mode={mode} />
          <Ground mode={mode} />
          <Corridor a={PLACES.hub!.at} b={PLACES.greenhouse!.at} />
          <Corridor a={PLACES.hub!.at} b={PLACES.battery!.at} />
          <Corridor a={PLACES.hub!.at} b={PLACES.airlock!.at} />
          <Corridor a={PLACES.hub!.at} b={PLACES.shelter!.at} />
          {/* Invisible, generous hit areas so small or gappy shapes are easy to tap. */}
          {stations.map((s) => (
            <HitArea key={s.id} at={pl[s.id]!.at} r={s.id === 'solar' || s.id === 'landing' ? 2.8 : s.id === 'hub' ? 1.9 : 1.7} {...hit(s.id)} />
          ))}
          <group {...hit('hub')}>
            <Hub look={look} />
          </group>
          <group {...hit('greenhouse')}>
            <Greenhouse look={look} />
          </group>
          <group {...hit('shelter')}>
            <Shelter look={look} />
          </group>
          <group {...hit('battery')}>
            <Battery look={look} />
          </group>
          <group {...hit('airlock')}>
            <Airlock />
          </group>
          <group {...hit('solar')}>
            <Solar look={look} dim={dim('solar')} at={pl.solar!.at} />
          </group>
          <group {...hit('landing')}>
            <Landing dim={dim('landing')} at={pl.landing!.at} />
          </group>
          {stations.filter((s) => s.faults > 0).map((s) => (
            <FaultMarker key={s.id} id={s.id} mode={mode} />
          ))}
          <Astronaut key={mode} goal={goal} mode={mode} onArrive={onArrive} skipRef={skipRef} />
        </Canvas>
        {size[0] > 0 &&
          stations.map((s) => {
            const p = pl[s.id]!;
            return <Label key={s.id} st={s} short={mode === 'compact'} at={project(p.at, p.labelY, zoom, size[0], size[1], mode)} onPick={() => pick(s.id)} target={s.id === coachStation} coach={s.id === coachStation && mode === 'wide' ? coach : null} />;
          })}
        {look.storm && <div className="dust-fx" aria-hidden />}
        {hint && (
          <p className="scene-hint small" aria-hidden>
            {tr.ui.sceneHint}
          </p>
        )}
      </div>
      {/* Keyboard and screen-reader access: the same stations as buttons. */}
      <ul className="sr-stations" aria-label={tr.ui.stationList}>
        {stations.map((s) => (
          <li key={s.id}>
            <button onClick={() => pick(s.id)}>
              {tr.stations[s.id]!.name}
              {s.here && ` · 📍 ${tr.ui.location}`}
              {s.faults > 0 && ` · ⚠ ${s.faults} ${tr.ui.problems}`}
              {s.routine && s.routine.ok && ` · 🔧 ${fmt(tr.ui.routineBadge, { h: fmtHours(s.routine.hours) })}`}
              {s.locked && ` · 🔒 ${tr.ui.locked}`}
              {!s.here && ` · 👟 ${fmtHours(s.walk)}`}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
