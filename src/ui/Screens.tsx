import { lazy, Suspense, useEffect, useState } from 'react';
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
import { Icon } from './icons';

const Backdrop = lazy(() => import('../scene/Backdrop'));

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
  const [demoOpen, setDemoOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const t = tr.title;
  return (
    <div className="title-screen">
      <div className="title-bg" aria-hidden>
        {can3d && view === '3d' && (
          <Suspense fallback={null}>
            <Backdrop />
          </Suspense>
        )}
      </div>
      <div className="title-shade" aria-hidden />
      <div className="title-corner">
        <div className="title-toggle" role="group" aria-label={tr.ui.viewLabel}>
          {(['3d', '2d'] as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} disabled={v === '3d' && !can3d} onClick={() => setView(v)}>
              {v === '3d' ? t.view3d : t.view2d}
            </button>
          ))}
        </div>
        <LangSwitch />
      </div>
      <main className="title-main">
        <h1 className="title-logo" lang="en" aria-label="Sol Survivor">
          <span className="title-logo-a">SOL</span>
          <span className="title-logo-b">SURVIVOR</span>
        </h1>
        <p className="title-sub">{t.sub}</p>
        <button className="title-start" onClick={() => onStart(seed, level, tutorial)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path d="M7 4.5v15l12.5-7.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {t.start}
        </button>
        <div className="title-levels" role="radiogroup" aria-label={t.levelLabel}>
          {(['junior', 'commander'] as Level[]).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
              <span className="title-level-name">{l === 'junior' ? t.junior : t.commander}</span>
              <span className="title-level-line">{l === 'junior' ? t.juniorLine : t.commanderLine}</span>
            </button>
          ))}
        </div>
        <div className="title-links">
          <label className="title-check">
            <input type="checkbox" checked={tutorial} onChange={(e) => setTutorial(e.target.checked)} /> {t.tutorial}
          </label>
          <span className="title-seed">
            <label htmlFor="title-seed">{t.mission}</label>
            <input id="title-seed" type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
            <button type="button" className="title-link" title={t.newMission} aria-label={t.newMission} onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
                <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
          <button type="button" className="title-link" aria-expanded={demoOpen} onClick={() => setDemoOpen((o) => !o)}>
            {t.demo}
          </button>
          <button type="button" className="title-link" onClick={onData}>
            {t.data}
          </button>
          <button type="button" className="title-link" onClick={() => setHowOpen(true)}>
            {t.howTo}
          </button>
        </div>
        {demoOpen && (
          <div className="title-demo">
            {DEMO_STOPS.map((st, i) => (
              <button key={String(st)} type="button" className="title-link" onClick={() => onDemo(st)}>
                {i + 1} · {st === 4 ? tr.act.demo4 : st === 6 ? tr.act.demo6 : st === 12 ? tr.act.demo12 : tr.act.demoEnd}
              </button>
            ))}
          </div>
        )}
      </main>
      <footer className="title-foot">
        {t.footer} · {t.footerData}
      </footer>
      {howOpen && (
        <div className="title-how-back" onClick={() => setHowOpen(false)}>
          <section className="title-how" role="dialog" aria-modal="true" aria-label={t.howTo} onClick={(e) => e.stopPropagation()}>
            <div className="title-how-head">
              <h2>{t.howTo}</h2>
              <button type="button" className="title-link" onClick={() => setHowOpen(false)} autoFocus>
                {t.close}
              </button>
            </div>
            <p>{tr.ui.tagline}</p>
            <ol>
              <li>{t.how1}</li>
              <li>{t.how2}</li>
              <li>{t.how3}</li>
            </ol>
            <p className="dim">{t.howData}</p>
            <h3>{t.glossary}</h3>
            <dl>
              {tr.glossary.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
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
      <div className="card today-card">
        <h3>
          <Icon name="target" /> {tr.ui.briefingToday}
        </h3>
        <ul className="today">
          {faults.map((f) => (
            <li key={f.faultId}>
              <span className="today-fault">
                <Icon name="alert" /> <strong>{faultTitle(f.faultId)}</strong>
              </span>
              <span className="today-place">
                <Icon name="pin" size={16} /> {tr.stations[f.station]!.name}
              </span>
              {f.returning && <span className="badge">{tr.ui.returning}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>
          <Icon name="sun" /> {tr.ui.weather}
        </h3>
        <p>{t.weather}</p>
        {storm && <p className="note danger small"><Icon name="lock" size={15} /> {tr.ui.briefingStorm}</p>}
        <SpaceWeatherLine s={s} />
        <StormLine sol={s.sol} />
      </div>
      {notes.length > 0 && (
        <div className="card chain-card">
          <h3>
            <Icon name="link" /> {tr.ui.briefingChain}
          </h3>
          {notes.map((n) => (
            <p key={n} className="small">
              {tr.chain[n]}
            </p>
          ))}
        </div>
      )}
      <div className="card message">
        <h3>
          <Icon name="signal" /> {tr.ui.earthMessage}
        </h3>
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
    <div className="card real note-card">
      <p className="note-tag">
        <Icon name="book" size={15} /> {tr.ui.whatReallyHappened}
      </p>
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
  const top = [...RESOURCES, 'health' as const]
    .map((k) => ({ k, from: k === 'health' ? prev.health : prev.res[k], to: k === 'health' ? now.health : now.res[k], d: change[k] ?? 0 }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .slice(0, 3);
  return (
    <div className="screen report">
      <div className="card report-hero">
        <p className="report-kicker">{tr.ui.report}</p>
        <h1 className="report-sol">
          {tr.ui.sol} {sol}
        </h1>
        <p className="report-title">{tr.sols[sol]?.title}</p>
        <SolStrip />
        <ul className="report-top">
          {top.map((t) => (
            <GaugeChange key={t.k} k={t.k} from={t.from} to={t.to} d={t.d} />
          ))}
        </ul>
        {sol === s.config.solCount && s.outcome?.won && <p className="lead">{tr.ui.finalDay}</p>}
        <button className="btn primary big" onClick={onNext} autoFocus>
          {s.outcome ? tr.ui.finalStats : tr.ui.nextSol} →
        </button>
      </div>
      <details className="card report-more">
        <summary>
          {tr.ui.changes} ({tr.ui.sol} {sol})
        </summary>
        <DeltaList d={change} level={level} />
        {sections.map((sec) => (
          <div key={sec} className="report-sec">
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
      </details>
      <RealNote sol={sol} />
    </div>
  );
}

/** Day -> night -> morning: the sun sets on the left, stars in the middle, sunrise on the right. */
function SolStrip() {
  return (
    <svg className="sol-strip" viewBox="0 0 640 36" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="solstrip" x1="0" x2="1">
          <stop offset="0" stopColor={colors.skyHorizon} />
          <stop offset="0.3" stopColor={colors.skyTop} />
          <stop offset="0.5" stopColor={colors.skyNightTop} />
          <stop offset="0.72" stopColor={colors.skyTop} />
          <stop offset="1" stopColor={colors.skyHorizon} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="36" rx="6" fill="url(#solstrip)" />
      <circle className="sol-strip-sun" cx="56" cy="22" r="8" fill="#f6f2ef" />
      {[[240, 10], [262, 24], [284, 8], [306, 18], [330, 11], [352, 25], [376, 9], [398, 19], [418, 12]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.2" fill="#e9eefa" className="sol-strip-star" />
      ))}
      <circle className="sol-strip-rise" cx="590" cy="26" r="7" fill="#f6f2ef" />
    </svg>
  );
}

function useCountUp(from: number, to: number, ms = 650) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let still = false;
    try {
      still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      // keep animation
    }
    if (still || from === to) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(from + (to - from) * (1 - (1 - k) * (1 - k)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms]);
  return v;
}

/** One gauge: old value as a faint bar, new value on top; "70 → 62" and the signed change in words-free
 *  numbers, coloured (teal better, rose worse, grey none) and marked with a sign so colour is not the only cue. */
function GaugeChange({ k, from, to, d }: { k: (typeof RESOURCES)[number] | 'health'; from: number; to: number; d: number }) {
  const v = useCountUp(from, to);
  const kind = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'same';
  const label = k === 'health' ? tr.res.health : tr.res[k];
  return (
    <li className={`gauge-change ${kind}`}>
      <div className="gauge-change-head">
        <span className="gauge-change-name">
          {resourceIcon[k]} {label}
        </span>
        <span className="gauge-change-nums">
          {fmtNum(from, 0)} → <strong>{fmtNum(v, 0)}</strong>
          <span className="gauge-change-d">{kind === 'same' ? '±0' : `${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d), 0)}`}</span>
        </span>
      </div>
      <div className="gauge-change-bar">
        <span className="was" style={{ width: `${Math.max(0, Math.min(100, from))}%` }} />
        <span className="now" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
      </div>
    </li>
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
      <h1 className={`end-title ${o.won ? 'won' : 'lost'}`}>
        <Icon name={o.won ? 'check' : 'stop'} size={30} /> {o.won ? tr.ui.missionWon : tr.ui.missionLost}
      </h1>
      {!o.won && o.cause && (
        <p className="lead">
          {tr.ui.lostBecause} <strong>{tr.causeName[o.cause]}</strong> ({tr.ui.sol} {o.sol})
        </p>
      )}
      {/* The Black Box is the main next step: first, big, with one line saying what it does. */}
      <div className="card end-next">
        <p className="end-invite">
          <Icon name="search" /> {o.won ? tr.ending.inviteWon : tr.ending.invite}</p>
        <button className="btn primary big" onClick={onBlackBox} autoFocus>
          <Icon name="box" /> {tr.ui.openBlackBox} →
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
