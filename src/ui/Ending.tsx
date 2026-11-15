// End-of-mission scene, shown once between the last sol and the End screen. 3D film (lazy
// chunk) in the 3D view; a simple card with an SVG picture in the simple view, with reduced
// motion, without WebGL or if the 3D film fails. Always skippable and never blocks the End
// screen: a hard timer moves on even if the film never finishes.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { tr } from '../content';
import type { GameState } from '../sim/types';
import { colors } from './tokens';
import { markSceneBroken, SceneBoundary, sceneBroken, webglAvailable, type View } from './view';

export type EndKind = 'win' | 'power' | 'life' | 'shield';

const Film = lazy(() => import('../scene/Ending'));

/** Which film: a win, or the system whose failure ended the mission. */
export function endKind(s: GameState): EndKind {
  // Dev only: ?ending=win|power|life|shield previews one film on any finished mission.
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(window.location.search).get('ending');
    if (q === 'win' || q === 'power' || q === 'life' || q === 'shield') return q;
  }
  const o = s.outcome;
  if (!o || o.won) return 'win';
  return o.cause ?? 'shield';
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Hard cap (ms) before the End screen opens on its own. */
const MAX_MS = { film: 14000, card: 15000 };

export function Ending({ s, view, onDone }: { s: GameState; view: View; onDone: () => void }) {
  const kind = endKind(s);
  const [still] = useState(reducedMotion);
  const [use3d, setUse3d] = useState(() => view === '3d' && !still && webglAvailable() && !sceneBroken());
  const done = useRef(false);
  const doneFn = useRef(onDone);
  doneFn.current = onDone;
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    doneFn.current();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    // Reduced motion: a still card the child reads at their own pace (Continue / Enter).
    const id = still && !use3d ? 0 : window.setTimeout(finish, use3d ? MAX_MS.film : MAX_MS.card);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (id) window.clearTimeout(id);
    };
  }, [finish, use3d, still]);

  const card = <EndCard kind={kind} onDone={finish} still={still} />;
  return (
    <div className="end-stage" aria-label={tr.ending.label}>
      {use3d ? (
        <SceneBoundary
          fallback={card}
          onError={() => {
            markSceneBroken();
            setUse3d(false);
          }}
        >
          <Suspense fallback={<div className="end-film end-loading" aria-hidden />}>
            <Film s={s} kind={kind} onEnd={finish} />
          </Suspense>
          <button className="btn end-skip" onClick={finish} autoFocus>
            {tr.ending.skip} ⏭ <span className="dim small">Esc</span>
          </button>
        </SceneBoundary>
      ) : (
        card
      )}
    </div>
  );
}

/** Card version: the same story in a few lines and a small animated picture. */
function EndCard({ kind, onDone, still }: { kind: EndKind; onDone: () => void; still: boolean }) {
  const e = tr.ending;
  const won = kind === 'win';
  const lines = won ? [e.win1, e.win2, e.win3] : [kind === 'power' ? e.power1 : kind === 'life' ? e.life1 : e.shield1, e.rescue1, e.rescue2];
  return (
    <div className={`screen end-card end-${kind} ${still ? 'still' : ''}`}>
      <div className="card">
        <EndPicture kind={kind} />
        <h1>{won ? `🎉 ${e.winTitle}` : `🚀 ${e.lostTitle}`}</h1>
        {kind === 'shield' && <p className="end-card-warn">☢ {e.hudWarn}</p>}
        {kind === 'life' && <p className="end-card-warn">⚠ {e.alarm}</p>}
        {lines.map((l, i) => (
          <p key={i} className="lead end-line" style={{ animationDelay: `${0.4 + i * 1.6}s` }}>
            {l}
          </p>
        ))}
        <button className="btn primary big" onClick={onDone} autoFocus>
          {e.continue} →
        </button>
      </div>
    </div>
  );
}

/** Simple SVG: base dome, pad, and the craft rising (lander for a win, capsule for a loss). */
function EndPicture({ kind }: { kind: EndKind }) {
  const won = kind === 'win';
  const dark = kind === 'power';
  const win = dark ? colors.metal : colors.warn;
  return (
    <svg className="end-pic" viewBox="0 0 240 140" role="img" aria-label={won ? tr.ending.win2 : tr.ending.rescue1}>
      <rect width="240" height="140" fill={dark ? colors.night : kind === 'shield' ? colors.skyEventTop : colors.skyTop} />
      <rect y="104" width="240" height="36" fill={colors.marsGround} />
      <ellipse cx="200" cy="40" rx="10" ry="10" fill={colors.text} opacity={dark ? 0.15 : 0.5} />
      {/* base */}
      <path d="M30 106 A34 26 0 0 1 98 106 Z" fill={dark ? colors.hullDark : colors.hull} className={kind === 'life' ? 'end-pulse' : ''} />
      {[44, 58, 72, 86].map((x) => (
        <rect key={x} x={x - 4} y={93} width={7} height={5} rx={1} fill={win} className={dark ? 'end-off' : ''} />
      ))}
      {kind === 'life' && <circle cx="64" cy="78" r="5" fill={colors.danger} className="end-blink" />}
      {/* pad */}
      <rect x="140" y="104" width="70" height="4" rx="2" fill={colors.hullDark} />
      {won &&
        [146, 160, 175, 190, 204].map((x, i) => <circle key={x} cx={x} cy={104} r={2} fill={i % 2 ? colors.accent : colors.warn} className="end-blink" style={{ animationDelay: `${i * 0.15}s` }} />)}
      <g className={won ? 'end-craft end-land' : 'end-craft end-lift'}>
        {won ? (
          <g transform="translate(175 104)">
            <path d="M-14 -8 L-20 0 M14 -8 L20 0" stroke={colors.metal} strokeWidth="2" />
            <rect x="-14" y="-24" width="28" height="16" rx="3" fill={colors.hull} />
            <rect x="-15" y="-14" width="30" height="3" fill={colors.accent} />
            <path d="M-10 -24 L-5 -32 L5 -32 L10 -24 Z" fill={colors.hullDark} />
            <path d="M-5 -8 L0 6 L5 -8 Z" fill={colors.accent} opacity="0.7" className="end-flame" />
          </g>
        ) : (
          <g transform="translate(175 104)">
            <path d="M-8 -4 L-12 0 M8 -4 L12 0" stroke={colors.metal} strokeWidth="2" />
            <path d="M-11 -4 L-5 -26 L5 -26 L11 -4 Z" fill={colors.suit} />
            <rect x="-10" y="-11" width="20" height="3" fill={colors.accent} />
            <circle cx="0" cy="-27" r="5" fill={colors.hull} />
            <path d="M-4 -4 L0 8 L4 -4 Z" fill={colors.accent} opacity="0.7" className="end-flame" />
          </g>
        )}
      </g>
      <ellipse cx="175" cy="105" rx="26" ry="5" fill={colors.marsDust} className="end-dust" />
    </svg>
  );
}
