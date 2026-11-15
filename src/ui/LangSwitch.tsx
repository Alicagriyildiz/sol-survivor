// "TR / EN" toggle. Works anywhere in the tree: it calls setLang(), which reassigns the live
// `tr` binding and notifies subscribers. App subscribes with useLang() and re-renders the whole
// tree (no remount, so game / 3D state is kept). This component also subscribes itself, so its
// own pressed state is right even if App does not.
import { useSyncExternalStore } from 'react';
import { LANGS, extra, getLang, setLang, subscribeLang, type LangId } from '../content';
import './lang.css';

/** Current language; re-renders the caller when it changes. */
export function useLang(): LangId {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}

export function LangSwitch({ big = false }: { big?: boolean }) {
  const lang = useLang();
  return (
    <div className={`lang-switch ${big ? 'big' : ''}`} role="group" aria-label={`${extra.switchLabel} / Language`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          title={l === 'tr' ? 'Türkçe' : 'English'}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
