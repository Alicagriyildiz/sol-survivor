#!/usr/bin/env node
// Downloads NASA open data ONCE and writes snapshot files to src/data/.
// The game never goes online: it only reads these snapshot files.
//
//   npm run fetch-data            # all sources
//   npm run fetch-data -- donki   # one source (donki | radlab | osdr)
//
// No API key is needed: DONKI is read from the keyless CCMC web service, RadLab and the
// OSDR search API are public. Responses are cached in scripts/.cache/ (git-ignored) so a
// re-run does not hammer the services. Delete that folder to download fresh data.
//
// src/data/published-values.json is NOT written here: it holds a few numbers typed in
// by hand from official NASA pages (each with URL and quote). See docs/DATA.md.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data');
const CACHE = join(ROOT, 'scripts', '.cache');
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { text = false } = {}) {
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE, key);
  try {
    const body = await readFile(file, 'utf8');
    return text ? body : JSON.parse(body);
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sol-survivor-fetch-data (educational game)' } });
      const body = await res.text();
      if (res.status === 429) throw new Error('rate limited');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
      const parsed = text ? body : body.trim() === '' ? [] : JSON.parse(body);
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, body);
      await sleep(300); // be polite
      return parsed;
    } catch (e) {
      if (attempt === 4) throw new Error(`${url}: ${e.message}`);
      const wait = 5000 * attempt;
      console.warn(`  retry ${attempt} in ${wait / 1000}s (${e.message})`);
      await sleep(wait);
    }
  }
}

async function save(name, data) {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote src/data/${name}`);
}

// ---------------------------------------------------------------- DONKI (solar flares + particle events)

const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get';
const DONKI_FROM = '2010-04-01';
const DONKI_TO = '2025-12-31';

/** The service accepts at most 60 days per request. */
function windows(from, to, days = 60) {
  const out = [];
  let a = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (a <= end) {
    const b = new Date(Math.min(a.getTime() + (days - 1) * 86400e3, end.getTime()));
    out.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    a = new Date(b.getTime() + 86400e3);
  }
  return out;
}

/** GOES X-ray class -> peak flux in W/m^2 (C1 = 1e-6, M1 = 1e-5, X1 = 1e-4). */
export function classToFlux(c) {
  const base = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[c[0]];
  return base * Number(c.slice(1));
}

// Selection rule (documented in docs/DATA.md):
// 1. Candidates = DONKI flares that DONKI links to at least one solar energetic particle
//    (SEP) event (link in either record). Only those sent particles towards a spacecraft,
//    which is what the game's sol 12 event is about.
// 2. Strength bands by peak X-ray flux. One event per band.
// 3. Inside a band: the flare with the most linked SEP records (seen by more instruments),
//    ties -> the later one.
// 4. Picked events never share a linked SEP record (no two flares behind one particle
//    event). Bands are filled from the strongest down.
// 5. Exception: the strongest band uses the 10 Sep 2017 X8.2 flare, the event whose
//    particles NASA reported at the surface of Mars (Curiosity RAD), if it is a candidate.
const BANDS = [
  { id: 'C', min: 1e-6, max: 1e-5 },
  { id: 'M1', min: 1e-5, max: 5e-5 },
  { id: 'M5', min: 5e-5, max: 1e-4 },
  { id: 'X1', min: 1e-4, max: 5e-4 },
  { id: 'X5', min: 5e-4, max: Infinity },
];
const PREFERRED = { X5: '2017-09-10T15:35:00-FLR-001' };

async function donki() {
  console.log('DONKI: downloading FLR + SEP in 60-day windows…');
  const flr = [];
  const sep = [];
  const requests = [];
  for (const [a, b] of windows(DONKI_FROM, DONKI_TO)) {
    for (const [type, list] of [['FLR', flr], ['SEP', sep]]) {
      const url = `${DONKI}/${type}?startDate=${a}&endDate=${b}`;
      requests.push(url);
      list.push(...(await get(url)));
    }
    process.stdout.write('.');
  }
  console.log(`\n  ${flr.length} flares, ${sep.length} particle events`);
  const linked = new Map();
  const link = (f, s) => {
    if (!linked.has(f)) linked.set(f, new Set());
    linked.get(f).add(s);
  };
  const flrIds = new Set(flr.map((f) => f.flrID));
  for (const s of sep) for (const l of s.linkedEvents ?? []) if (flrIds.has(l.activityID)) link(l.activityID, s.sepID);
  for (const f of flr) for (const l of f.linkedEvents ?? []) if (/-SEP-/.test(l.activityID)) link(f.flrID, l.activityID);
  const candidates = flr
    .filter((f) => linked.has(f.flrID) && /^[ABCMX]\d/.test(f.classType ?? ''))
    .map((f) => ({ flr: f, flux: classToFlux(f.classType), seps: [...linked.get(f.flrID)].sort() }))
    .sort((x, y) => x.flux - y.flux || x.flr.peakTime.localeCompare(y.flr.peakTime));
  const events = [];
  const usedSep = new Set();
  // Strongest band first, so the preferred 2017 event is fixed before the others.
  for (const band of [...BANDS].reverse()) {
    const inBand = candidates.filter(
      (c) => c.flux >= band.min && c.flux < band.max && !c.seps.some((id) => usedSep.has(id)),
    );
    if (inBand.length === 0) continue;
    let pick = inBand.find((c) => c.flr.flrID === PREFERRED[band.id]);
    if (!pick)
      pick = [...inBand].sort((x, y) => y.seps.length - x.seps.length || y.flr.peakTime.localeCompare(x.flr.peakTime))[0];
    const f = pick.flr;
    pick.seps.forEach((id) => usedSep.add(id));
    events.unshift({
      band: band.id,
      flrID: f.flrID,
      classType: f.classType,
      peakFluxWm2: pick.flux,
      beginTime: f.beginTime,
      peakTime: f.peakTime,
      endTime: f.endTime,
      sourceLocation: f.sourceLocation,
      activeRegionNum: f.activeRegionNum,
      instruments: (f.instruments ?? []).map((i) => i.displayName),
      linkedSEP: pick.seps,
      link: f.link,
      candidatesInBand: inBand.length,
    });
  }
  await save('donki-solar-events.json', {
    source: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), CCMC at NASA Goddard',
    attribution: 'Data: NASA Community Coordinated Modeling Center (CCMC), DONKI. https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    endpoint: `${DONKI}/FLR and ${DONKI}/SEP (keyless; same data as api.nasa.gov/DONKI)`,
    query: `FLR and SEP, startDate ${DONKI_FROM} to endDate ${DONKI_TO}, in 60-day windows (${requests.length} requests)`,
    exampleRequest: requests[0],
    downloadedAt: today,
    counts: { flares: flr.length, sepEvents: sep.length, flaresWithLinkedSEP: candidates.length },
    selectionRule:
      'Flares linked to >=1 SEP event; one per peak-flux band (C, M1-M5, M5-X1, X1-X5, >=X5); inside a band most linked SEP records, ties -> later; picks never share an SEP record (strongest band first); >=X5 band prefers 2017-09-10 X8.2 (particles reported at Mars by Curiosity RAD).',
    events,
  });
}

// ---------------------------------------------------------------- RadLab (ISS dosimetry)

const RADLAB_URL =
  'https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument_id=DosTel1' +
  '&timestamp%3E=2022-03-01T00:00&timestamp%3C2022-04-01T00:00&absorbed_dose_rate&module&format=tsv';

async function radlab() {
  console.log('RadLab: downloading one month of ISS DosTel1 absorbed dose rate…');
  const tsv = await get(RADLAB_URL, { text: true });
  const rows = tsv.trim().split('\n');
  const head = rows[0].split('\t');
  const iT = head.indexOf('timestamp');
  const iV = head.indexOf('absorbed_dose_rate');
  const iM = head.indexOf('module');
  const pts = rows
    .slice(1)
    .map((r) => r.split('\t'))
    .map((c) => ({ t: Date.parse(c[iT].replace(/"/g, '') + 'Z'), v: Number(c[iV]), m: c[iM]?.replace(/"/g, '') }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
  // Time-weighted mean: each reading holds until the next one (gaps capped at 10 min).
  // A plain average of readings is biased because the instrument reports more often
  // while dose rates are high (e.g. South Atlantic Anomaly passes).
  let num = 0;
  let den = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const dt = Math.min((pts[i + 1].t - pts[i].t) / 1000, 600);
    if (dt <= 0) continue;
    num += pts[i].v * dt;
    den += dt;
  }
  const meanUGyPerHour = num / den;
  const plainMean = pts.reduce((a, p) => a + p.v, 0) / pts.length;
  await save('radlab-iss-dose.json', {
    source: 'NASA OSDR RadLab (radiation dosimetry database), ISS DOSIS-3D DosTel1 detector, Columbus module',
    attribution: 'Data: NASA Open Science Data Repository (OSDR) RadLab. https://visualization.osdr.nasa.gov/radlab/',
    request: RADLAB_URL,
    query: 'ISS, instrument DosTel1, 2022-03-01 to 2022-04-01, field absorbed_dose_rate (unit µGy/hour per RadLab API docs)',
    downloadedAt: today,
    unit: 'µGy/hour (absorbed dose rate)',
    readings: pts.length,
    hoursCovered: Math.round((den / 3600) * 10) / 10,
    module: [...new Set(pts.map((p) => p.m))].join(', '),
    method: 'time-weighted mean; each reading holds until the next one, gaps capped at 10 minutes',
    timeWeightedMeanUGyPerHour: Math.round(meanUGyPerHour * 1000) / 1000,
    plainMeanOfReadingsUGyPerHour: Math.round(plainMean * 1000) / 1000,
    mGyPerDay: Math.round(((meanUGyPerHour * 24) / 1000) * 1000) / 1000,
  });
}

// ---------------------------------------------------------------- OSDR (study search)

const OSDR = 'https://osdr.nasa.gov/osdr/data/search';
// One topic per sol. `pick`: first search hit whose title matches the pattern.
const OSDR_TOPICS = [
  { sol: 2, topic: 'microbes in ISS water and surfaces', term: 'microbial observatory', pick: /Microbial Observatory/i },
  { sol: 3, topic: 'growing food plants in space', term: 'plant growth', pick: /Chile Peppers/i },
  { sol: 9, topic: 'bone and muscle loss in spaceflight', term: 'bone loss', pick: /muscle and bone loss/i },
  { sol: 12, topic: 'radiation and living cells', term: 'space radiation', pick: /Arabidopsis thaliana Seeds/i },
];

async function osdr() {
  console.log('OSDR: searching studies…');
  const studies = [];
  const requests = [];
  for (const t of OSDR_TOPICS) {
    const url = `${OSDR}?term=${encodeURIComponent(t.term)}&type=cgene&size=25`;
    requests.push(url);
    const res = await get(url);
    const hit = res.hits.hits.map((h) => h._source).find((s) => t.pick.test(s['Study Title'] ?? ''));
    if (!hit) {
      console.warn(`  no match for sol ${t.sol} (${t.term})`);
      continue;
    }
    const mission = typeof hit.Mission === 'object' ? hit.Mission : {};
    studies.push({
      sol: t.sol,
      topic: t.topic,
      searchTerm: t.term,
      accession: hit.Accession,
      title: hit['Study Title'],
      projectType: hit['Project Type'],
      flightProgram: hit['Flight Program'],
      mission: mission.Name ?? null,
      organism: hit.organism ?? null,
      description: String(hit['Study Description'] ?? '').slice(0, 600),
      url: `https://osdr.nasa.gov/bio/repo/data/studies/${hit.Accession}`,
    });
  }
  await save('osdr-studies.json', {
    source: 'NASA Open Science Data Repository (OSDR) study search API',
    attribution: 'Data: NASA Open Science Data Repository. https://osdr.nasa.gov/',
    endpoint: OSDR,
    requests,
    query: 'type=cgene, one search term per topic; first hit whose title matches the topic pattern in scripts/fetch-data.mjs',
    downloadedAt: today,
    studies,
  });
}

const only = process.argv[2];
const jobs = { donki, radlab, osdr };
for (const [name, job] of Object.entries(jobs)) {
  if (only && only !== name) continue;
  try {
    await job();
  } catch (e) {
    console.error(`${name} FAILED: ${e.message}`);
    process.exitCode = 1;
  }
}
