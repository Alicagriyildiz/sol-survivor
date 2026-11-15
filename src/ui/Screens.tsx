import { useState } from 'react';
import { sourceText } from '../blackbox/text';
import { SOURCES, tr } from '../content';
import { score, solReport } from '../sim/selectors';
import { RESOURCES, type Deltas, type GameState, type TraceEntry } from '../sim/types';
import { Chart, DeltaList, fmtNum, type Level } from './parts';
import { colors, resourceIcon } from './tokens';

export function Start({ onStart }: { onStart: (seed: number, level: Level) => void }) {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const [level, setLevel] = useState<Level>('junior');
  return (
    <div className="screen start">
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
        <button className="btn primary big" onClick={() => onStart(seed, level)}>
          🚀 {tr.ui.start}
        </button>
      </div>
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
  return (
    <div className="screen briefing">
      <p className="dim">
        {tr.ui.sol} {s.sol} {tr.ui.of} {s.config.solCount} · {tr.ui.briefing}
      </p>
      <h1>{t.title}</h1>
      <div className="card">
        <h3>🌤 {tr.ui.weather}</h3>
        <p>{t.weather}</p>
      </div>
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

function sumEntries(entries: TraceEntry[]): { label: string; d: Deltas }[] {
  const map = new Map<string, Deltas>();
  for (const e of entries) {
    const label = sourceText(e.source) || e.key;
    const d = map.get(label) ?? {};
    for (const k of ['power', 'life', 'shield', 'health', 'dose'] as const) if (e.deltas[k]) d[k] = (d[k] ?? 0) + e.deltas[k]!;
    map.set(label, d);
  }
  return [...map.entries()].map(([label, d]) => ({ label, d }));
}

export function RealNote({ sol }: { sol: number }) {
  const src = SOURCES.find((x) => x.sol === sol);
  return (
    <div className="card real">
      <h3>📚 {tr.ui.whatReallyHappened}</h3>
      <p>{tr.notes[sol]}</p>
      {src && (
        <p className="dim small">
          {tr.ui.source}: {src.source} {!src.verified && <span className="badge">{tr.ui.unverified}</span>}
        </p>
      )}
    </div>
  );
}

export function SolReport({ s, sol, level, onNext }: { s: GameState; sol: number; level: Level; onNext: () => void }) {
  const rows = sumEntries(solReport(s, sol));
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
      <div className="card">
        <h3>🌙 {tr.ui.night}</h3>
        <ul className="report-list">
          {rows.map((r) => (
            <li key={r.label}>
              <span>{r.label}</span> <DeltaList d={r.d} level={level} />
            </li>
          ))}
        </ul>
      </div>
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
}: {
  s: GameState;
  level: Level;
  onBlackBox: () => void;
  onAgain: () => void;
  onSame: () => void;
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
            {resourceIcon.dose} {tr.ui.dose}: <strong>{fmtNum(s.dose, 0)}</strong>
          </li>
          <li>
            ⭐ {tr.ui.score}: <strong>{score(s)}</strong>
          </li>
        </ul>
        <Chart metric="health" series={[{ name: 'health', color: colors.accent, data: s.history }]} />
      </div>
      <div className="row wrap">
        <button className="btn primary big" onClick={onBlackBox}>
          ⬛ {tr.ui.openBlackBox}
        </button>
        <button className="btn" onClick={onSame}>
          🔁 {tr.ui.sameSeed}
        </button>
        <button className="btn" onClick={onAgain}>
          🎲 {tr.ui.playAgain}
        </button>
      </div>
      {level === 'junior' && <p className="dim small">{tr.blackbox.intro}</p>}
    </div>
  );
}
