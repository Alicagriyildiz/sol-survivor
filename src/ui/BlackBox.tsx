import { useMemo, useState } from 'react';
import {
  alternatives,
  counterfactual,
  explanationText,
  faultTitle,
  findRescues,
  optionLabel,
  type Counterfactual,
  type MissionLog,
  type Rescue,
} from '../blackbox';
import { engine, fmt, tr } from '../content';
import { numSuffix } from '../content/lang/tr';
import type { GameState, Invalid } from '../sim/types';
import { Chart, fmtNum, type Level } from './parts';
import { colors } from './tokens';

const invalidText = (r: Invalid) =>
  r === 'hours' ? tr.ui.notEnoughHours : r === 'items' ? tr.ui.missingItem : r === 'requires' ? tr.ui.requiresMissing : tr.ui.locked;

function OutcomeCard({ title, s, color }: { title: string; s: GameState; color: string }) {
  const o = s.outcome!;
  return (
    <div className="card outcome" style={{ borderColor: color }}>
      <h3 style={{ color }}>{title}</h3>
      <p className="big-line">{o.won ? `✅ ${tr.blackbox.survived}` : `🛑 ${fmt(tr.blackbox.died, { sol: o.sol })}`}</p>
      <p className="small">
        ♥ {tr.res.health}: <strong>{fmtNum(s.health, 0)}</strong> · ☢ {tr.res.dose}: <strong>{fmtNum(s.dose, 0)}</strong>
      </p>
    </div>
  );
}

export function BlackBox({ log, final, level, onBack }: { log: MissionLog; final: GameState; level: Level; onBack: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [alt, setAlt] = useState<string | null>(null);
  const [guess, setGuess] = useState<'changes' | 'same' | null>(null);
  const [result, setResult] = useState<Counterfactual | null>(null);
  const [rescues, setRescues] = useState<Rescue[] | null>(null);
  const [metric, setMetric] = useState<'health' | 'power' | 'life' | 'shield'>('health');

  const alts = useMemo(() => (sel === null ? [] : alternatives(engine, log, sel)), [sel, log]);
  const won = final.outcome!.won;

  const pick = (i: number) => {
    setSel(i);
    setAlt(null);
    setGuess(null);
    setResult(null);
  };

  const run = () => {
    if (sel === null || alt === null) return;
    setResult(counterfactual(engine, log, sel, alt));
  };

  const predictionRight =
    result && guess ? (result.alt.final.outcome!.won !== won) === (guess === 'changes') : null;

  return (
    <div className="screen blackbox">
      <div className="row between">
        <h1>⬛ {tr.blackbox.title}</h1>
        <button className="btn ghost" onClick={onBack}>
          ← {tr.blackbox.back}
        </button>
      </div>
      <p className="lead">{tr.blackbox.intro}</p>

      <div className="bb-grid">
        <section className="card">
          <h3>{tr.blackbox.step1}</h3>
          <ol className="decisions">
            {final.decisions.map((d) => (
              <li key={d.index}>
                <button className={`decision ${sel === d.index ? 'on' : ''}`} onClick={() => pick(d.index)}>
                  <span className="dim small">
                    {tr.ui.sol} {d.sol}
                  </span>{' '}
                  <strong>{faultTitle(d.faultId)}</strong>
                  <span className="small">
                    {' '}
                    → {optionLabel(d.faultId, d.optionId)}
                    {d.auto && <em className="dim"> ({tr.ui.auto})</em>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={() => setRescues(findRescues(engine, log))}>
            🔍 {tr.blackbox.findRescues}
          </button>
          {rescues && (
            <div className="rescues">
              {rescues.length === 0 ? (
                <p>{won ? tr.blackbox.noFlip : tr.blackbox.noRescue}</p>
              ) : (
                <>
                  <p>{won ? tr.blackbox.flipsFound : tr.blackbox.rescuesFound}</p>
                  <ul className="small">
                    {rescues.map((r) => (
                      <li key={`${r.decisionIndex}-${r.optionId}`}>
                        <button
                          className="link"
                          onClick={() => {
                            pick(r.decisionIndex);
                            setAlt(r.optionId);
                          }}
                        >
                          {tr.ui.sol} {r.decision.sol}: {faultTitle(r.decision.faultId)} → {optionLabel(r.decision.faultId, r.optionId)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>

        <section className="card">
          {sel === null ? (
            <p className="dim">{tr.blackbox.step1}</p>
          ) : (
            <>
              <h3>{tr.blackbox.step2}</h3>
              <p className="small">
                {tr.blackbox.chosen}: <strong>{optionLabel(final.decisions[sel]!.faultId, final.decisions[sel]!.optionId)}</strong>
              </p>
              <div className="alts">
                {alts.map((a) => (
                  <button
                    key={a.optionId}
                    disabled={!!a.invalid}
                    className={`alt ${alt === a.optionId ? 'on' : ''}`}
                    onClick={() => {
                      setAlt(a.optionId);
                      setResult(null);
                      setGuess(null);
                    }}
                  >
                    {optionLabel(final.decisions[sel]!.faultId, a.optionId)}
                    {a.invalid && (
                      <span className="dim small">
                        {' '}
                        — {tr.blackbox.unavailable}: {invalidText(a.invalid)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {alt && (
                <>
                  <h3>{tr.blackbox.step3}</h3>
                  <div className="row wrap">
                    <button className={`btn ${guess === 'changes' ? 'primary' : ''}`} onClick={() => setGuess('changes')}>
                      {won ? tr.blackbox.predictWinLose : tr.blackbox.predictSave}
                    </button>
                    <button className={`btn ${guess === 'same' ? 'primary' : ''}`} onClick={() => setGuess('same')}>
                      {won ? tr.blackbox.predictWinStill : tr.blackbox.predictSame}
                    </button>
                  </div>
                  <button className="btn primary big" disabled={!guess} onClick={run}>
                    ▶ {tr.blackbox.run}
                  </button>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {result && (
        <section className="result">
          <p className={`prediction ${predictionRight ? 'ok' : 'miss'}`}>
            {predictionRight ? `🎯 ${tr.blackbox.predictionRight}` : `🤔 ${tr.blackbox.predictionWrong}`}
          </p>
          <div className="side-by-side">
            <OutcomeCard title={tr.blackbox.yourMission} s={result.original} color={colors.original} />
            <OutcomeCard title={tr.blackbox.otherMission} s={result.alt.final} color={colors.alt} />
          </div>
          <div className="card">
            <div className="row between wrap">
              <h3>📈 {metric === 'health' ? tr.blackbox.chart : tr.res[metric]}</h3>
              <div className="row">
                {(['health', 'power', 'life', 'shield'] as const).map((m) => (
                  <button key={m} className={`btn small ${metric === m ? 'primary' : 'ghost'}`} onClick={() => setMetric(m)}>
                    {m === 'health' ? tr.res.health : tr.res[m]}
                  </button>
                ))}
              </div>
            </div>
            <Chart
              metric={metric}
              series={[
                { name: 'o', color: colors.original, data: result.explanation.curves.original, dashed: true },
                { name: 'a', color: colors.alt, data: result.explanation.curves.alt },
              ]}
            />
            <p className="small legend">
              <span style={{ color: colors.original }}>- - {tr.blackbox.yourMission}</span> ·{' '}
              <span style={{ color: colors.alt }}>— {tr.blackbox.otherMission}</span>
            </p>
          </div>
          <div className="card">
            <h3>💬 {tr.blackbox.why}</h3>
            <ol className="chain">
              {explanationText(result.explanation).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
            {result.alt.skipped.length > 0 && <p className="dim small">ℹ {tr.blackbox.skipped}</p>}
            {result.alt.autopilotFromSol !== null && (
              <p className="dim small">🤖 {fmt(tr.blackbox.autopilot, { sol: result.alt.autopilotFromSol, abl: numSuffix(result.alt.autopilotFromSol, 'abl') })}</p>
            )}
            {level === 'commander' && result.explanation.firstDivergenceSol !== null && (
              <p className="dim small">
                Δ {tr.ui.sol} {result.explanation.firstDivergenceSol}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
