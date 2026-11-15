// Turns an Explanation into short, child-friendly sentences using the language file.
import { fmt, numSuffix, tr } from '../content/lang/tr';
import type { Source } from '../sim/types';
import type { Diff, Explanation, ExplainStep } from './blackbox';

export function optionLabel(faultId: string, optionId: string): string {
  return tr.faults[faultId]?.options[optionId]?.label ?? optionId;
}

export function faultTitle(faultId: string): string {
  return tr.faults[faultId]?.title ?? faultId;
}

const nameOf = (k: keyof Diff): string => (k === 'dose' ? tr.res.dose : tr.res[k]);

export function diffText(d: Diff): string {
  return (Object.keys(d) as (keyof Diff)[])
    .map((k) => {
      const v = d[k]!;
      return fmt(tr.blackbox.diffUnit, { res: nameOf(k), n: Math.round(Math.abs(v)), dir: v > 0 ? tr.blackbox.more : tr.blackbox.less });
    })
    .join(', ');
}

export function sourceText(src: Source): string {
  switch (src.kind) {
    case 'decision':
      return `${faultTitle(src.key.split(':')[1] ?? '')} (${optionLabel(src.key.split(':')[1] ?? '', src.optionId)})`;
    case 'pending':
      return tr.effects[src.label] ?? src.label;
    case 'modifier':
      return tr.effects[src.label] ?? src.label;
    case 'event':
      return tr.events[src.id] ?? tr.effects.morning!;
    case 'routine':
      return tr.routines[src.id]?.label ?? src.id;
    case 'reserve':
      return `${tr.ui.reserve} (${tr.res[src.res]})`;
    case 'critical':
      return tr.critical[src.res];
    case 'night':
      return tr.effects.night!;
    case 'walk':
      return '';
  }
}

export function stepText(step: ExplainStep): string {
  const b = tr.blackbox;
  switch (step.type) {
    case 'changed':
      return fmt(b.exChanged, { sol: step.sol, old: optionLabel(step.faultId, step.from), new: optionLabel(step.faultId, step.to) });
    case 'immediate':
      return fmt(b.exImmediate, { diffs: diffText(step.diff) });
    case 'linked':
      return fmt(b.exLinked, { sol: step.sol, what: sourceText(step.source), diffs: diffText(step.diff) });
    case 'critical':
      return fmt(b.exCritical, {
        res: tr.res[step.res],
        more: step.healthDiff > 0 ? b.shorter : b.longer,
        amount: Math.round(Math.abs(step.healthDiff)),
        dir: step.healthDiff > 0 ? b.less : b.more,
      });
    case 'outcome': {
      const o = step.original;
      const a = step.alt;
      const ha = Math.round(o.health);
      const hb = Math.round(a.health);
      if (!o.outcome.won && a.outcome.won) return fmt(b.exOutcomeSave, { a: ha, b: hb });
      if (o.outcome.won && !a.outcome.won) return fmt(b.exOutcomeLose, { sol: a.outcome.sol, loc: numSuffix(a.outcome.sol, 'loc') });
      if (o.outcome.won) return fmt(b.exOutcomeSameWin, { a: ha, b: hb });
      if (o.outcome.sol === a.outcome.sol) return fmt(b.exOutcomeSameLoseSameSol, { sol: a.outcome.sol, loc: numSuffix(a.outcome.sol, 'loc') });
      return fmt(b.exOutcomeSameLose, { solA: o.outcome.sol, solB: a.outcome.sol });
    }
    case 'noDiff':
      return b.exNoDiff;
  }
}

export function explanationText(e: Explanation): string[] {
  return e.steps.map(stepText);
}
