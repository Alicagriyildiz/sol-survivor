import { useState } from 'react';
import { faultTitle, optionLabel, sourceText } from '../blackbox/text';
import { SOURCES, engine, extra, fmt, numSuffix, tr } from '../content';
import { activeNotes, reservesUsed, score, solReportRows, todayFaults, type ReportRow, type ReportSection } from '../sim/selectors';
import { RESOURCES, type Deltas, type GameState } from '../sim/types';
import { DoseCompare, SpaceWeatherLine, StormLine, StudyLine } from './DataViews';
import { DEMO_STOPS, type DemoStop } from './demo';
import { LangSwitch } from './LangSwitch';
import { Chart, DeltaList, fmtMGy, fmtNum, type Level } from './parts';
import { colors, resourceIcon } from './tokens';
import { webglAvailable, type View } from './view';

export function Start({
  onStart,
  onData,
  onDemo,
  view,
  setView,
}: {
  onDemo: (stop: DemoStop) => void;
  onStart: (seed: number, level: Level, tutorial: boolean) => void;
  onData: () => void;
  view: View;
  setView: (v: View) => void;
}) {
  const can3d = webglAvailable();
  // `?seed=N` (also in the production build) fixes the seed, e.g. for a rehearsed demo.
  const [seed, setSeed] = useState(() => {
    try {
      const q = Number(new URLSearchParams(window.location.search).get('seed'));
      if (Number.isInteger(q) && q > 0) return q;
    } catch {
      // no URL access: random seed
    }
    return 1 + Math.floor(Math.random() * 9999);
  });
  const [level, setLevel] = useState<Level>('junior');
  const [tutorial, setTutorial] = useState(true);
  return (
    <div className="screen start">
      <div className="lang-bar">
        <LangSwitch big />
      </div>
      <h1>🔴 {tr.ui.appTitle}</h1>
      <p className="lead">{tr.ui.tagline}</p>
      <div className="card">
        <label className="field">
          <span>{tr.ui.seed}</span>
          <input type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
          <button className="btn ghost" onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))}>
            🎲 {tr.ui.randomSeed}
          </button>
        </label>
        <fieldset className="levels">
          <legend>{tr.ui.level}</legend>
          {(['junior', 'commander'] as Level[]).map((l) => (
            <label key={l} className={`level ${level === l ? 'on' : ''}`}>
              <input type="radio" name="level" checked={level === l} onChange={() => setLevel(l)} />
              <strong>{l === 'junior' ? tr.ui.junior : tr.ui.commander}</strong>
              <span className="dim small">{l === 'junior' ? tr.ui.juniorHint : tr.ui.commanderHint}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="levels views">
          <legend>{tr.ui.viewLabel}</legend>
          {(['3d', '2d'] as View[]).map((v) => (
            <label key={v} className={`level ${view === v ? 'on' : ''} ${v === '3d' && !can3d ? 'disabled' : ''}`}>
              <input type="radio" name="view" checked={view === v} disabled={v === '3d' && !can3d} onChange={() => setView(v)} />
              <strong>{v === '3d' ? `🧊 ${tr.ui.view3d}` : `▦ ${tr.ui.view2d}`}</strong>
              <span className="dim small">{v === '3d' ? (can3d ? tr.ui.view3dHint : tr.ui.view3dNo) : tr.ui.view2dHint}</span>
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={tutorial} onChange={(e) => setTutorial(e.target.checked)} /> {tr.tutorial.option}
        </label>
        <button className="btn primary big" onClick={() => onStart(seed, level, tutorial)}>
          🚀 {tr.ui.start}
        </button>
      </div>
      <button className="btn" onClick={onData}>
        📊 {tr.data.open}
      </button>
      <details className="card demo-card">
        <summary>
          🎬 <strong>{tr.act.demo}</strong> · <span className="dim small">{tr.act.demoTitle}</span>
        </summary>
        <p className="dim small">{tr.act.demoHint}</p>
        <div className="row wrap">
          {DEMO_STOPS.map((st, i) => (
            <button key={String(st)} className="btn small" onClick={() => onDemo(st)}>
              {i + 1} · {st === 4 ? tr.act.demo4 : st === 6 ? tr.act.demo6 : st === 12 ? tr.act.demo12 : tr.act.demoEnd}
            </button>
          ))}
        </div>
      </details>
      <div className="card glossary">
        <h3>{tr.ui.glossaryTitle}</h3>
        <dl>
          {tr.glossary.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function Briefing({ s, onGo }: { s: GameState; onGo: () => void }) {
  const t = tr.sols[s.sol]!;
  const faults = todayFaults(engine, s);
  const notes = activeNotes(engine, s, engine.content.sols.find((x) => x.sol === s.sol)?.notes);
  const storm = engine.content.stations.some((st) => st.eva && st.lockedWhen && engine.isLocked(s, st.id) && st.id === 'solar');
  return (
    <div className="screen briefing">
      <p className="dim">
        {tr.ui.sol} {s.sol} {tr.ui.of} {s.config.solCount} · {tr.ui.briefing}
      </p>
      <h1>{t.title}</h1>
      <div className="card">
        <h3>🌤 {tr.ui.weather}</h3>
        <p>{t.weather}</p>
        {storm && <p className="note danger small">🔒 {tr.ui.briefingStorm}</p>}
        <SpaceWeatherLine s={s} />
        <StormLine sol={s.sol} />
      </div>
      <div className="card today-card">
        <h3>🎯 {tr.ui.briefingToday}</h3>
        <ul className="today">
          {faults.map((f) => (
            <li key={f.faultId}>
              ⚠ <strong>{faultTitle(f.faultId)}</strong> <span className="dim">· 📍 {tr.stations[f.station]!.name}</span>
              {f.returning && <span className="badge">{tr.ui.returning}</span>}
            </li>
          ))}
        </ul>
      </div>
      {notes.length > 0 && (
        <div className="card chain-card">
          <h3>🔗 {tr.ui.briefingChain}</h3>
          {notes.map((n) => (
            <p key={n} className="small">
              {tr.chain[n]}
            </p>
          ))}
        </div>
      )}
      <div className="card message">
        <h3>📡 {tr.ui.earthMessage}</h3>
        <p className="quote">“{t.message}”</p>
        <p className="dim small">{tr.ui.earthDelay}</p>
      </div>
      {s.sol === 1 && (
        <div className="card">
          <h3>{tr.ui.glossaryTitle}</h3>
          <p className="small">
            <strong>{tr.glossary[0]![0]}:</strong> {tr.glossary[0]![1]}
          </p>
        </div>
      )}
      <button className="btn primary big" onClick={onGo}>
        {tr.ui.startDay} →
      </button>
    </div>
  );
}

/** A function, not a constant: the text must follow the current language. */
const sectionTitle = (sec: ReportSection): string =>
  ({ day: `☀ ${tr.ui.dayPart}`, night: `🌙 ${tr.ui.nightPart}`, morning: `🌅 ${tr.ui.morningPart}` })[sec];

/** Row label plus one plain sentence saying why it happened. */
function rowText(s: GameState, r: ReportRow): { label: string; reason: string | null } {
  const src = r.source;
  const because = r.causes
    .map((key) => s.decisions.find((d) => d.key === key))
    .filter((d) => d !== undefined)
    .map((d) => fmt(tr.ui.because, { sol: d.sol, loc: numSuffix(d.sol, 'loc'), label: optionLabel(d.faultId, d.optionId) }));
  const why = because.length ? because.join(' ') : null;
  switch (src.kind) {
    case 'decision': {
      const faultId = src.key.split(':')[1]!;
      const deferred = engine.option(faultId, src.optionId).kind === 'defer';
      const label = `${faultTitle(faultId)}: ${optionLabel(faultId, src.optionId)}`;
      if (src.auto) return { label, reason: `${tr.reasons.autoDefer} ${tr.faults[faultId]!.options[src.optionId]!.why}` };
      return { label, reason: [deferred ? tr.reasons.youDeferred : tr.reasons.youChose, why].filter(Boolean).join(' ') };
    }
    case 'routine':
      return { label: sourceText(src), reason: tr.reasons.routine };
    case 'night':
      return r.key.startsWith('heal:') ? { label: tr.res.health, reason: tr.reasons.heal } : { label: tr.effects.night!, reason: tr.reasons.night };
    case 'reserve':
      return { label: sourceText(src), reason: tr.reasons.reserve };
    case 'critical':
      return { label: sourceText(src), reason: null };
    default:
      return { label: sourceText(src), reason: why };
  }
}

export function RealNote({ sol }: { sol: number }) {
  const src = SOURCES.find((x) => x.sol === sol);
  return (
    <div className="card real">
      <h3>📚 {tr.ui.whatReallyHappened}</h3>
      <p>{tr.notes[sol]}</p>
      {src && (
        <p className="dim small">
          {tr.ui.source}:{' '}
          {src.urls[0] ? (
            <a href={src.urls[0]} target="_blank" rel="noopener noreferrer">
              {src.source}
            </a>
          ) : (
            src.source
          )}{' '}
          {!src.verified && <span className="badge">{tr.ui.unverified}</span>}
        </p>
      )}
      <StudyLine sol={sol} />
    </div>
  );
}

export function SolReport({ s, sol, level, onNext }: { s: GameState; sol: number; level: Level; onNext: () => void }) {
  const rows = solReportRows(s, sol);
  const sections = (['day', 'night', 'morning'] as const).filter((sec) => rows.some((r) => r.section === sec));
  const prev = s.history.find((h) => h.sol === sol - 1) ?? s.history[0]!;
  const now = s.history.find((h) => h.sol === sol) ?? s.history[s.history.length - 1]!;
  const change: Deltas = {};
  for (const r of RESOURCES) change[r] = Math.round((now.res[r] - prev.res[r]) * 10) / 10;
  change.health = Math.round((now.health - prev.health) * 10) / 10;
  return (
    <div className="screen report">
      <p className="dim">
        {tr.ui.sol} {sol} · {tr.ui.report}
      </p>
      <h1>{tr.sols[sol]?.title}</h1>
      <div className="card">
        <h3>
          {tr.ui.changes} ({tr.ui.sol} {sol})
        </h3>
        <DeltaList d={change} level={level} />
      </div>
      {sol === s.config.solCount && s.outcome?.won && <p className="lead">{tr.ui.finalDay}</p>}
      {sections.map((sec) => (
        <div key={sec} className="card">
          <h3>
            {sectionTitle(sec)}
            {sec === 'morning' && ` (${tr.ui.sol} ${sol + 1})`}
          </h3>
          <ul className="report-list">
            {rows
              .filter((r) => r.section === sec)
              .map((r) => {
                const t = rowText(s, r);
                return (
                  <li key={`${r.section}|${r.key}`} className={r.source.kind === 'reserve' ? 'reserve-row' : ''}>
                    <div className="row between wrap">
                      <strong>
                        {r.source.kind === 'reserve' ? '🔋 ' : ''}
                        {t.label}
                      </strong>
                      <DeltaList d={r.deltas} level={level} />
                    </div>
                    {t.reason && <div className="dim small">{t.reason}</div>}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <RealNote sol={sol} />
      <button className="btn primary big" onClick={onNext}>
        {s.outcome ? tr.ui.finalStats : tr.ui.nextSol} →
      </button>
    </div>
  );
}

export function End({
  s,
  level,
  onBlackBox,
  onAgain,
  onSame,
  onData,
}: {
  s: GameState;
  level: Level;
  onBlackBox: () => void;
  onAgain: () => void;
  onSame: () => void;
  onData: () => void;
}) {
  const o = s.outcome!;
  return (
    <div className="screen end">
      <h1>{o.won ? `🎉 ${tr.ui.missionWon}` : `🛑 ${tr.ui.missionLost}`}</h1>
      {!o.won && o.cause && (
        <p className="lead">
          {tr.ui.lostBecause} <strong>{tr.causeName[o.cause]}</strong> ({tr.ui.sol} {o.sol})
        </p>
      )}
      {/* The Black Box is the main next step: first, big, with one line saying what it does. */}
      <div className="card end-next">
        <button className="btn primary big" onClick={onBlackBox} autoFocus>
          ⬛ {tr.ui.openBlackBox} →
        </button>
        <p className="lead">{extra.blackBoxLead}</p>
        {level === 'junior' && <p className="dim small">{tr.blackbox.intro}</p>}
      </div>
      <div className="card">
        <h3>{tr.ui.finalStats}</h3>
        <ul className="stats">
          <li>
            {resourceIcon.health} {tr.res.health}: <strong>{fmtNum(s.health, 0)}</strong>
          </li>
          {RESOURCES.map((r) => (
            <li key={r}>
              {resourceIcon[r]} {tr.res[r]}: <strong>{fmtNum(s.res[r], 0)}</strong>
            </li>
          ))}
          <li>
            {resourceIcon.dose} {tr.ui.dose}: <strong>{fmtMGy(s.dose)}</strong>
          </li>
          <li>
            ⭐ {tr.ui.score}: <strong>{score(s)}</strong>
          </li>
        </ul>
        <p className="dim small">⭐ {tr.ui.scoreHint}</p>
        <p className="small">
          🔋{' '}
          {reservesUsed(s).length === 0
            ? tr.blackbox.noReserve
            : fmt(tr.blackbox.reserveLine, {
                list: reservesUsed(s)
                  .map((r) => fmt(tr.ui.reserveOnSol, { res: tr.res[r.res], sol: r.sol }))
                  .join(', '),
              })}
        </p>
        <Chart metric="health" series={[{ name: 'health', color: colors.accent, data: s.history }]} />
      </div>
      <DoseCompare s={s} />
      <div className="row wrap">
        <button className="btn" onClick={onSame}>
          🔁 {tr.ui.sameSeed}
        </button>
        <button className="btn" onClick={onAgain}>
          🎲 {tr.ui.playAgain}
        </button>
        <button className="btn" onClick={onData}>
          📊 {tr.data.open}
        </button>
      </div>
    </div>
  );
}
