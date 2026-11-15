import { useState } from 'react';
import { engine, fmt, tr } from '../content';
import { optionViews, routineView, stationViews, type OptionView, type RoutineView } from '../sim/selectors';
import type { Action, GameState, Invalid } from '../sim/types';
import { DeltaList, fmtHours, TopBar, Warnings, type Level } from './parts';

const invalidText = (r: Invalid): string => {
  switch (r) {
    case 'hours':
      return tr.ui.notEnoughHours;
    case 'items':
      return tr.ui.missingItem;
    case 'requires':
      return tr.ui.requiresMissing;
    case 'locked':
      return tr.ui.locked;
    case 'routineDone':
      return tr.ui.routineDone;
    default:
      return tr.ui.locked;
  }
};

function CostLine({ v }: { v: { cost: OptionView['cost'] } }) {
  const c = v.cost;
  const parts: string[] = [];
  if (c.walk > 0) parts.push(`${fmtHours(c.walk)} ${tr.ui.walk}`);
  if (c.eva > 0) parts.push(`${fmtHours(c.eva)} ${tr.ui.eva}`);
  parts.push(`${fmtHours(c.work)} ${tr.ui.work}`);
  return (
    <span className="cost">
      ⏱ {fmtHours(c.total)} <span className="dim">({parts.join(' + ')})</span>
      {c.evaTrip && <span className="badge eva">{tr.ui.eva}</span>}
    </span>
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
      {level === 'junior' && v.tags.includes('invest') && <div className="tag invest">💡 {tr.ui.investHint}</div>}
      {level === 'junior' && v.tags.includes('laterCost') && <div className="tag later">⏳ {tr.ui.laterCostHint}</div>}
      <div className="option-foot">
        <span className="dim small">{tr.ui.now}:</span> <DeltaList d={v.preview} level={level} empty={<span className="dim small">—</span>} />
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

function RoutineCard({ v, level, onDo }: { v: RoutineView; level: Level; onDo: () => void }) {
  const t = tr.routines[v.routineId]!;
  return (
    <div className={`option routine ${v.invalid ? 'disabled' : ''}`}>
      <div className="option-head">
        <strong>🔧 {t.label}</strong>
        <CostLine v={v} />
      </div>
      <p className="why">{t.why}</p>
      <div className="option-foot">
        <DeltaList d={v.preview} level={level} />
        {v.invalid ? (
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
  act,
  close,
}: {
  s: GameState;
  stationId: string;
  level: Level;
  act: (a: Action) => void;
  close: () => void;
}) {
  const view = stationViews(engine, s).find((x) => x.id === stationId)!;
  const st = tr.stations[stationId]!;
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
        {view.eva && <p className="note">🚀 {tr.ui.evaShort}</p>}
        {view.locked && <p className="note danger">🔒 {stationId === 'landing' && s.sol < 13 ? tr.ui.lockedLanding : tr.ui.lockedStorm}</p>}
        {view.faults.length === 0 && <p className="dim">{tr.ui.noProblems}</p>}
        {view.faults.map((fid) => (
          <div key={fid} className="fault">
            <h3>⚠ {tr.faults[fid]!.title}</h3>
            <p>{tr.faults[fid]!.desc}</p>
            <div className="options">
              {optionViews(engine, s, fid).map((v) => (
                <OptionCard key={v.optionId} v={v} level={level} onChoose={() => act({ type: 'resolve', faultId: fid, optionId: v.optionId })} />
              ))}
            </div>
          </div>
        ))}
        {view.routines.length > 0 && (
          <div className="fault">
            <h3>{tr.ui.routineTitle}</h3>
            {view.routines.map((rid) => (
              <RoutineCard key={rid} v={routineView(engine, s, rid)} level={level} onDo={() => act({ type: 'routine', routineId: rid })} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function Play({ s, level, act }: { s: GameState; level: Level; act: (a: Action) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const stations = stationViews(engine, s);
  const doAct = (a: Action) => {
    act(a);
  };
  return (
    <div className="play">
      <TopBar s={s} level={level} />
      <Warnings s={s} />
      <main className="play-main">
        <section className="stations" aria-label={tr.ui.stations}>
          {stations.map((v) => {
            const st = tr.stations[v.id]!;
            return (
              <button
                key={v.id}
                className={`station ${v.faults.length ? 'has-fault' : ''} ${v.locked ? 'locked' : ''} ${v.here ? 'here' : ''}`}
                onClick={() => setOpen(v.id)}
              >
                <div className="station-name">{st.name}</div>
                <div className="station-meta">
                  {v.walk > 0 ? `${fmtHours(v.walk)} ${tr.ui.walk}` : tr.ui.noWalk}
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
            <h3>{tr.ui.inventory}</h3>
            <ul className="inv">
              {Object.entries(s.items).map(([k, n]) => (
                <li key={k} className={n === 0 ? 'dim' : ''}>
                  {tr.items[k]}: <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>{tr.sols[s.sol]?.title}</h3>
            <p className="small">🌤 {tr.sols[s.sol]?.weather}</p>
            {s.faults.length > 0 && (
              <ul className="small open-faults">
                {s.faults.map((f) => (
                  <li key={f.faultId}>
                    <button className="link" onClick={() => setOpen(engine.fault(f.faultId).station)}>
                      ⚠ {tr.faults[f.faultId]!.title} — {tr.stations[engine.fault(f.faultId).station]!.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn primary big" onClick={() => (s.faults.length ? setConfirm(true) : act({ type: 'endSol' }))}>
            🌙 {tr.ui.endSol}
          </button>
          {s.faults.length > 0 && <p className="dim small">{tr.ui.deferAuto}</p>}
        </aside>
      </main>
      {open && <StationPanel s={s} stationId={open} level={level} act={doAct} close={() => setOpen(null)} />}
      {confirm && (
        <div className="panel-backdrop" onClick={() => setConfirm(false)}>
          <section className="panel small-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
            <p>{fmt(tr.ui.endSolConfirm, {})}</p>
            <ul className="small">
              {s.faults.map((f) => (
                <li key={f.faultId}>⚠ {tr.faults[f.faultId]!.title}</li>
              ))}
            </ul>
            <div className="row">
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
