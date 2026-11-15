// Language switch. `tr` is a live ES module binding: after setLang('en') every module that
// imported `tr` (from here or from src/content) reads the English text on its next access.
// Text captured into a module-level constant at import time would NOT follow, so player text
// must always be read inside functions / components.
//
// Initial language (browser only): ?lang=en|tr in the URL, else the saved choice
// (localStorage 'sol-survivor.lang'), else navigator.language ('tr…' -> tr, otherwise en).
// Outside a browser (tests, scripts) the default stays Turkish.
import { en } from './en';
import { numSuffix as trNumSuffix, tr as trText, type Lang } from './tr';

export type LangId = 'tr' | 'en';
export const LANGS: readonly LangId[] = ['tr', 'en'];
export const LANG_KEY = 'sol-survivor.lang';

const PACKS: Record<LangId, Lang> = { tr: trText, en };

/** A few strings that only the language switch / end screen need (tr.ts is shared, kept stable). */
const EXTRA = {
  tr: {
    switchLabel: 'Dil',
    blackBoxLead: 'Bir kararını değiştir, ne olurdu gör.',
  },
  en: {
    switchLabel: 'Language',
    blackBoxLead: 'Change one decision and see what would have happened.',
  },
} satisfies Record<LangId, Record<string, string>>;

const isLang = (v: unknown): v is LangId => v === 'tr' || v === 'en';

function detect(): LangId {
  if (typeof window === 'undefined') return 'tr';
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (isLang(q)) return q;
  } catch {
    /* ignore */
  }
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  const nav = typeof navigator !== 'undefined' ? (navigator.language ?? '') : '';
  return nav.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let current: LangId = detect();

/** All player-facing text in the current language (live binding). */
export let tr: Lang = PACKS[current];
/** Extra strings in the current language (live binding). */
export let extra: (typeof EXTRA)[LangId] = EXTRA[current];

const listeners = new Set<() => void>();

function applyDocLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}
applyDocLang();

export function getLang(): LangId {
  return current;
}

/** Switch language, remember the choice, and notify subscribers (App re-renders). */
export function setLang(l: LangId, opts: { save?: boolean } = {}): void {
  if (!isLang(l)) return;
  const changed = l !== current;
  current = l;
  tr = PACKS[l];
  extra = EXTRA[l];
  applyDocLang();
  if (opts.save !== false && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* storage blocked */
    }
  }
  if (changed) for (const fn of listeners) fn();
}

/** Subscribe to language changes; returns the unsubscribe function (useSyncExternalStore shape). */
export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Number-suffix for Turkish templates ({loc}/{abl}); English templates do not use it. */
export function numSuffix(n: number, kind: 'loc' | 'abl'): string {
  return current === 'tr' ? trNumSuffix(n, kind) : '';
}

/** BCP 47 locale for number formatting in the current language. */
export function numLocale(): string {
  return current === 'tr' ? 'tr-TR' : 'en-US';
}

export { fmt, type Lang, type FaultText, type OptionText, type SolText } from './tr';
export { en } from './en';
export { trText };
