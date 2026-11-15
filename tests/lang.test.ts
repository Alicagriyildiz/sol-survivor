// English text pack must mirror the Turkish one: same keys, same shape, same placeholders.
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../src/content/lang/en';
import { tr as trText } from '../src/content/lang/tr';
import * as content from '../src/content';
import * as lang from '../src/content/lang';
import { explanationText, faultTitle, optionLabel, sourceText } from '../src/blackbox/text';
import { alternatives, counterfactual, replay, type MissionLog } from '../src/blackbox';
import { BOTS, playGame } from '../src/bots/bots';
import { solReportRows } from '../src/sim/selectors';

type Leaf = { path: string; value: unknown };

function leaves(v: unknown, path = ''): Leaf[] {
  if (Array.isArray(v)) return [{ path: `${path}[len]`, value: v.length }, ...v.flatMap((x, i) => leaves(x, `${path}[${i}]`))];
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k));
  return [{ path, value: v }];
}

// Turkish-only grammar placeholders (number case suffixes); English templates leave them out.
const TURKISH_ONLY = new Set(['loc', 'abl']);
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).filter((p) => !TURKISH_ONLY.has(p)).sort();

describe('language packs', () => {
  const trLeaves = new Map(leaves(trText).map((l) => [l.path, l.value]));
  const enLeaves = new Map(leaves(en).map((l) => [l.path, l.value]));

  it('every key in tr exists in en and vice versa (arrays same length)', () => {
    const missing = [...trLeaves.keys()].filter((k) => !enLeaves.has(k));
    const extra = [...enLeaves.keys()].filter((k) => !trLeaves.has(k));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    for (const [k, v] of trLeaves) if (k.endsWith('[len]')) expect(enLeaves.get(k), k).toBe(v);
  });

  it('no empty strings, same value types', () => {
    for (const [k, v] of enLeaves) {
      expect(typeof v, k).toBe(typeof trLeaves.get(k));
      if (typeof v === 'string') expect(v.trim().length, k).toBeGreaterThan(0);
    }
  });

  it('same placeholders per string', () => {
    const bad: string[] = [];
    for (const [k, v] of trLeaves) {
      if (typeof v !== 'string') continue;
      const e = enLeaves.get(k);
      if (typeof e !== 'string') continue;
      if (placeholders(v).join(',') !== placeholders(e).join(',')) bad.push(`${k}: tr {${placeholders(v)}} en {${placeholders(e)}}`);
    }
    expect(bad).toEqual([]);
  });

  it('English text has no Turkish letters', () => {
    const turkish = /[çğıöşüÇĞİÖŞÜ]/;
    const hits = [...enLeaves].filter(([, v]) => typeof v === 'string' && turkish.test(v)).map(([k]) => k);
    expect(hits).toEqual([]);
  });

  it('facts kept: every number in a Turkish note appears in the English note', () => {
    const nums = (s: string) => (s.match(/\d+/g) ?? []).sort();
    for (const k of Object.keys(trText.notes)) {
      const n = Number(k);
      expect(nums(en.notes[n]!), `notes.${k}`).toEqual(nums(trText.notes[n]!));
    }
  });
});

describe('setLang', () => {
  afterEach(() => lang.setLang('tr', { save: false }));

  it('defaults to Turkish outside a browser', () => {
    expect(lang.getLang()).toBe('tr');
    expect(content.tr).toBe(trText);
  });

  it('round-trips and updates the live binding seen by importers', () => {
    let calls = 0;
    const off = content.subscribeLang(() => calls++);
    content.setLang('en', { save: false });
    expect(content.getLang()).toBe('en');
    expect(content.tr).toBe(en);
    expect(lang.tr.ui.start).toBe(en.ui.start);
    expect(faultTitle('s1_wakeup')).toBe(en.faults.s1_wakeup!.title);
    expect(optionLabel('s1_seal', 'wipe')).toBe(en.faults.s1_seal!.options.wipe!.label);
    expect(content.numSuffix(6, 'loc')).toBe('');
    content.setLang('tr', { save: false });
    expect(content.getLang()).toBe('tr');
    expect(content.tr).toBe(trText);
    expect(faultTitle('s1_wakeup')).toBe(trText.faults.s1_wakeup!.title);
    expect(content.numSuffix(6, 'loc')).toBe("'da");
    expect(calls).toBe(2);
    content.setLang('tr', { save: false }); // no change, no notification
    expect(calls).toBe(2);
    off();
  });

  it('Black Box explanations come out in English', () => {
    content.setLang('en', { save: false });
    const text = explanationText({
      steps: [
        { type: 'changed', sol: 3, faultId: 's3_soil', from: 'defer', to: 'wash' },
        { type: 'outcome', original: { outcome: { won: true, sol: 15 }, health: 60 }, alt: { outcome: { won: false, sol: 12 }, health: 0 } },
      ],
    } as never);
    expect(text[0]).toBe('Sol 3: you chose "Wash the soil with water" instead of "Put it off".');
    expect(text[1]).toBe('Result: the mission would end on Sol 12.');
  });

  it('real missions: every Black Box explanation and report label is English', () => {
    content.setLang('en', { save: false });
    const turkish = /[çğıöşüÇĞİÖŞÜ]/;
    for (const [bot, seed] of [['careful', 3], ['cheapest', 8], ['random', 21]] as const) {
      const run = playGame(content.engine, BOTS[bot], seed, content.DEFAULT_CONFIG);
      const log: MissionLog = { seed, config: content.DEFAULT_CONFIG, actions: run.actions };
      const orig = replay(content.engine, seed, log.config, log.actions);
      for (let sol = 1; sol <= (orig.outcome?.sol ?? orig.sol); sol++)
        for (const r of solReportRows(orig, sol)) expect(sourceText(r.source), `${bot}/${seed} sol ${sol}`).not.toMatch(turkish);
      orig.decisions.forEach((_, i) => {
        for (const alt of alternatives(content.engine, log, i)) {
          if (alt.invalid) continue;
          const lines = explanationText(counterfactual(content.engine, log, i, alt.optionId).explanation);
          for (const line of lines) {
            expect(line, `${bot}/${seed} #${i} -> ${alt.optionId}`).not.toMatch(turkish);
            expect(line).not.toMatch(/\{\w+\}/);
          }
        }
      });
    }
  });
});
