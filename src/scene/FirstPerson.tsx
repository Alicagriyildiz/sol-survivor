// First-person Mars base (lazy chunk). Read-only view of the game: it gets station info,
// looks derived from GameState and the action being acted out, and reports clicks.
// The simulation step has already happened when an action plays here: skipping or
// interrupting the animation never changes the game.
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { fmt, tr } from '../content';
import type { ActionKind } from '../content/actions';
import type { StationInfo } from '../ui/stationInfo';
import { colorHex,} from '../ui/tokens';
import { fmtHours } from '../ui/parts';
import type { SceneLook, WorkLook } from './look';
import { ease, now, reduceMotion, type Phase, type RT, type SceneRun, type StationProps } from './core';
import { DustWall, Dust, Ground, Hills, Lights, Rocks, Sky, type Quality } from './env';
import { Hab, Roof } from './hab';
import { Hand } from './hand';
import Hub from './stations/Hub';
import Battery from './stations/Battery';
import Shelter from './stations/Shelter';
import Airlock from './stations/Airlock';
import Greenhouse from './stations/Greenhouse';
import Landing from './stations/Landing';
import Solar, { Rover } from './stations/Solar';
import {
  angleDelta,
  clampPitch,
  EYE,
  FAULT_WORK,
  HAB_R,
  PANEL_WIPE_FAULTS,
  path,
  pitchTo,
  pointAt,
  SPOTS,
  walkSeconds,
  yawTo,
  type V3,
} from './world';

export type { SceneRun };

export interface FirstPersonProps {
  stations: StationInfo[];
  /** Where the camera should be (walk target). */
  goal: string;
  look: SceneLook;
  work: WorkLook;
  run: SceneRun | null;
  /** Mission target (edge arrow when off screen). */
  target: string | null;
  onPick: (id: string) => void;
  onArrive: (id: string) => void;
  onRunDone: (id: number) => void;
  onLost: () => void;
  coach: ReactNode;
  /** Bottom bar (inventory, end sol). */
  dock: ReactNode;
  /** Helmet display line (e.g. the real solar event on Sol 12). */
  hud?: ReactNode;
  hint: boolean;
}

/** Phones and small touch screens: no shadows, fewer particles. */
function detectQuality(): Quality {
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q === 'low' || q === 'high') return q;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    return touch && Math.min(window.innerWidth, window.innerHeight) < 820 ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

const standPos = (id: string) => {
  const s = SPOTS[id] ?? SPOTS.hub!;
  return new THREE.Vector3(s.stand[0], EYE, s.stand[1]);
};

// ------------------------------------------------------------------ shared geometry

// ------------------------------------------------------------------ sky, light, ground

// ------------------------------------------------------------------ small animated parts

// ------------------------------------------------------------------ habitat

// ------------------------------------------------------------------ solar field + wipe surface

// ------------------------------------------------------------------ puffs (dust from brushing)

function Puffs({ rt }: { rt: MutableRefObject<RT> }) {
  const N = 90;
  const ref = useRef<THREE.Points>(null);
  const st = useMemo(() => ({ pos: new Float32Array(N * 3).fill(-999), vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0 }), []);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  useLayoutEffect(() => {
    rt.current.puff = (p, n) => {
      for (let k = 0; k < n; k++) {
        const i = st.next++ % N;
        const s = Math.sin(st.next * 17.17);
        st.pos[i * 3] = p.x + s * 0.08;
        st.pos[i * 3 + 1] = p.y + 0.02;
        st.pos[i * 3 + 2] = p.z + Math.cos(st.next * 9.1) * 0.08;
        st.vel[i * 3] = s * 0.35;
        st.vel[i * 3 + 1] = 0.35 + Math.abs(Math.cos(st.next * 3.3)) * 0.45;
        st.vel[i * 3 + 2] = Math.cos(st.next * 5.7) * 0.35;
        st.life[i] = 1;
      }
    };
  }, [rt, st]);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    for (let i = 0; i < N; i++) {
      if (st.life[i]! <= 0) continue;
      st.life[i]! -= dt * 0.9;
      if (st.life[i]! <= 0) {
        st.pos[i * 3 + 1] = -999;
        continue;
      }
      for (let k = 0; k < 3; k++) st.pos[i * 3 + k]! += st.vel[i * 3 + k]! * dt;
      st.vel[i * 3 + 1]! *= 0.97;
    }
    (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} color={colorHex.marsDust} size={0.16} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

// ------------------------------------------------------------------ hand and tool

// ------------------------------------------------------------------ camera and walking

function Eyes({ rt, goal, onArrive }: { rt: MutableRefObject<RT>; goal: string; onArrive: (id: string) => void }) {
  const { camera, invalidate } = useThree();
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const face = (id: string, close = false, faultId: string | null = null) => {
    const s = SPOTS[id] ?? SPOTS.hub!;
    const R = rt.current;
    const wp = (faultId && FAULT_WORK[faultId]) || s.work;
    const from: V3 = close ? wp.pos : [s.stand[0], EYE, s.stand[1]];
    const to = close ? wp.look : s.look;
    R.tPos.set(from[0], from[1], from[2]);
    R.tYaw = R.yaw + angleDelta(R.yaw, yawTo([from[0], from[2]], [to[0], to[2]]));
    R.tPitch = clampPitch(pitchTo(from, to));
  };

  const finishWalk = () => {
    const R = rt.current;
    const w = R.walk;
    if (!w) return false;
    R.walk = null;
    const end = w.pts[w.pts.length - 1]!;
    R.pos.set(end[0], EYE, end[1]);
    R.at = w.goal;
    face(w.goal);
    arrive.current(w.goal);
    return true;
  };

  useLayoutEffect(() => {
    const R = rt.current;
    R.at = goal;
    const p = standPos(goal);
    R.pos.copy(p);
    face(goal);
    R.yaw = R.tYaw;
    R.pitch = R.tPitch;
    R.pos.copy(R.tPos);
    R.skipWalk = finishWalk;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const R = rt.current;
    R.skipWalk = finishWalk;
    if (R.walk && R.walk.goal === goal) return;
    if (R.walk) finishWalk();
    if (goal === R.at) {
      arrive.current(goal);
      return;
    }
    const pts = path(R.at, goal);
    // Start from where the camera is (it may be at a close-up work pose).
    pts[0] = [R.pos.x, R.pos.z];
    const dur = reduceMotion() ? 0 : walkSeconds(pts);
    R.walk = { pts, t0: now(), dur, goal };
    if (dur === 0) finishWalk();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  // The close-up camera follows the action phases.
  const lastPhase = useRef<Phase>('none');
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const R = rt.current;
    const ph = R.run?.phase ?? 'none';
    if (ph !== lastPhase.current) {
      if (ph === 'approach') face(R.run!.run.station, true, R.run!.run.faultId);
      if (ph === 'none' && lastPhase.current !== 'none') face(R.at);
      lastPhase.current = ph;
    }
    const w = R.walk;
    if (w) {
      const t = (now() - w.t0) / w.dur;
      if (t >= 1) finishWalk();
      else {
        const e = ease(t);
        const p = pointAt(w.pts, e);
        const ahead = pointAt(w.pts, Math.min(1, e + 0.08));
        const total = w.pts.length > 1 ? Math.hypot(ahead[0] - p[0], ahead[1] - p[1]) : 0;
        if (total > 0.05) R.tYaw = R.yaw + angleDelta(R.yaw, yawTo(p, ahead));
        R.tPitch = -0.06;
        const bob = reduceMotion() ? 0 : Math.sin(t * w.dur * 9) * 0.035;
        R.pos.set(p[0], EYE + bob, p[1]);
        R.yaw += angleDelta(R.yaw, R.tYaw) * (1 - Math.exp(-dt * 5));
        R.pitch += (R.tPitch - R.pitch) * (1 - Math.exp(-dt * 4));
      }
    } else {
      R.pos.lerp(R.tPos, 1 - Math.exp(-dt * 4));
      R.yaw += angleDelta(R.yaw, R.tYaw) * (1 - Math.exp(-dt * 6));
      R.pitch += (R.tPitch - R.pitch) * (1 - Math.exp(-dt * 6));
    }
    camera.position.copy(R.pos);
    camera.rotation.set(R.pitch, R.yaw, 0, 'YXZ');
  });
  return null;
}

// ------------------------------------------------------------------ action driver

const DO_SECONDS: Record<ActionKind, number> = { wipe: 3.4, patch: 2.4, replace: 2.8, switch: 1.4, plug: 1.8, dig: 2.6, console: 1.8, wait: 1.8 };
const AUTO_AFTER = 5;
const FINISH_SECONDS = 1.5;

function RunDriver({ rt, setPhase, bar, onDone }: { rt: MutableRefObject<RT>; setPhase: (p: Phase) => void; bar: MutableRefObject<HTMLDivElement | null>; onDone: (id: number) => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const autoT = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const R = rt.current;
    const r = R.run;
    if (!r) return;
    const t = now();
    const go = (p: Phase) => {
      r.phase = p;
      r.t0 = t;
      setPhase(p);
    };
    if (r.phase === 'wait' && !R.walk && R.at === r.run.station) {
      if (r.run.station === 'solar') R.refill();
      R.brushOn = false;
      go('approach');
    } else if (r.phase === 'approach' && t - r.t0 > (reduceMotion() ? 0.1 : 0.7)) {
      r.lastInput = t;
      autoT.current = 0;
      go('do');
    } else if (r.phase === 'do') {
      const k = r.run.kind;
      const wipeHere = k === 'wipe' && r.run.station === 'solar' && PANEL_WIPE_FAULTS.includes(r.run.faultId ?? '');
      if (r.mode === 'hand' && t - r.lastInput > AUTO_AFTER) r.mode = 'auto';
      if (k === 'wait') r.mode = 'auto';
      if (wipeHere) {
        if (r.mode === 'auto') {
          // The astronaut brushes in rows across the panel.
          autoT.current += dt / DO_SECONDS.wipe;
          const s = Math.min(1, autoT.current);
          const rows = 4;
          const row = Math.min(rows - 1, Math.floor(s * rows));
          const f = s * rows - row;
          const u = 0.08 + 0.84 * (row % 2 ? 1 - f : f);
          const v = 1 - (row + 0.5) / rows;
          R.erase(u, v);
          if (s >= 1) r.p = 1;
        }
        r.p = Math.max(r.p, Math.min(1, R.cleared / 0.85));
        if (R.brushOn && Math.random() < 0.6) R.puff(R.brush, 1);
      } else {
        const speed = r.mode === 'auto' ? 1 / DO_SECONDS[k] : r.holding ? 1.25 / DO_SECONDS[k] : 0;
        r.p = Math.min(1, r.p + dt * speed);
      }
      if (r.p >= 1) go('finish');
    } else if (r.phase === 'finish' && t - r.t0 > FINISH_SECONDS) {
      const id = r.run.id;
      R.run = null;
      R.brushOn = false;
      if (r.run.to.solarDust > 0) R.refill();
      setPhase('none');
      done.current(id);
    }
    if (bar.current) bar.current.style.width = `${Math.round(r.p * 100)}%`;
  });
  return null;
}

// ------------------------------------------------------------------ labels overlay

function Overlay({ rt, labels, arrow, target, stations }: { rt: MutableRefObject<RT>; labels: MutableRefObject<Record<string, HTMLDivElement | null>>; arrow: MutableRefObject<HTMLDivElement | null>; target: string | null; stations: StationInfo[] }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const R = rt.current;
    let targetOff: { x: number; y: number } | null = null;
    for (const s of stations) {
      const el = labels.current[s.id];
      const spot = SPOTS[s.id];
      if (!spot) continue;
      v.set(...spot.label);
      const d = v.distanceTo(camera.position);
      v.project(camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const onScreen = !behind && x > 10 && x < size.width - 10 && y > 10 && y < size.height - 10;
      // Outside, the indoor stations would pile up on the hab: show only those with a problem
      // (and the mission target). Inside, far outdoor labels stay (they show the way).
      const camOut = Math.hypot(camera.position.x, camera.position.z) > HAB_R + 1.5 && !(camera.position.x > HAB_R && camera.position.x < 12.5 && Math.abs(camera.position.z) < 1.6);
      const indoor = !spot.outside;
      const clutter = camOut && indoor && s.id !== 'hub' && !s.faults && s.id !== target;
      const hide = !onScreen || clutter || (R.at === s.id && !R.walk && d < 3.2) || !!R.run;
      if (el) {
        el.style.display = hide ? 'none' : '';
        if (!hide) {
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${Math.max(0.75, Math.min(1, 9 / d))})`;
          el.style.opacity = d > 40 ? '0.85' : '1';
        }
      }
      if (s.id === target && !onScreen && !(R.at === s.id)) {
        // Direction from screen centre (flip if behind the camera).
        let dx = v.x;
        let dy = -v.y;
        if (behind) {
          dx = -dx;
          dy = -dy;
        }
        targetOff = { x: dx, y: dy };
      }
    }
    const a = arrow.current;
    if (a) {
      if (!targetOff || R.run || R.walk) a.style.display = 'none';
      else {
        const ang = Math.atan2(targetOff.y, targetOff.x);
        const cx = size.width / 2;
        const cy = size.height / 2;
        const k = Math.min((cx - 44) / Math.abs(Math.cos(ang) || 1e-6), (cy - 44) / Math.abs(Math.sin(ang) || 1e-6));
        a.style.display = '';
        a.style.transform = `translate(${cx + Math.cos(ang) * k}px, ${cy + Math.sin(ang) * k}px) translate(-50%, -50%)`;
        const icon = a.firstElementChild as HTMLElement | null;
        if (icon) icon.style.transform = `rotate(${ang}rad)`;
      }
    }
  });
  return null;
}

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

// ------------------------------------------------------------------ component

const KIND_ICON: Record<ActionKind, string> = { wipe: '🧹', patch: '🩹', replace: '🔩', switch: '🎚', plug: '🔌', dig: '⛏', console: '⌨', wait: '⏳' };

export default function FirstPerson(props: FirstPersonProps) {
  const { stations, goal, look, work, run, target, onPick, onArrive, onRunDone, onLost, coach, dock, hint, hud } = props;
  const rt = useRef<RT>({
    pos: new THREE.Vector3(0, EYE, 0),
    yaw: 0,
    pitch: 0,
    tPos: new THREE.Vector3(0, EYE, 0),
    tYaw: 0,
    tPitch: 0,
    walk: null,
    at: goal,
    run: null,
    brush: new THREE.Vector3(),
    brushOn: false,
    fieldDust: work.solarDust,
    puff: () => {},
    cleared: 0,
    refill: () => {},
    erase: () => {},
    skipWalk: () => false,
  });
  const [phase, setPhase] = useState<Phase>('none');
  const quality = useMemo(detectQuality, []);
  const [auto, setAuto] = useState(false);
  const bar = useRef<HTMLDivElement | null>(null);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const arrow = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastSkip = useRef(0);

  // A new action to act out.
  useEffect(() => {
    if (!run) return;
    const R = rt.current;
    if (R.run?.run.id === run.id) return;
    R.run = { run, phase: 'wait', t0: now(), p: 0, mode: run.kind === 'wait' ? 'auto' : 'hand', holding: false, lastInput: now() };
    setAuto(run.kind === 'wait');
    setPhase('wait');
  }, [run]);

  const skipRun = () => {
    const R = rt.current;
    const r = R.run;
    if (!r) return;
    const id = r.run.id;
    R.run = null;
    R.brushOn = false;
    R.fieldDust = r.run.to.solarDust;
    R.refill();
    setPhase('none');
    onRunDone(id);
  };
  const setHold = (on: boolean) => {
    const r = rt.current.run;
    if (!r) return;
    r.holding = on;
    r.lastInput = now();
    if (on) r.mode = 'hand';
  };
  const autoRun = () => {
    const r = rt.current.run;
    if (!r) return;
    r.mode = 'auto';
    setAuto(true);
  };

  const skipWalk = () => {
    if (rt.current.walk && rt.current.skipWalk()) {
      lastSkip.current = performance.now();
      return true;
    }
    return false;
  };
  const pick = (id: string) => {
    if (skipWalk()) return;
    if (performance.now() - lastSkip.current < 350) return;
    if (rt.current.run) return;
    onPick(id);
  };

  // Look around: drag (mouse or finger). A short tap is a click, not a drag.
  const onDown = (e: React.PointerEvent) => {
    if (skipWalk()) return;
    if (rt.current.run) {
      // Pressing anywhere on the view counts as holding for the hold-type actions.
      // (Wiping: a press anywhere starts the stroke, so it may begin off the panel.)
      if (rt.current.run.phase === 'do') setHold(true);
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      d.x = e.clientX;
      d.y = e.clientY;
      const R = rt.current;
      R.yaw += dx * 0.0042;
      R.tYaw = R.yaw;
      R.pitch = clampPitch(R.pitch + dy * 0.0042);
      R.tPitch = R.pitch;
    };
    const up = () => {
      drag.current = null;
      const r = rt.current.run;
      if (r) r.holding = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Keyboard during an action: Enter = let it do itself, Space (hold) = do it, Esc = skip.
  useEffect(() => {
    if (phase === 'none') return;
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipRun();
      else if (e.key === 'Enter') autoRun();
      else if (e.key === ' ') {
        e.preventDefault();
        setHold(true);
      }
    };
    const ku = (e: KeyboardEvent) => e.key === ' ' && setHold(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const sp: StationProps = { rt, work, look };
  /** Walls and ground: a click there stops (things behind a wall are not picked). */
  const block = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();
  const hit = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      pick(id);
    },
  });

  const r = run;
  const kind = r?.kind ?? null;
  const wipeHere = kind === 'wipe' && r?.station === 'solar' && PANEL_WIPE_FAULTS.includes(r.faultId ?? '');
  const hintText = kind ? (wipeHere ? tr.act.hintWipe : kind === 'wait' ? (r?.station === 'shelter' && r.faultId === 's12_spe' ? tr.act.inShelter : tr.act.hintWait) : tr.act.hint[kind]) : '';

  return (
    <section className={`fp ${look.storm ? 'storm' : ''} ${look.night ? 'night' : ''}`} aria-label={tr.ui.stations}>
      <div className="fp-canvas" onPointerDown={onDown}>
        <Canvas
          shadows={quality === 'high' ? { type: THREE.PCFShadowMap } : false}
          dpr={quality === 'high' ? [1, 1.5] : [1, 1.25]}
          gl={{ antialias: true, powerPreference: 'default', alpha: false }}
          camera={{ fov: 70, near: 0.05, far: 600, position: [0, EYE, 0] }}
        >
          <ContextWatch onLost={onLost} />
          <Sky look={look} />
          <Lights look={look} quality={quality} />
          <Dust look={look} quality={quality} />
          <DustWall look={look} />
          <group onClick={block}>
            <Ground />
            <Hills />
            <Rocks quality={quality} />
            <Hab rt={rt} look={look} />
          </group>
          <group {...hit('hub')}>
            <Hub {...sp} />
          </group>
          <Roof />
          <group {...hit('battery')}>
            <Battery {...sp} />
          </group>
          <group {...hit('shelter')}>
            <Shelter {...sp} />
          </group>
          <group {...hit('airlock')}>
            <Airlock {...sp} />
          </group>
          <group {...hit('greenhouse')}>
            <Greenhouse {...sp} />
          </group>
          <group {...hit('solar')}>
            <Solar {...sp} />
          </group>
          <Rover />
          <group {...hit('landing')}>
            <Landing {...sp} />
          </group>
          <Puffs rt={rt} />
          <Hand rt={rt} />
          <Eyes rt={rt} goal={goal} onArrive={onArrive} />
          <RunDriver rt={rt} setPhase={setPhase} bar={bar} onDone={onRunDone} />
          <Overlay rt={rt} labels={labels} arrow={arrow} target={target} stations={stations} />
        </Canvas>
        <div className="fp-visor" aria-hidden />
        {stations.map((s) => (
          <div key={s.id} ref={(el) => void (labels.current[s.id] = el)} className={`fp-label ${s.faults ? 'has-fault' : ''} ${s.locked ? 'locked' : ''}`} onClick={() => pick(s.id)} aria-hidden style={{ display: 'none' }}>
            <span className="fp-name">
              {s.locked && '🔒 '}
              {(tr.stationShort[s.id] as string | undefined) ?? tr.stations[s.id]!.name}
            </span>
            {s.faults > 0 ? <span className="fp-fault">⚠ {s.faults}</span> : s.routine && s.routine.ok && !s.locked ? <span className="fp-routine">🔧</span> : <span className="fp-ok">✓</span>}
          </div>
        ))}
        {target && (
          <div ref={arrow} className="fp-arrow" aria-hidden style={{ display: 'none' }}>
            <span className="fp-arrow-icon">➤</span>
            <span className="fp-arrow-name">{(tr.stationShort[target] as string | undefined) ?? tr.stations[target]!.name}</span>
          </div>
        )}
        {coach && <div className="fp-coach">{coach}</div>}
        {hint && phase === 'none' && (
          <p className="fp-hint small" aria-hidden>
            {tr.act.lookHint}
          </p>
        )}
        {r && phase !== 'none' && (
          <div className={`fp-run ${phase}`} role="status">
            <div className="fp-run-title">
              <span aria-hidden>{KIND_ICON[r.kind]}</span> <strong>{r.label}</strong>
            </div>
            {phase === 'finish' ? (
              <p className="fp-run-done">
                ✓ {tr.act.done} <span className="chip-cost">⏱ −{fmtHours(r.hours)}</span>
              </p>
            ) : phase === 'do' ? (
              <>
                <p className="fp-run-hint">{auto ? tr.act.autoDoing : hintText}</p>
                <div className="fp-progress" aria-hidden>
                  <div ref={bar} />
                </div>
                <div className="row wrap fp-run-btns">
                  {!wipeHere && kind !== 'wait' && !auto && (
                    <button
                      className="btn primary"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setHold(true);
                      }}
                      onPointerUp={() => setHold(false)}
                      onPointerLeave={() => setHold(false)}
                    >
                      ✋ {tr.act.hold}
                    </button>
                  )}
                  {!auto && kind !== 'wait' && (
                    <button className="btn" onClick={autoRun}>
                      ▶ {tr.act.auto}
                    </button>
                  )}
                  <button className="btn ghost" onClick={skipRun}>
                    ⏭ {tr.act.skip}
                  </button>
                </div>
              </>
            ) : (
              <div className="row wrap fp-run-btns">
                <p className="fp-run-hint">{tr.act.going}</p>
                <button className="btn ghost" onClick={skipRun}>
                  ⏭ {tr.act.skip}
                </button>
              </div>
            )}
          </div>
        )}
        {hud && <div className="fp-hud">{hud}</div>}
        <div className="fp-dock">{dock}</div>
      </div>
      {/* Station buttons: visible strip, also the keyboard way to move. */}
      <ul className="fp-stations" aria-label={tr.ui.stationList}>
        {stations.map((s) => (
          <li key={s.id}>
            <button className={`fp-st ${s.faults ? 'has-fault' : ''} ${s.id === target ? 'target' : ''}`} onClick={() => pick(s.id)} disabled={phase !== 'none'}>
              {s.faults > 0 ? '⚠ ' : s.locked ? '🔒 ' : ''}
              {(tr.stationShort[s.id] as string | undefined) ?? tr.stations[s.id]!.name}
              <span className="sr-only">
                {s.here && ` · 📍 ${tr.ui.location}`}
                {s.faults > 0 && ` · ⚠ ${s.faults} ${tr.ui.problems}`}
                {s.routine && s.routine.ok && ` · 🔧 ${fmt(tr.ui.routineBadge, { h: fmtHours(s.routine.hours) })}`}
                {s.locked && ` · 🔒 ${tr.ui.locked}`}
                {!s.here && ` · 👟 ${fmtHours(s.walk)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
