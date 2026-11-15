import { useState, type ReactNode } from 'react';
import { SolarEventCard } from './DataViews';
import { faultTitle, optionLabel, sourceText } from '../blackbox/text';
import { engine, fmt, tr } from '../content';
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
import { DeltaList, fmtHours, TopBar, Warnings, type Level } from './parts';

/** The last action and the states around it, for the "what just happened" card. */
export interface LastAction {
  action: Action;
  before: GameState;
  after: GameState;
}

/** Sol-1 tutorial steps, in order. `null` = tutorial off or finished. */
export const TUTORIAL = ['bars', 'hours', 'goHub', 'choose', 'seal', 'done'] as const;
export type TutorialStep = (typeof TUTORIAL)[number];

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

function CostLine({ v }: { v: { cost: OptionView['cost'] } }) {
  const c = v.cost;
  const parts: string[] = [];
  if (c.walk > 0) parts.push(`${fmtHours(c.walk)} ${tr.ui.hoursWalk}`);
  if (c.eva > 0) parts.push(`${fmtHours(c.eva)} ${tr.ui.hoursEva}`);
  if (parts.length) parts.push(`${fmtHours(c.work)} ${tr.ui.hoursWork}`);
  return (
    <span className="cost">
      ⏱ <strong>{fmtHours(c.total)}</strong> {parts.length > 0 && <span className="dim">({parts.join(' + ')})</span>}
      {c.evaTrip && <span className="badge eva">{tr.ui.eva}</span>}
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

function OptionCard({ v, level, onChoose }: { v: OptionView; level: Level; onChoose: () => void }) {
  const t = tr.faults[v.faultId]!.options[v.optionId]!;
  const items = engine.option(v.faultId, v.optionId).items ?? {};
  return (
    <div className={`option ${v.invalid ? 'disabled' : ''}`}>
      <div className="option-head">
        <strong>{t.label}</strong>
        <CostLine v={v} />
      </div>
      {Object.keys(items).length > 0 && (
        <div className="dim small">
          {tr.ui.needs}: {Object.entries(items).map(([k, n]) => `${tr.items[k]} ×${n}`).join(', ')}
        </div>
      )}
      <p className="why">{t.why}</p>
      {v.notes.map((n) => (
        <p key={n} className="chain-note small">
          🔗 {tr.chain[n]}
        </p>
      ))}
      {level === 'junior' && v.tags.includes('invest') && <div className="tag invest">💡 {tr.ui.investHint}</div>}
      {level === 'junior' && v.tags.includes('laterCost') && <div className="tag later">⏳ {tr.ui.laterCostHint}</div>}
      {!v.invalid && <PreviewNotes v={v} />}
      <div className="option-foot">
        <span>
          <span className="dim small">{tr.ui.now}:</span> <DeltaList d={v.preview} level={level} empty={<span className="dim small">—</span>} />
        </span>
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
        <strong>🔧 {t.label}</strong>
        <CostLine v={v} />
      </div>
      <p className="why">{t.why}</p>
      {!v.invalid && !lockedText && <PreviewNotes v={v} />}
      <div className="option-foot">
        <DeltaList d={v.preview} level={level} />
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
  act,
  open,
  close,
}: {
  s: GameState;
  stationId: string;
  level: Level;
  sol1: boolean;
  act: (a: Action) => void;
  open: (station: string) => void;
  close: () => void;
}) {
  const view = stationViews(engine, s).find((x) => x.id === stationId)!;
  const st = tr.stations[stationId]!;
  const elsewhere = [...new Set(s.faults.map((f) => engine.fault(f.faultId).station))].filter((x) => x !== stationId);
  // Sol 1 is the tutorial: no deferring, and maintenance only after both faults are fixed.
  const routineLock = sol1 && s.faults.length > 0 ? tr.ui.sol1Locked : null;
  return (
    <div className="panel-backdrop" onClick={close}>
      <section className="panel" role="dialog" aria-label={st.name} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{st.name}</h2>
          <button className="btn ghost" onClick={close} aria-label={tr.ui.close}>
            ✕
          </button>
        </div>
        <p className="dim">{st.desc}</p>
        {!view.here && !view.locked && <p className="dim small">👟 {tr.ui.panelFree}</p>}
        {view.eva && <p className="note">🚀 {tr.ui.evaShort}</p>}
        {view.locked && <p className="note danger">🔒 {stationId === 'landing' && s.sol < 13 ? tr.ui.lockedLanding : tr.ui.lockedStorm}</p>}
        {view.faults.length === 0 && (
          <div className="note ok-note">
            <p>✓ {tr.ui.noProblemsHere}</p>
            {elsewhere.length > 0 ? (
              <div className="row wrap">
                <span className="small">{tr.ui.problemsElsewhere}</span>
                {elsewhere.map((x) => (
                  <button key={x} className="btn small primary" onClick={() => open(x)}>
                    📍 {tr.stations[x]!.name}
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
            <p>{tr.faults[fid]!.desc}</p>
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
        <div className="fault">
          <h3 className="routine-title">{tr.ui.routineTitle}</h3>
          {view.routines.length === 0 ? (
            <p className="dim small">{tr.ui.noRoutineHere}</p>
          ) : (
            <>
              <p className="dim small">{tr.ui.routineHint}</p>
              {view.routines.map((rid) => (
                <RoutineCard
                  key={rid}
                  v={routineView(engine, s, rid)}
                  level={level}
                  lockedText={routineLock}
                  onDo={() => act({ type: 'routine', routineId: rid })}
                />
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Always-visible task line + today's faults with status + where the hours went. */
function MissionBar({
  s,
  sol1,
  open,
  endDay,
  highlight,
}: {
  s: GameState;
  sol1: boolean;
  open: (station: string) => void;
  endDay: () => void;
  highlight: boolean;
}) {
  const m = mission(engine, s);
  const faults = todayFaults(engine, s);
  const log = hoursLog(engine, s);
  let text: ReactNode = null;
  let button: ReactNode = null;
  if (m.kind === 'fault') {
    const fault = faultTitle(m.faultId);
    const station = tr.stations[m.station]!;
    text = !m.fixable
      ? fmt(tr.ui.missionNoHours, { fault })
      : m.here
        ? fmt(tr.ui.missionHere, { station: station.name, fault })
        : fmt(tr.ui.missionGo, { to: station.to, fault });
    button = m.fixable ? (
      <button className="btn primary" onClick={() => open(m.station)}>
        📍 {station.name} →
      </button>
    ) : (
      <button className="btn primary" onClick={endDay}>
        🌙 {tr.ui.endSol}
      </button>
    );
  } else if (m.kind === 'done') {
    text = m.canWork ? tr.ui.missionDone : tr.ui.missionDoneTired;
    button = (
      <button className="btn primary big pulse" onClick={endDay}>
        🌙 {tr.ui.endSol}
      </button>
    );
  }
  return (
    <section className={`mission ${highlight ? 'coach-target' : ''}`} aria-live="polite">
      <div className="mission-line">
        <span className="mission-label">🎯 {tr.ui.mission}:</span> <span className="mission-text">{text}</span>
        {button}
      </div>
      <ul className="today">
        {faults.length === 0 && <li className="dim small">{tr.ui.noFaultsToday}</li>}
        {faults.map((f) => (
          <li key={f.faultId} className={`today-item st-${f.status}`}>
            <button className="link" onClick={() => open(f.station)}>
              {f.status === 'open' ? '⚠' : f.status === 'solved' ? '✓' : '⏳'} {faultTitle(f.faultId)}
            </button>{' '}
            <span className="dim small">
              · {tr.stations[f.station]!.name} ·{' '}
              <strong className="st">{f.status === 'open' ? tr.ui.stOpen : f.status === 'solved' ? tr.ui.stSolved : tr.ui.stDeferred}</strong>
              {f.returning && ` · ${tr.ui.returning}`}
            </span>
          </li>
        ))}
      </ul>
      <details className="hours-log">
        <summary>⏱ {tr.ui.hoursTitle}</summary>
        {log.length === 0 ? (
          <p className="dim small">{tr.ui.hoursNone}</p>
        ) : (
          <ul className="small">
            {log.map((h, i) => {
              const parts: string[] = [];
              if (h.walk > 0) parts.push(`${fmtHours(h.walk)} ${tr.ui.hoursWalk}`);
              if (h.eva > 0) parts.push(`${fmtHours(h.eva)} ${tr.ui.hoursEva}`);
              if (parts.length) parts.push(`${fmtHours(h.work)} ${tr.ui.hoursWork}`);
              const label = h.kind === 'event' ? `${tr.ui.hoursEvent}: ${sourceText(h.source)}` : sourceText(h.source);
              return (
                <li key={i}>
                  <strong>{fmtHours(h.total)}</strong> {label} {parts.length > 0 && <span className="dim">({parts.join(' + ')})</span>}
                </li>
              );
            })}
          </ul>
        )}
      </details>
      {sol1 && s.faults.length > 0 && <p className="dim small">{tr.ui.sol1Locked}</p>}
    </section>
  );
}

/** "What just happened": the last action, its effect, reserve and chain notes. */
function LastActionCard({ last, level, onClose }: { last: LastAction; level: Level; onClose: () => void }) {
  const { action, before, after } = last;
  if (action.type === 'endSol') return null;
  const parts = previewParts(engine, before, action);
  const hours = before.hoursLeft - after.hoursLeft;
  const title =
    action.type === 'resolve'
      ? `${faultTitle(action.faultId)}: ${optionLabel(action.faultId, action.optionId)}`
      : tr.routines[action.routineId]!.label;
  const notes = action.type === 'resolve' ? activeNotes(engine, before, engine.option(action.faultId, action.optionId).notes) : [];
  const empty = !parts.preview || Object.keys(parts.preview).filter((k) => k !== 'items').length === 0;
  return (
    <section className="last card" role="status">
      <div className="row between">
        <h3>✓ {tr.ui.lastTitle}</h3>
        <button className="btn ghost small" onClick={onClose} aria-label={tr.ui.close}>
          ✕
        </button>
      </div>
      <p>
        <strong>{title}</strong> <span className="dim small">· ⏱ {fmt(tr.ui.lastHours, { h: fmtHours(hours) })}</span>
      </p>
      {empty ? <p className="dim small">{tr.ui.lastNoEffect}</p> : <DeltaList d={parts.preview} level={level} />}
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

function Coach({ step, onNext, onSkip }: { step: TutorialStep; onNext: (() => void) | null; onSkip: () => void }) {
  return (
    <section className="coach card" role="note">
      <p className="coach-title">🧑‍🚀 {tr.tutorial.title}</p>
      <p>{tr.tutorial[step]}</p>
      <div className="row wrap">
        {onNext && (
          <button className="btn primary" onClick={onNext}>
            {tr.tutorial.next}
          </button>
        )}
        <button className="btn ghost small" onClick={onSkip}>
          {tr.tutorial.skip}
        </button>
      </div>
    </section>
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
}: {
  s: GameState;
  level: Level;
  act: (a: Action) => void;
  last: LastAction | null;
  clearLast: () => void;
  tutorial: TutorialStep | null;
  setTutorial: (t: TutorialStep | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const stations = stationViews(engine, s);
  const sol1 = s.sol === 1;
  const endLocked = sol1 && s.faults.length > 0;

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

  const doAct = (a: Action) => {
    act(a);
    setOpen(null);
    if (step && step !== 'bars' && step !== 'hours') setTutorial(step);
  };
  const endDay = () => {
    if (endLocked) return;
    const crit = criticalResources(s).length > 0 && s.hoursLeft > 0;
    if (s.faults.length || crit || s.sol === s.config.solCount) setConfirm(true);
    else act({ type: 'endSol' });
  };
  const target = (what: 'bars' | 'hours' | 'mission' | string) =>
    (step === 'bars' && what === 'bars') ||
    (step === 'hours' && what === 'hours') ||
    (step === 'goHub' && what === 'hub') ||
    (step === 'seal' && what === 'airlock') ||
    (step === 'done' && what === 'mission');

  return (
    <div className="play">
      <TopBar s={s} level={level} flash={last && last.action.type !== 'endSol' ? last : null} coach={step === 'bars' ? 'bars' : step === 'hours' ? 'hours' : null} />
      <Warnings s={s} />
      <div className="play-top">
        {step && (
          <Coach
            step={step}
            onNext={step === 'bars' ? () => setTutorial('hours') : step === 'hours' ? () => setTutorial('goHub') : null}
            onSkip={() => setTutorial(null)}
          />
        )}
        <MissionBar s={s} sol1={sol1} open={setOpen} endDay={endDay} highlight={target('mission')} />
        {last && <LastActionCard last={last} level={level} onClose={clearLast} />}
      </div>
      <main className="play-main">
        <section className="stations" aria-label={tr.ui.stations}>
          {stations.map((v) => {
            const st = tr.stations[v.id]!;
            return (
              <button
                key={v.id}
                className={`station ${v.faults.length ? 'has-fault' : ''} ${v.locked ? 'locked' : ''} ${v.here ? 'here' : ''} ${target(v.id) ? 'coach-target' : ''}`}
                onClick={() => setOpen(v.id)}
              >
                <div className="station-name">{st.name}</div>
                <div className="station-meta">
                  {(() => {
                    const w = v.here ? 0 : v.walk + (stations.find((x) => x.here)?.walk ?? 0);
                    return w > 0 ? `${fmtHours(w)} ${tr.ui.walk}` : tr.ui.noWalk;
                  })()}
                  {v.eva && <span className="badge eva">{tr.ui.eva}</span>}
                  {v.locked && <span className="badge locked">🔒 {tr.ui.locked}</span>}
                </div>
                {v.faults.length > 0 && (
                  <div className="station-fault">
                    ⚠ {v.faults.length} {tr.ui.problems}
                  </div>
                )}
                {v.here && <div className="station-here">📍 {tr.ui.location}</div>}
              </button>
            );
          })}
        </section>
        <aside className="side">
          <div className="card">
            <h3>{tr.sols[s.sol]?.title}</h3>
            <p className="small">🌤 {tr.sols[s.sol]?.weather}</p>
          </div>
          <div className="card">
            <h3>{tr.ui.inventory}</h3>
            <ul className="inv">
              {Object.entries(s.items).map(([k, n]) => (
                <li key={k} className={n === 0 ? 'dim' : ''}>
                  {tr.items[k]}: <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </div>
          <button className={`btn big end-btn ${s.faults.length === 0 ? 'primary' : ''}`} disabled={endLocked} onClick={endDay}>
            🌙 {tr.ui.endSol}
          </button>
          {endLocked ? <p className="dim small">{tr.ui.sol1Locked}</p> : s.faults.length > 0 && <p className="dim small">{tr.ui.deferAuto}</p>}
        </aside>
      </main>
      {open && (
        <StationPanel s={s} stationId={open} level={level} sol1={sol1} act={doAct} open={setOpen} close={() => setOpen(null)} />
      )}
      {confirm && (
        <div className="panel-backdrop" onClick={() => setConfirm(false)}>
          <section className="panel small-panel" role="dialog" aria-label={tr.ui.endSolConfirm} onClick={(e) => e.stopPropagation()}>
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
              <button
                className="btn primary"
                onClick={() => {
                  setConfirm(false);
                  act({ type: 'endSol' });
                }}
              >
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
