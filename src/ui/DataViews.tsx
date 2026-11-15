// Everything the player sees about the real NASA data: the sol 12 event card, the space
// weather line, the 2018 storm line, study notes, the dose comparison and the "Data" screen.
// Values come from content/data.ts (snapshot files); the game never goes online.
import { Icon } from './icons';
import { SOURCES, data, fmt, numLocale, tr } from '../content';
import type { GameState } from '../sim/types';
import { fmtDate, fmtNum, mGy } from './parts';

const levelText = (e: data.SolarEvent) => tr.eventLevel[e.level] ?? e.level;

/** Sol 12 fault panel: which real event this is, in a child's words, and its source. */
export function SolarEventCard({ s }: { s: GameState }) {
  const e = data.solarEventOf(s);
  return (
    <div className="card data-card">
      <h4>☀ {fmt(tr.solarEvent.title, { date: fmtDate(e.date) })}</h4>
      <p>{fmt(tr.solarEvent.line, { cls: e.classType, level: levelText(e) })}</p>
      <details className="why">
        <summary>ⓘ {tr.ui.moreInfo}</summary>
        <p className="small">{tr.solarEvent.kid}</p>
        <p className="small">{fmt(tr.solarEvent.effect, { shield: fmtNum(e.shieldHit), rad: fmtNum(mGy(e.radiation), 1) })}</p>
        <p className="dim small">{tr.solarEvent.scale}</p>
        <p className="dim small">
          {fmt(tr.solarEvent.source, { id: e.flrID })} ·{' '}
          <a href={e.link} target="_blank" rel="noopener noreferrer">
            DONKI
          </a>
        </p>
      </details>
    </div>
  );
}

/** Briefing line "Space weather: …" (forecast of the sol 12 event). */
export function SpaceWeatherLine({ s }: { s: GameState }) {
  const w = data.spaceWeather(s);
  const sw = tr.spaceWeather;
  const text =
    w.kind === 'warn'
      ? fmt(sw.warn, { level: levelText(w.event) })
      : w.kind === 'today'
        ? fmt(sw.today, { cls: w.event.classType, level: levelText(w.event) })
        : sw[w.kind];
  return (
    <p className={`small ${w.kind === 'warn' || w.kind === 'today' ? 'note warn' : ''}`}>
      ☀ <strong>{sw.label}:</strong> {text}
    </p>
  );
}

/** 2018 storm values on the storm sols. */
export function StormLine({ sol }: { sol: number }) {
  if (!data.STORM_NOTE_SOLS.includes(sol)) return null;
  const st = data.STORM;
  return (
    <div className="small data-line">
      <p>
        🌪 {fmt(tr.storm.line, { tau: fmtNum(st.tauPeak), normal: fmtNum(st.tauNormal), wh: st.opportunityLowestWh })}
      </p>
      <p className="dim">{tr.storm.game}</p>
    </div>
  );
}

/** OSDR study note on the sol report. */
export function StudyLine({ sol }: { sol: number }) {
  const st = data.studyFor(sol);
  const text = tr.study[`s${sol}`];
  if (!st || !text) return null;
  return (
    <p className="small data-line study-note">
      <span className="note-tag">
        <Icon name="flask" size={15} /> {tr.study.label}
      </span>{' '}
      {text}{' '}
      <span className="dim">
        (NASA OSDR{' '}
        <a href={st.url} target="_blank" rel="noopener noreferrer">
          {st.accession}
        </a>
        : “{st.title}”)
      </span>
    </p>
  );
}

/** End screen: your dose vs. the Mars surface (RAD) and the ISS (RadLab) over the same days. */
export function DoseCompare({ s }: { s: GameState }) {
  const days = s.outcome?.sol ?? s.sol;
  const di = tr.doseInfo;
  return (
    <div className="card">
      <h3>☢ {di.endTitle}</h3>
      <ul className="stats">
        <li>{fmt(di.endYou, { you: fmtNum(mGy(s.dose), 1) })}</li>
        <li>{fmt(di.endMars, { days, mars: fmtNum(days * data.MARS_SURFACE_MGY_PER_DAY, 1) })}</li>
        <li>{fmt(di.endIss, { days, iss: fmtNum(days * data.ISS_MGY_PER_DAY, 1) })}</li>
      </ul>
      <p className="dim small">{di.endNote}</p>
    </div>
  );
}

/** "Data" screen: every dataset, its source, date and what it changes in the game. */
export function DataScreen({ onBack }: { onBack: () => void }) {
  const d = tr.data;
  const m = data.DONKI_META;
  const pub = data.PUBLISHED;
  const st = data.STORM;
  const events = data.SOLAR_EVENTS.map((e) => `${e.classType} (${fmtDate(e.date)})`).join(', ');
  const studies = data.OSDR_STUDIES.map((x) => x.accession).join(', ');
  const rows: { what: string; source: string; date: string; effect: string; manual?: boolean; link?: string }[] = [
    {
      what: fmt(d.donki, { flares: m.counts.flares, cand: m.counts.flaresWithLinkedSEP, n: data.SOLAR_EVENTS.length, list: events }),
      source: 'NASA DONKI (CCMC, NASA Goddard)',
      date: fmt(d.downloaded, { date: fmtDate(m.downloadedAt) }),
      effect: d.donkiEffect,
      link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    },
    {
      what: fmt(d.rad, { v: fmtNum(data.MARS_SURFACE_MGY_PER_DAY, 2) }),
      source: 'NASA / Curiosity RAD',
      date: fmt(d.read, { date: fmtDate(pub.accessedAt) }),
      effect: d.radEffect,
      manual: true,
      link: pub.values.marsSurfaceAbsorbedDose.url,
    },
    {
      what: fmt(d.radlab, { n: data.RADLAB_META.readings.toLocaleString(numLocale()), v: fmtNum(data.ISS_MGY_PER_DAY, 2) }),
      source: 'NASA OSDR RadLab',
      date: fmt(d.downloaded, { date: fmtDate(data.RADLAB_META.downloadedAt) }),
      effect: d.radlabEffect,
      link: 'https://visualization.osdr.nasa.gov/radlab/',
    },
    {
      what: fmt(d.storm, { tau: fmtNum(st.tauPeak), normal: fmtNum(st.tauNormal), recharge: fmtNum(st.tauRecharge), wh: st.opportunityLowestWh }),
      source: 'NASA / JPL (Opportunity)',
      date: fmt(d.read, { date: fmtDate(pub.accessedAt) }),
      effect: d.stormEffect,
      manual: true,
      link: pub.values.stormTauPeak.url,
    },
    {
      what: fmt(d.osdr, { list: studies }),
      source: 'NASA Open Science Data Repository (OSDR)',
      date: fmt(d.downloaded, { date: fmtDate(data.OSDR_META.downloadedAt) }),
      effect: d.osdrEffect,
      link: 'https://osdr.nasa.gov/',
    },
    {
      what: d.notes,
      source: fmt(d.notesSource, { n: SOURCES.length }),
      date: fmt(d.read, { date: fmtDate(pub.accessedAt) }),
      effect: fmt(d.notesEffect, { v: data.VERIFIED_NOTES }),
    },
  ];
  return (
    <div className="screen data-screen">
      <h1>📊 {d.title}</h1>
      <p className="lead">{d.intro}</p>
      <p className="note">{d.frame}</p>
      <div className="data-table">
        <div className="data-row head" aria-hidden>
          <span>{d.colData}</span>
          <span>{d.colSource}</span>
          <span>{d.colDate}</span>
          <span>{d.colEffect}</span>
        </div>
        {rows.map((r) => (
          <div key={r.what} className="data-row card">
            <span>
              <span className="mlabel">{d.colData}: </span>
              {r.what}
              {r.manual && <span className="dim small block">ℹ {d.manualTag}</span>}
            </span>
            <span>
              <span className="mlabel">{d.colSource}: </span>
              {r.link ? (
                <a href={r.link} target="_blank" rel="noopener noreferrer">
                  {r.source}
                </a>
              ) : (
                r.source
              )}
            </span>
            <span>
              <span className="mlabel">{d.colDate}: </span>
              {r.date}
            </span>
            <span>
              <span className="mlabel">{d.colEffect}: </span>
              {r.effect}
            </span>
          </div>
        ))}
      </div>
      <p className="small">{d.design}</p>
      <p className="dim small">{d.more}</p>
      <p className="dim small">{d.aiNote}</p>
      <button className="btn primary big" onClick={onBack}>
        ← {tr.blackbox.back}
      </button>
    </div>
  );
}
