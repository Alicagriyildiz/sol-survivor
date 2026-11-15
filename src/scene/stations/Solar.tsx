// Solar field (EVA): panel rows, the work panel with its wipe surface, and a rover.
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { colorHex, colors } from '../../ui/tokens';
import { Blinker, Lamp, now, RBox, showsBefore, type RT, type StationProps } from '../core';
import { PANEL_COLS, PANEL_H, PANEL_ROWS, PANEL_TILT, PANEL_W, panelAt, type V3 } from '../world';

const DUST_W = 256;

const DUST_H = 160;

const GRID_X = 16;

const GRID_Y = 10;

function SolarField({ rt, dustLevel }: { rt: MutableRefObject<RT>; dustLevel: number }) {
  const cells = useRef<THREE.InstancedMesh>(null);
  const cellMat = useRef<THREE.MeshStandardMaterial>(null);
  const dustMesh = useRef<THREE.Mesh>(null);
  const dustMat = useRef<THREE.MeshLambertMaterial>(null);
  const workMat = useRef<THREE.MeshStandardMaterial>(null);
  const shine = useRef(0);
  const panels = useMemo(() => {
    const out: V3[] = [];
    for (let r = 0; r < PANEL_ROWS; r++) for (let c = 0; c < PANEL_COLS; c++) if (!(r === PANEL_ROWS - 1 && c === 0)) out.push(panelAt(r, c));
    return out;
  }, []);
  const work = panelAt(PANEL_ROWS - 1, 0);
  const tilt = -Math.PI / 2 + PANEL_TILT;

  // Wipe canvas: alpha = dust left. Grid tracks how much is cleared.
  const dust = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = DUST_W;
    canvas.height = DUST_H;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const grid = new Uint8Array(GRID_X * GRID_Y);
    return { canvas, ctx, tex, grid };
  }, []);
  useLayoutEffect(() => {
    const { ctx, tex, grid } = dust;
    const refill = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, DUST_W, DUST_H);
      ctx.fillStyle = colors.marsDust;
      ctx.globalAlpha = 0.93;
      ctx.fillRect(0, 0, DUST_W, DUST_H);
      for (let i = 0; i < 900; i++) {
        const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * DUST_W;
        const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * DUST_H;
        ctx.globalAlpha = 0.25 + ((i * 7) % 10) / 20;
        ctx.fillStyle = i % 3 ? colors.marsRose : colors.marsBrown;
        ctx.fillRect(x, y, 2 + (i % 4), 2 + (i % 3));
      }
      ctx.globalAlpha = 1;
      grid.fill(0);
      rt.current.cleared = 0;
      tex.needsUpdate = true;
    };
    const erase = (u: number, v: number) => {
      const x = u * DUST_W;
      const y = (1 - v) * DUST_H;
      const R = 30;
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(x, y, 4, x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      let n = 0;
      for (let gy = 0; gy < GRID_Y; gy++)
        for (let gx = 0; gx < GRID_X; gx++) {
          const cx = ((gx + 0.5) / GRID_X) * DUST_W;
          const cy = ((gy + 0.5) / GRID_Y) * DUST_H;
          if (Math.hypot(cx - x, cy - y) < R * 0.8) grid[gy * GRID_X + gx] = 1;
          n += grid[gy * GRID_X + gx]!;
        }
      rt.current.cleared = n / grid.length;
      tex.needsUpdate = true;
      // Brush point in the world, for the hand and the dust puffs.
      const m = dustMesh.current;
      if (m) {
        rt.current.brush.set((u - 0.5) * PANEL_W, (v - 0.5) * PANEL_H, 0.03).applyMatrix4(m.matrixWorld);
        rt.current.brushOn = true;
      }
    };
    rt.current.refill = refill;
    rt.current.erase = erase;
    refill();
  }, [dust, rt]);

  useLayoutEffect(() => {
    const m = cells.current;
    if (!m) return;
    const o = new THREE.Object3D();
    panels.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2]);
      o.rotation.set(tilt, 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [panels, tilt]);

  const clean = useMemo(() => new THREE.Color(colorHex.panelCell), []);
  const dirty = useMemo(() => new THREE.Color(colorHex.marsDust), []);
  useFrame((_, dt) => {
    const R = rt.current;
    const r = R.run;
    const before = showsBefore(R, 'solar');
    const target = before ? r!.run.from.solarDust : dustLevel;
    R.fieldDust += (target - R.fieldDust) * (1 - Math.exp(-dt * (before ? 8 : 2.2)));
    const d = Math.max(0, Math.min(1, R.fieldDust));
    if (cellMat.current) {
      cellMat.current.color.copy(clean).lerp(dirty, d * 0.92);
      cellMat.current.roughness = 0.25 + d * 0.7;
      cellMat.current.metalness = 0.55 * (1 - d);
    }
    // Work panel: dust layer from the canvas; level fades with the field outside a wipe.
    const wiping = r && r.run.station === 'solar' && r.run.kind === 'wipe' && (r.phase === 'do' || r.phase === 'approach');
    if (dustMat.current) dustMat.current.opacity = wiping ? Math.max(0.0001, r!.run.from.solarDust) : d;
    if (r && r.run.station === 'solar' && r.phase === 'finish') shine.current = 1;
    shine.current = Math.max(0, shine.current - dt * 0.6);
    if (workMat.current) {
      workMat.current.emissiveIntensity = 0.15 + shine.current * 1.4;
      workMat.current.roughness = 0.2 + d * 0.6;
    }
    if (cellMat.current) cellMat.current.emissiveIntensity = 0.1 + shine.current * 0.9 * (1 - d);
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    const r = rt.current.run;
    if (!r || r.run.kind !== 'wipe' || r.run.station !== 'solar' || r.phase !== 'do' || !e.uv) return;
    e.stopPropagation();
    r.mode = 'hand';
    r.holding = true;
    r.lastInput = now();
    rt.current.erase(e.uv.x, e.uv.y);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const r = rt.current.run;
    if (!r || !r.holding || r.run.kind !== 'wipe' || r.phase !== 'do' || !e.uv) return;
    e.stopPropagation();
    r.mode = 'hand';
    r.lastInput = now();
    rt.current.erase(e.uv.x, e.uv.y);
  };

  return (
    <group>
      <instancedMesh ref={cells} args={[undefined, undefined, panels.length]} castShadow receiveShadow>
        <boxGeometry args={[PANEL_W, PANEL_H, 0.05]} />
        <meshStandardMaterial ref={cellMat} color={colorHex.panelCell} roughness={0.25} metalness={0.55} emissive={0x16306a} emissiveIntensity={0.1} />
      </instancedMesh>
      {/* Frames and posts. */}
      {[...panels, work].map((p, i) => (
        <group key={i} position={[p[0], 0, p[2]]}>
          <mesh position={[0, (p[1] - 0.25) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, p[1] - 0.25, 6]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        </group>
      ))}
      {/* The work panel: bigger detail, wipe surface on top. */}
      <group position={work} rotation={[tilt, 0, 0]}>
        <RBox size={[PANEL_W + 0.1, PANEL_H + 0.1, 0.05]} r={0.02} position={[0, 0, -0.03]} color={colorHex.hullDark} metal={0.4} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[PANEL_W, PANEL_H, 0.04]} />
          <meshStandardMaterial ref={workMat} color={colorHex.panelCell} roughness={0.2} metalness={0.6} emissive={0x2a58b0} emissiveIntensity={0.15} />
        </mesh>
        {/* Cell grid lines. */}
        {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
          <mesh key={x} position={[x, 0, 0.022]}>
            <planeGeometry args={[0.012, PANEL_H]} />
            <meshBasicMaterial color={0x9fb6e6} transparent opacity={0.35} />
          </mesh>
        ))}
        {[-0.275, 0, 0.275].map((y) => (
          <mesh key={y} position={[0, y, 0.022]}>
            <planeGeometry args={[PANEL_W, 0.012]} />
            <meshBasicMaterial color={0x9fb6e6} transparent opacity={0.35} />
          </mesh>
        ))}
        <mesh ref={dustMesh} position={[0, 0, 0.03]} onPointerDown={down} onPointerMove={move}>
          <planeGeometry args={[PANEL_W, PANEL_H]} />
          <meshLambertMaterial ref={dustMat} map={dust.tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      </group>
      {/* Junction box with the status lamp. */}
      <RBox size={[0.4, 0.5, 0.25]} position={[work[0] - 1.25, 0.5, work[2] + 0.4]} color={colorHex.hull} />
    </group>
  );
}

/** Small rover with a jointed arm (moving detail near the solar field). */
function Rover() {
  const base = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const fore = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (base.current) base.current.rotation.y = Math.sin(t * 0.4) * 0.9;
    if (upper.current) upper.current.rotation.z = -0.6 + Math.sin(t * 0.7) * 0.35;
    if (fore.current) fore.current.rotation.z = 1.1 + Math.sin(t * 0.9 + 1) * 0.4;
  });
  return (
    <group position={[17.5, 0, -14.5]} rotation={[0, 0.6, 0]}>
      <RBox size={[2.0, 0.55, 1.3]} position={[0, 0.75, 0]} color={colorHex.hull} />
      {[-0.75, 0.75].map((x) =>
        [-0.75, 0.75].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.35, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.25, 14]} />
            <meshStandardMaterial color={0x3a3f50} roughness={0.9} />
          </mesh>
        )),
      )}
      <group ref={base} position={[0.6, 1.05, 0]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.2, 0.18, 12]} />
          <meshStandardMaterial color={colorHex.metal} />
        </mesh>
        <group ref={upper}>
          <RBox size={[0.12, 0.9, 0.12]} r={0.03} position={[0, 0.45, 0]} color={colorHex.hullDark} />
          <group ref={fore} position={[0, 0.9, 0]}>
            <mesh>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color={colorHex.metal} />
            </mesh>
            <RBox size={[0.1, 0.7, 0.1]} r={0.03} position={[0, 0.35, 0]} color={colorHex.hull} />
            <mesh position={[0, 0.72, 0]}>
              <coneGeometry args={[0.08, 0.16, 8]} />
              <meshStandardMaterial color={colorHex.accent} emissive={colorHex.accent} emissiveIntensity={0.6} />
            </mesh>
          </group>
        </group>
      </group>
      <Blinker at={[-0.8, 1.15, 0]} color={colorHex.accent} period={1.2} />
    </group>
  );
}

export default function Solar({ rt, work }: StationProps) {
  const wp = panelAt(PANEL_ROWS - 1, 0);
  return (
    <>
      <SolarField rt={rt} dustLevel={work.solarDust} />
      <Lamp station="solar" rt={rt} work={work} at={[wp[0] - 1.25, 0.85, wp[2] + 0.4]} />
    </>
  );
}

export { Rover };
