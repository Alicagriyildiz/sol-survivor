import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { SolarEventCard } from './DataViews';
import { LangSwitch } from './LangSwitch';
import { faultTitle, optionLabel, sourceText } from '../blackbox/text';
import { data, engine, fmt, tr } from '../content';
import {
  activeNotes,
  criticalResources,
  hoursLog,
  mission,
  optionViews,
  previewParts,
  routineView,
  stationViews,
  todayFaults,
  type OptionView,
  type RoutineView,
} from '../sim/selectors';
import type { Action, GameState, Invalid, ResourceId } from '../sim/types';
import { weakGauge } from '../bots/follower';
import { DeltaList, fmtDate, fmtHours, Inventory, TopBar, Warnings, type Level } from './parts';
import { stationInfo, type StationInfo } from './stationInfo';
import { markSceneBroken, SceneBoundary, sceneBroken, webglAvailable, type View } from './view';
import { sceneLook, workLook } from '../scene/look';
import { optionAction, routineAction, type ActionKind } from '../content/actions';
import type { SceneRun } from '../scene/FirstPerson';

// The first-person 3D scene is a separate chunk, loaded only when the 3D view is on.
const FirstPerson = lazy(() => import('../scene/FirstPerson'));

/** A choice being acted out in the 3D view. The game step has already happened. */
interface PlayRun {
  id: number;
  before: GameState;
  kind: ActionKind;
  station: string;
  label: string;
  faultId: string | null;
  optionId: string | null;
  routineId: string | null;
}
let runIds = 0;
const stationOf = (faultId: string) => engine.fault(faultId).station;

function runFor(s: GameState, a: Action): PlayRun | null {
  if (a.type === 'resolve') {
    const o = engine.option(a.faultId, a.optionId);
    return { id: ++runIds, before: s, kind: optionAction(a.faultId, a.optionId), station: o.station ?? engine.fault(a.faultId).station, label: optionLabel(a.faultId, a.optionId), faultId: a.faultId, optionId: a.optionId, routineId: null };
  }
  if (a.type === 'routine') {
    const r = engine.routine(a.routineId);
    return { id: ++runIds, before: s, kind: routineAction(a.routineId), station: r.station, label: tr.routines[a.routineId]!.label, faultId: null, optionId: null, routineId: a.routineId };
  }
  return null;
}

/** The last action and the states around it, for the "what just happened" line. */
export interface LastAction {
  action: Action;
  before: GameState;
  after: GameState;
}

/** Sol-1 tutorial steps, in order. `null` = tutorial off or finished. */
export const TUTORIAL = ['bars', 'hours', 'goHub', 'choose', 'seal', 'done'] as const;
export type TutorialStep = (typeof TUTORIAL)[number];

const NIGHT_MS = 1100;

const invalidText = (r: Invalid): string => {
  switch (r) {
    case 'hours':
      return tr.ui.notEnoughHours;
    case 'items':
      return tr.ui.missingItem;
    case 'requires':
      return tr.ui.requiresMissing;
    case 'routineDone':
      return tr.ui.routineDone;
    default:
      return tr.ui.locked;
  }
};

const resList = (rs: ResourceId[]) => rs.map((r) => tr.res[r]).join(', ');

/** Small tutorial bubble placed next to what it talks about. One short sentence. */
export function CoachBubble({ text, onNext, onSkip, inline = false }: { text: string; onNext?: (() => void) | null; onSkip: () => void; inline?: boolean }) {
  return (
    <div className={`coach-bubble ${inline ? 'inline' : ''}`} role="note">
      <span aria-hidden>🧑‍🚀 </span>
      {text}
      <div className="row coach-actions">
        {onNext && (
          <button className="btn primary small" onClick={onNext}>
            {tr.tutorial.next}
          </button>
        )}
        <button className="btn ghost small" onClick={onSkip} aria-label={tr.tutorial.skip} title={tr.tutorial.skip}>
          ✕
        </button>
      </div>
    </div>
  );
}

function CostLine({ v }: { v: { cost: OptionView['cost'] } }) {
  const c = v.cost;
  const parts: string[] = [];
  if (c.walk > 0) parts.push(`👟 ${fmtHours(c.walk)}`);
  if (c.eva > 0) parts.push(`🚀 ${fmtHours(c.eva)}`);
  if (parts.length) parts.push(`🔧 ${fmtHours(c.work)}`);
  return (
    <span className="cost">
      ⏱ <strong>{fmtHours(c.total)}</strong> {parts.length > 0 && <span className="dim small">({parts.join(' + ')})</span>}
    </span>
  );
}

/** Extra lines under a preview: reserve, critical hours, blocked faults. */
function PreviewNotes({ v }: { v: Pick<OptionView, 'reserves' | 'critHealth' | 'blocks'> }) {
  return (
    <>
      {v.reserves.length > 0 && <p className="note warn small">🔋 {fmt(tr.ui.willUseReserve, { res: resList(v.reserves) })}</p>}
      {v.critHealth < -0.05 && <p className="note danger small">♥ {tr.ui.critHours}</p>}
      {v.blocks.length > 0 && <p className="note warn small">⏱ {fmt(tr.ui.blocksOthers, { list: v.blocks.map(faultTitle).join(', ') })}</p>}
    </>
  );
}

function Why({ text }: { text: string }) {
  return (
    <details className="why">
      <summary>ⓘ {tr.ui.whyBtn}</summary>
      <p>{text}</p>
    </details>
  );
}

function OptionCard({ v, level, onChoose }: { v: OptionView; level: Level; onChoose: () => void }) {
  const t = tr.faults[v.faultId]!.options[v.optionId]!;
  const items = engine.option(v.faultId, v.optionId).items ?? {};
  return (
    <div className={`option ${v.invalid ? 'disabled' : ''}`}>
      <div className="option-head">
        <strong className="option-label">{t.label}</strong>
        <CostLine v={v} />
      </div>
      <div className="option-row">
        <DeltaList d={v.preview} level={level} empty={<span className="dim small">—</span>} />
        {Object.keys(items).length > 0 && (
          <span className="small">
            {tr.ui.needs}: {Object.entries(items).map(([k, n]) => `${tr.items[k]} ×${n}`).join(', ')}
          </span>
        )}
        {level === 'junior' && v.tags.includes('invest') && <span className="tag invest">💡 {tr.ui.investHint}</span>}
        {level === 'junior' && v.tags.includes('laterCost') && <span className="tag later">⏳ {tr.ui.laterCostHint}</span>}
      </div>
      {v.notes.map((n) => (
        <p key={n} className="chain-note small">
          🔗 {tr.chain[n]}
        </p>
      ))}
      {!v.invalid && <PreviewNotes v={v} />}
      <div className="option-foot">
        <Why text={t.why} />
        {v.invalid ? (
          <span className="invalid">⛔ {invalidText(v.invalid)}</span>
        ) : (
          <button className="btn primary" onClick={onChoose}>
            {tr.ui.choose}
          </button>
        )}
      </div>
    </div>
  );
}

function RoutineCard({ v, level, lockedText, onDo }: { v: RoutineView; level: Level; lockedText: string | null; onDo: () => void }) {
  const t = tr.routines[v.routineId]!;
  return (
    <div className={`option routine ${v.invalid || lockedText ? 'disabled' : ''}`}>
      <div className="option-head">
        <strong className="option-label">🔧 {t.label}</strong>
        <CostLine v={v} />
      </div>
      <div className="option-row">
        <DeltaList d={v.preview} level={level} />
      </div>
      {!v.invalid && !lockedText && <PreviewNotes v={v} />}
      <div className="option-foot">
        <Why text={t.why} />
        {lockedText ? (
          <span className="invalid">⛔ {lockedText}</span>
        ) : v.invalid ? (
          <span className="invalid">{v.done ? `✓ ${tr.ui.routineDone}` : `⛔ ${invalidText(v.invalid)}`}</span>
        ) : (
          <button className="btn" onClick={onDo}>
            {tr.ui.choose}
          </button>
        )}
      </div>
    </div>
  );
}

function StationPanel({
  s,
  stationId,
  level,
  sol1,
  coach,
  act,
  open,
  close,
  side = false,
}: {
  side?: boolean;
  s: GameState;
  stationId: string;
  level: Level;
  sol1: boolean;
  coach: ReactNode;
  act: (a: Action) => void;
  open: (station: string) => void;
  close: () => void;
}) {
  const view = stationViews(engine, s).find((x) => x.id === stationId)!;
  const st = tr.stations[stationId]!;
  const elsewhere = [...new Set(s.faults.map((f) => engine.fault(f.faultId).station))].filter((x) => x !== stationId);
  // Sol 1 is the tutorial: no deferring, and maintenance only after both faults are fixed.
  const routineLock = sol1 && s.faults.length > 0 ? tr.ui.sol1Locked : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeFn = useRef(close);
  closeFn.current = close;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeFn.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Give keyboard users their place back.
      if (before && document.contains(before)) before.focus();
    };
  }, [stationId]);
  return (
    <div className={side ? 'panel-dock' : 'panel-backdrop'} onClick={side ? undefined : close}>
      <section className={`panel ${side ? 'side-panel' : ''}`} role="dialog" aria-modal={!side} aria-label={st.name} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{st.name}</h2>
          <button ref={closeRef} className="btn ghost" onClick={close} aria-label={tr.ui.close}>
            ✕
          </button>
        </div>
        {(view.eva || view.locked) && (
          <div className="row wrap">
            {view.eva && (
              <details className="why">
                <summary>🚀 {tr.ui.eva}</summary>
                <p>{tr.ui.evaShort}</p>
              </details>
            )}
            {view.locked && <p className="note danger">🔒 {stationId === 'landing' && s.sol < 13 ? tr.ui.lockedLanding : tr.ui.lockedStorm}</p>}
          </div>
        )}
        {coach}
        {view.faults.length === 0 && (
          <div className="note ok-note">
            <p>✓ {tr.ui.noProblemsHere}</p>
            {elsewhere.length > 0 ? (
              <div className="row wrap">
                {elsewhere.map((x) => (
                  <button key={x} className={`btn small ${level === 'junior' ? 'primary' : ''}`} onClick={() => open(x)}>
                    ⚠ {tr.stations[x]!.name} →
                  </button>
                ))}
              </div>
            ) : (
              <p className="small dim">{tr.ui.allSolvedToday}</p>
            )}
          </div>
        )}
        {view.faults.map((fid) => (
          <div key={fid} className="fault">
            <h3>⚠ {tr.faults[fid]!.title}</h3>
            <p className="fault-desc">{tr.faults[fid]!.desc}</p>
            {fid === 's12_spe' && <SolarEventCard s={s} />}
            <div className="options">
              {optionViews(engine, s, fid)
                .filter((v) => !(sol1 && v.kind === 'defer'))
                .map((v) => (
                  <OptionCard key={v.optionId} v={v} level={level} onChoose={() => act({ type: 'resolve', faultId: fid, optionId: v.optionId })} />
                ))}
            </div>
          </div>
        ))}
        {view.routines.length > 0 && (
          <div className="fault">
            <h3 className="routine-title">🔧 {tr.ui.routineTitle}</h3>
            {view.routines.map((rid) => (
              <RoutineCard key={rid} v={routineView(engine, s, rid)} level={level} lockedText={routineLock} onDo={() => act({ type: 'routine', routineId: rid })} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Where today's hours went, behind a ⏱ icon. */
function HoursLog({ s }: { s: GameState }) {
  const log = hoursLog(engine, s);
  return (
    <details className="hours-pop">
      <summary aria-label={tr.ui.hoursBtn} title={tr.ui.hoursBtn}>
        ⏱<span className="sr-only"> {tr.ui.hoursBtn}</span>
      </summary>
      <div className="popover small">
        <strong>{tr.ui.hoursTitle}</strong>
        {log.length === 0 ? (
          <p className="dim">{tr.ui.hoursNone}</p>
        ) : (
          <ul>
            {log.map((h, i) => {
              const parts: string[] = [];
              if (h.walk > 0) parts.push(`👟 ${fmtHours(h.walk)}`);
              if (h.eva > 0) parts.push(`🚀 ${fmtHours(h.eva)}`);
              if (parts.length) parts.push(`🔧 ${fmtHours(h.work)}`);
              const label = h.kind === 'event' ? `${tr.ui.hoursEvent}: ${sourceText(h.source)}` : sourceText(h.source);
              return (
                <li key={i}>
                  <strong>{fmtHours(h.total)}</strong> {label} {parts.length > 0 && <span className="dim">({parts.join(' + ')})</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

/** Task line. Junior: where the next open fault is (place and walking cost, never which
 *  option) and, all day, which gauge is weakest (never which job). Commander: no
 *  suggestions at all, only the open faults and their stations (each opens its station),
 *  then a plain "End the day". tests/commander.test.ts measures players who obey it. */
function MissionBar({
  s,
  level,
  info,
  open,
  endDay,
  coach,
}: {
  s: GameState;
  level: Level;
  info: StationInfo[];
  open: (station: string) => void;
  endDay: () => void;
  coach: ReactNode;
}) {
  const m = mission(engine, s);
  const faults = todayFaults(engine, s);
  const commander = level === 'commander';
  let text: ReactNode = null;
  let button: ReactNode = null;
  let main: string | null = null;
  if (m.kind === 'fault' && commander) {
    text = tr.ui.missionOpen;
  } else if (m.kind === 'fault') {
    main = m.faultId;
    const fault = faultTitle(m.faultId);
    const station = tr.stations[m.station]!;
    const walk = info.find((x) => x.id === m.station)?.walk ?? 0;
    text = !m.fixable ? (
      fmt(tr.ui.missionNoHours, { fault })
    ) : m.here ? (
      fmt(tr.ui.missionHere, { station: station.name, fault })
    ) : (
      <>
        {fmt(tr.ui.missionGo, { to: station.to, fault })}{' '}
        <span className="chip-cost" title={tr.ui.walkTo}>
          {fmt(tr.ui.missionWalk, { h: fmtHours(walk) })}
        </span>
      </>
    );
    button = m.fixable ? (
      <button className="btn primary" onClick={() => open(m.station)}>
        📍 {m.here ? tr.ui.openStation : station.name} →
      </button>
    ) : (
      <button className="btn primary" onClick={endDay}>
        🌙 {tr.ui.endSol}
      </button>
    );
  } else if (m.kind === 'done') {
    // No job is suggested on either level: the player picks what to do with spare hours.
    text = !m.canWork ? tr.ui.missionDoneTired : commander ? tr.ui.missionClear : tr.ui.missionDone;
    button = (
      <button className={`btn primary big ${m.canWork ? '' : 'pulse'}`} onClick={endDay}>
        🌙 {tr.ui.endSol}
      </button>
    );
  }
  // Junior only: name the weakest gauge (same function the follower bot reads).
  const weak = !commander && m.kind !== 'ended' ? weakGauge(s) : null;
  // Commander lists open faults first, in the order they came in; Junior keeps today's order.
  const listed = commander ? [...faults.filter((f) => f.status === 'open'), ...faults.filter((f) => f.status !== 'open')] : faults;
  const chips = listed.filter((f) => f.faultId !== main);
  return (
    <section className={`mission ${coach ? 'coach-target' : ''}`} aria-live="polite">
      <div className="mission-line">
        <span className="mission-icon" aria-hidden>
          🎯
        </span>
        <span className="sr-only">{tr.ui.mission}: </span>
        <span className="mission-text">{text}</span>
        {weak && (
          <span className="chip-cost" role="note">
            📉 {fmt(tr.ui.missionWeak, { res: tr.res[weak.res], v: String(Math.round(weak.value)) })}
          </span>
        )}
        {button}
        <HoursLog s={s} />
      </div>
      {chips.length > 0 && (
        <ul className="chips" aria-label={tr.ui.todayTitle}>
          {chips.map((f) => {
            const word = f.status === 'open' ? tr.ui.stOpen : f.status === 'solved' ? tr.ui.stSolved : tr.ui.stDeferred;
            return (
              <li key={f.faultId}>
                <button className={`chip st-${f.status}`} onClick={() => open(f.station)} title={`${tr.stations[f.station]!.name} · ${word}`}>
                  <span aria-hidden>{f.status === 'open' ? '⚠' : f.status === 'solved' ? '✓' : '⏳'}</span> {faultTitle(f.faultId)}
                  {commander && <span className="dim"> · 📍 {tr.stations[f.station]!.name}</span>}
                  <span className="sr-only"> · {word}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {coach}
    </section>
  );
}

/** "What just happened": one line (the bars show the arrows), plus chain notes and reserve. */
function LastActionLine({ last, onClose }: { last: LastAction; onClose: () => void }) {
  const { action, before, after } = last;
  if (action.type === 'endSol') return null;
  const parts = previewParts(engine, before, action);
  const hours = before.hoursLeft - after.hoursLeft;
  const title = action.type === 'resolve' ? optionLabel(action.faultId, action.optionId) : tr.routines[action.routineId]!.label;
  const notes = action.type === 'resolve' ? activeNotes(engine, before, engine.option(action.faultId, action.optionId).notes) : [];
  return (
    <section className="last" role="status">
      <div className="row between">
        <p className="last-line">
          ✓ <strong>{title}</strong> <span className="dim">· ⏱ {fmtHours(hours)}</span>
        </p>
        <button className="btn ghost small" onClick={onClose} aria-label={tr.ui.close}>
          ✕
        </button>
      </div>
      {notes.map((n) => (
        <p key={n} className="chain-note small">
          🔗 {tr.chain[n]}
        </p>
      ))}
      {parts.critHealth < -0.05 && <p className="note danger small">♥ {tr.ui.critHours}</p>}
      {parts.reserves.map((r) => (
        <p key={r} className="note warn reserve-now">
          🔋 {fmt(tr.ui.reserveNow, { res: tr.res[r] })}
        </p>
      ))}
    </section>
  );
}

/** One station card of the simple view. */
function StationCard({ v, onOpen, coach }: { v: StationInfo; onOpen: () => void; coach: ReactNode }) {
  const st = tr.stations[v.id]!;
  return (
    <div className="station-wrap">
      <button
        className={`station ${v.faults ? 'has-fault' : ''} ${v.locked ? 'locked' : ''} ${v.here ? 'here' : ''} ${coach ? 'coach-target' : ''}`}
        onClick={onOpen}
      >
        <div className="station-name">
          {v.locked && <span aria-hidden>🔒 </span>}
          {st.name}
        </div>
        <div className="station-badges">
          {v.faults > 0 && (
            <span className="sbadge fault">
              ⚠ {v.faults} {tr.ui.problems}
            </span>
          )}
          {v.routine && !v.locked && (
            <span className={`sbadge routine ${v.routine.ok ? '' : 'off'}`} title={fmt(tr.ui.routineBadge, { h: fmtHours(v.routine.hours) })}>
              🔧 {v.routine.done ? '✓' : fmtHours(v.routine.hours)}
            </span>
          )}
          {v.locked && <span className="sbadge locked">{tr.ui.locked}</span>}
        </div>
        <div className="station-meta">
          {v.here ? <span>📍 {tr.ui.location}</span> : <span>👟 {fmtHours(v.walk)}</span>}
          {v.eva && <span className="badge eva">🚀 {tr.ui.eva}</span>}
        </div>
      </button>
      {coach}
    </div>
  );
}

export function StationGrid({ info, open, coachFor }: { info: StationInfo[]; open: (id: string) => void; coachFor: (id: string) => ReactNode }) {
  return (
    <section className="stations" aria-label={tr.ui.stations}>
      {info.map((v) => (
        <StationCard key={v.id} v={v} onOpen={() => open(v.id)} coach={coachFor(v.id)} />
      ))}
    </section>
  );
}

function ViewSwitch({ view, setView, can3d }: { view: View; setView: (v: View) => void; can3d: boolean }) {
  return (
    <div className="view-switch" role="group" aria-label={tr.ui.viewLabel}>
      <button className={`btn small ${view === '3d' ? 'on' : ''}`} aria-pressed={view === '3d'} disabled={!can3d} onClick={() => setView('3d')}>
        🧊 {tr.ui.view3d}
      </button>
      <button className={`btn small ${view === '2d' ? 'on' : ''}`} aria-pressed={view === '2d'} onClick={() => setView('2d')}>
        ▦ {tr.ui.view2d}
      </button>
    </div>
  );
}

export function Play({
  s,
  level,
  act,
  last,
  clearLast,
  tutorial,
  setTutorial,
  view,
  setView,
  onData,
}: {
  onData: () => void;
  s: GameState;
  level: Level;
  act: (a: Action) => void;
  last: LastAction | null;
  clearLast: () => void;
  tutorial: TutorialStep | null;
  setTutorial: (t: TutorialStep | null) => void;
  view: View;
  setView: (v: View) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  /** 3D view: the station the astronaut is walking to (the panel opens on arrival). */
  const [walking, setWalking] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  /** 3D: where the camera is (may differ from the game location until an action is taken). */
  const [viewAt, setViewAt] = useState(s.location);
  const [run, setRun] = useState<PlayRun | null>(null);
  const solSeen = useRef(s.sol);
  if (solSeen.current !== s.sol) {
    // New sol: the astronaut wakes up at home.
    solSeen.current = s.sol;
    setViewAt(s.location);
  }
  const [night, setNight] = useState(false);
  const [sceneFailed, setSceneFailedState] = useState(sceneBroken);
  const setSceneFailed = (v: boolean) => {
    if (v) markSceneBroken();
    setSceneFailedState(v);
  };
  const nightTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (nightTimer.current) window.clearTimeout(nightTimer.current);
  }, []);
  const can3d = webglAvailable() && !sceneFailed;
  const use3d = view === '3d' && can3d;
  const sol1 = s.sol === 1;
  const info = stationInfo(s, sol1);
  const endLocked = sol1 && s.faults.length > 0;
  const m = mission(engine, s);

  // Tutorial steps that wait for the player to do something advance here.
  const step: TutorialStep | null = (() => {
    if (!tutorial || !sol1) return null;
    const solved = (id: string) => s.decisions.some((d) => d.faultId === id && d.sol === 1);
    if (tutorial === 'goHub' || tutorial === 'choose') {
      if (solved('s1_wakeup')) return solved('s1_seal') ? 'done' : 'seal';
      return open === 'hub' ? 'choose' : 'goHub';
    }
    if (tutorial === 'seal') return solved('s1_seal') ? (solved('s1_wakeup') ? 'done' : 'goHub') : 'seal';
    return tutorial;
  })();
  const skipTutorial = () => setTutorial(null);
  const bubble = (inline = false) =>
    step ? (
      <CoachBubble
        text={tr.tutorial[step]}
        inline={inline}
        onNext={step === 'bars' ? () => setTutorial('hours') : step === 'hours' ? () => setTutorial('goHub') : null}
        onSkip={skipTutorial}
      />
    ) : null;
  const coachStation = step === 'goHub' ? 'hub' : step === 'seal' && open !== 'airlock' ? 'airlock' : null;

  const busy = night || walking !== null || run !== null;
  const openStation = (id: string) => {
    if (busy) return;
    // 3D: walk there first, the panel opens on arrival. Already there: open right away.
    // Locked (storm / landing before Sol 13): no walk, the panel says why.
    const locked = info.find((x) => x.id === id)?.locked;
    if (use3d && id !== viewAt && !locked) {
      setOpen(null);
      setWalking(id);
    } else setOpen(id);
  };
  const doAct = (a: Action) => {
    if (busy) return;
    // The step happens now, exactly once; the 3D view then acts it out (skippable).
    if (use3d) setRun(runFor(s, a));
    act(a);
    setOpen(null);
    if (step && step !== 'bars' && step !== 'hours') setTutorial(step);
  };
  const reallyEnd = () => {
    setConfirm(false);
    setOpen(null);
    if (!use3d) return act({ type: 'endSol' });
    if (night) return;
    setNight(true);
    nightTimer.current = window.setTimeout(() => {
      nightTimer.current = null;
      setNight(false);
      act({ type: 'endSol' });
    }, NIGHT_MS);
  };
  const endDay = () => {
    if (endLocked || busy) return;
    const crit = criticalResources(s).length > 0 && s.hoursLeft > 0;
    if (s.faults.length || crit || s.sol === s.config.solCount) setConfirm(true);
    else reallyEnd();
  };

  const sceneRun: SceneRun | null = run
    ? { id: run.id, kind: run.kind, station: run.station, faultId: run.faultId, optionId: run.optionId, routineId: run.routineId, label: run.label, hours: run.before.hoursLeft - s.hoursLeft, from: workLook(run.before, stationOf), to: workLook(s, stationOf) }
    : null;
  const endButton = m.kind !== 'done' && (
    <button className="btn big end-btn" disabled={endLocked || busy} onClick={endDay} title={endLocked ? tr.ui.sol1Locked : undefined}>
      🌙 {tr.ui.endSol}
    </button>
  );
  const dock = (
    <>
      <Inventory items={s.items} />
      {endButton}
    </>
  );
  // Sol 12: the real recorded event is named on the helmet display (date and class).
  const spe = sceneLook(s).solarEvent ? data.solarEventOf(s) : null;
  const eventHud = spe ? (
    <div className="fp-event" role="status">
      ☀ {fmt(tr.act.eventHud, { date: fmtDate(spe.date), cls: spe.classType })}
    </div>
  ) : null;
  const grid = <StationGrid info={info} open={openStation} coachFor={(id) => (id === coachStation ? bubble() : null)} />;

  return (
    <div className={`play ${use3d ? 'view-3d' : 'view-2d'}`}>
      <TopBar
        s={run ? run.before : s}
        level={level}
        flash={last && last.action.type !== 'endSol' && !run ? last : null}
        coach={step === 'bars' || step === 'hours' ? { at: step, bubble: bubble() } : null}
        extra={
          <div className="topbar-extra">
            <ViewSwitch view={use3d ? '3d' : '2d'} setView={setView} can3d={can3d} />
            <div className="row">
              <LangSwitch />
              <button className="btn small ghost" onClick={onData} title={tr.act.dataBtn}>
                📊 <span className="hide-narrow">{tr.act.dataBtn}</span>
              </button>
            </div>
          </div>
        }
      />
      <Warnings s={s} />
      <div className="play-top">
        <MissionBar s={s} level={level} info={info} open={openStation} endDay={endDay} coach={step === 'done' ? bubble() : null} />
        {last && !run && <LastActionLine last={last} onClose={clearLast} />}
      </div>
      <main className="play-main">
        {use3d ? (
          <SceneBoundary fallback={grid} onError={() => setSceneFailed(true)}>
            <Suspense
              fallback={
                <div>
                  <p className="dim small">{tr.ui.view3dLoading}</p>
                  {grid}
                </div>
              }
            >
              <FirstPerson
                stations={info}
                goal={run?.station ?? walking ?? viewAt}
                look={sceneLook(s, night)}
                work={workLook(s, stationOf)}
                run={sceneRun}
                target={level === 'junior' && m.kind === 'fault' && m.fixable ? m.station : null}
                onPick={openStation}
                onArrive={(id) => {
                  setViewAt(id);
                  if (walking === id) {
                    setWalking(null);
                    setOpen(id);
                  }
                }}
                onRunDone={(id) => setRun((cur) => (cur && cur.id === id ? null : cur))}
                coach={coachStation || step === 'choose' ? bubble() : null}
                dock={dock}
                hud={eventHud}
                onLost={() => setSceneFailed(true)}
                hint={sol1}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <>
            {view === '3d' && sceneFailed && <p className="note warn small">{tr.ui.view3dFailed}</p>}
            {grid}
          </>
        )}
        {!use3d && (
          <aside className="side">
            {dock}
            {endLocked && <p className="dim small">{tr.ui.sol1Locked}</p>}
          </aside>
        )}
      </main>
      {open && (
        <StationPanel
          s={s}
          stationId={open}
          level={level}
          sol1={sol1}
          coach={step === 'choose' && !use3d ? bubble(true) : null}
          side={use3d}
          act={doAct}
          open={(id) => setOpen(id)}
          close={() => setOpen(null)}
        />
      )}
      {night && (
        <div className="night-fx" role="status">
          <span>🌙 {tr.ui.nightFalls}</span>
        </div>
      )}
      {confirm && (
        <div className="panel-backdrop" onClick={() => setConfirm(false)}>
          <section className="panel small-panel" role="dialog" aria-modal="true" aria-label={tr.ui.endSolConfirm} onClick={(e) => e.stopPropagation()}>
            <h2>🌙 {tr.ui.endSolConfirm}</h2>
            {s.sol === s.config.solCount && <p>{tr.ui.endSolLast}</p>}
            {s.faults.length > 0 && (
              <>
                <p>{tr.ui.endSolOpenList}</p>
                <ul className="confirm-list">
                  {s.faults.map((f) => {
                    const d = engine.fault(f.faultId).options.find((o) => o.kind === 'defer')!;
                    return (
                      <li key={f.faultId}>
                        <strong>⚠ {faultTitle(f.faultId)}</strong>
                        <br />
                        <span className="small">{tr.faults[f.faultId]!.options[d.id]!.why}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {criticalResources(s).length > 0 && s.hoursLeft > 0 && <p className="note danger small">♥ {fmt(tr.ui.endSolHours, { h: fmtHours(s.hoursLeft) })}</p>}
            <div className="row wrap">
              <button className="btn primary" onClick={reallyEnd}>
                {tr.ui.yes}
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                {tr.ui.no}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
