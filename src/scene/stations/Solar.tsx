// Solar field (EVA): panel rows, the work panel with its wipe surface, and a rover.
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { colorHex } from '../../ui/tokens';
import { Blinker, Lamp, now, RBox, showsBefore, stationAct, type RT, type StationProps } from '../core';
import { PANEL_COLS, PANEL_H, PANEL_ROWS, PANEL_TILT, PANEL_W, PANEL_WIPE_FAULTS, panelAt, RADIATOR, type V3 } from '../world';

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
      // A soft, uneven film of dust (thicker towards the lower edge where it slides down),
      // with drifts and a few streaks, not a speckled carpet.
      const base = ctx.createLinearGradient(0, 0, 0, DUST_H);
      base.addColorStop(0, 'rgba(201,179,174,0.78)');
      base.addColorStop(1, 'rgba(190,162,156,0.95)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, DUST_W, DUST_H);
      for (let i = 0; i < 140; i++) {
        const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * DUST_W;
        const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * DUST_H;
        const r = 10 + ((i * 13) % 30);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const dark = i % 3 === 0;
        g.addColorStop(0, dark ? 'rgba(154,122,118,0.35)' : 'rgba(222,206,200,0.35)');
        g.addColorStop(1, 'rgba(201,179,174,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.strokeStyle = 'rgba(176,136,132,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const x = (Math.sin(i * 3.7) * 0.5 + 0.5) * DUST_W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 10, DUST_H);
        ctx.stroke();
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
    const wiping = r && r.run.station === 'solar' && r.run.kind === 'wipe' && PANEL_WIPE_FAULTS.includes(r.run.faultId ?? '') && (r.phase === 'do' || r.phase === 'approach');
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
    if (!r || r.run.kind !== 'wipe' || r.run.station !== 'solar' || !PANEL_WIPE_FAULTS.includes(r.run.faultId ?? '') || r.phase !== 'do' || !e.uv) return;
    e.stopPropagation();
    r.mode = 'hand';
    r.holding = true;
    r.lastInput = now();
    rt.current.erase(e.uv.x, e.uv.y);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const r = rt.current.run;
    if (!r || !r.holding || r.run.kind !== 'wipe' || !PANEL_WIPE_FAULTS.includes(r.run.faultId ?? '') || r.phase !== 'do' || !e.uv) return;
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

/** Sol 4 "sand trick": low sand ridges along the lower edge of every panel (stay). */
function SandRidges({ rt, work }: StationProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const all = useMemo(() => {
    const out: V3[] = [];
    for (let r = 0; r < PANEL_ROWS; r++) for (let c = 0; c < PANEL_COLS; c++) out.push(panelAt(r, c));
    return out;
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const shown = useRef(-1);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const a = stationAct(rt.current, 'solar');
    let h = work.chosen.s4_dust === 'sandTrick' ? 1 : 0;
    if (a && a.faultId === 's4_dust' && a.optionId === 'sandTrick') h = a.phase === 'finish' ? 1 : a.p;
    if (a && a.before && a.faultId !== 's4_dust') h = a.from.chosen.s4_dust === 'sandTrick' ? 1 : 0;
    if (Math.abs(h - shown.current) < 0.003) return;
    shown.current = h;
    all.forEach((p, i) => {
      // Ridges appear one panel after another as the job goes on.
      const k = Math.max(0, Math.min(1, h * all.length - (all.length - 1 - i)));
      o.position.set(p[0], 0.05, p[2] + 0.62);
      o.scale.set(1.7, Math.max(0.001, k) * 0.12, 0.25);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, all.length]} receiveShadow>
      <sphereGeometry args={[0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={colorHex.marsDust} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Sol 8 "tie down the panels": straps over every panel and stakes in the ground (stay). */
function Straps({ rt, work }: StationProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const all = useMemo(() => {
    const out: V3[] = [];
    for (let r = 0; r < PANEL_ROWS; r++) for (let c = 0; c < PANEL_COLS; c++) out.push(panelAt(r, c));
    return out;
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const shown = useRef(-1);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const a = stationAct(rt.current, 'solar');
    let h = work.flags.panelsSecured ? 1 : 0;
    if (a && a.faultId === 's8_secure') h = a.phase === 'finish' ? 1 : a.p;
    else if (a && a.before) h = a.from.flags.panelsSecured ? 1 : 0;
    if (Math.abs(h - shown.current) < 0.003) return;
    shown.current = h;
    all.forEach((p, i) => {
      const k = Math.max(0, Math.min(1, h * all.length - i));
      o.position.set(p[0], p[1] + 0.06, p[2]);
      o.rotation.set(-Math.PI / 2 + PANEL_TILT, 0, 0);
      o.scale.set(k < 0.01 ? 0.001 : 1, 1, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, all.length]}>
      <boxGeometry args={[0.08, PANEL_H + 0.25, 0.03]} />
      <meshStandardMaterial color={colorHex.warn} roughness={0.8} />
    </instancedMesh>
  );
}

/** Sol 14 radiator (variant): fins covered in dust until cleaned. */
function Radiator({ rt, work }: StationProps) {
  const dust = useRef<THREE.MeshStandardMaterial>(null);
  const brush = useRef<THREE.Group>(null);
  const st = useMemo(() => ({ puff: 0, v: new THREE.Vector3() }), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = stationAct(rt.current, 'solar');
    const job = a && a.faultId === 's14_radiator';
    const w = a && a.before ? a.from : work;
    let d = w.open.includes('s14_radiator') ? 1 : 0;
    if (job && a.optionId === 'cleanRadiator') d = a.phase === 'finish' ? 0 : 1 - a.p;
    if (dust.current) dust.current.opacity = d * 0.9;
    if (brush.current) {
      brush.current.visible = !!job && a.optionId === 'cleanRadiator' && a.phase === 'do';
      if (brush.current.visible) {
        const x = Math.sin(a!.p * Math.PI * 6) * 0.7;
        const y = 0.5 + (1 - a!.p) * 0.6;
        brush.current.position.set(RADIATOR[0] + x, y, RADIATOR[2] + 0.18);
        if ((st.puff += dt * 10) > 1) {
          st.puff = 0;
          rt.current.puff(st.v.set(RADIATOR[0] + x, y, RADIATOR[2] + 0.25), 2);
        }
      }
    }
  });
  return (
    <group>
      <group position={RADIATOR}>
        <RBox size={[1.8, 1.3, 0.12]} position={[0, 0.85, 0]} color={colorHex.hullDark} />
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-0.8 + i * 0.2, 0.85, 0.08]}>
            <boxGeometry args={[0.04, 1.2, 0.1]} />
            <meshStandardMaterial color={colorHex.hull} metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 0.14]}>
          <planeGeometry args={[1.8, 1.3]} />
          <meshStandardMaterial ref={dust} color={colorHex.marsDust} transparent opacity={0} roughness={1} depthWrite={false} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.4, 6]} />
            <meshStandardMaterial color={colorHex.metal} />
          </mesh>
        ))}
      </group>
      <group ref={brush} visible={false}>
        <mesh>
          <boxGeometry args={[0.25, 0.06, 0.08]} />
          <meshStandardMaterial color={colorHex.accentDim} />
        </mesh>
      </group>
    </group>
  );
}

export default function Solar(props: StationProps) {
  const { rt, work } = props;
  const wp = panelAt(PANEL_ROWS - 1, 0);
  return (
    <>
      <SolarField rt={rt} dustLevel={work.solarDust} />
      <SandRidges {...props} />
      <Straps {...props} />
      <Radiator {...props} />
      <Lamp station="solar" rt={rt} work={work} at={[wp[0] - 1.25, 0.85, wp[2] + 0.4]} />
    </>
  );
}

export { Rover };
