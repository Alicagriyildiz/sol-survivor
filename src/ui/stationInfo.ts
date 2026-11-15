// What a station shows from the outside (card in the simple view, label in the 3D scene).
// Pure: derived from the state through the same selectors as the panels.
import { engine } from '../content';
import { routineView, stationViews } from '../sim/selectors';
import type { GameState } from '../sim/types';

export interface StationInfo {
  id: string;
  /** Hours to walk there from where the astronaut is now. */
  walk: number;
  eva: boolean;
  locked: boolean;
  here: boolean;
  /** Open faults at this station. */
  faults: number;
  /** Maintenance job here (null: none). `ok`: can be done now; `done`: already done today. */
  routine: { hours: number; ok: boolean; done: boolean } | null;
}

export function stationInfo(s: GameState, sol1: boolean): StationInfo[] {
  const views = stationViews(engine, s);
  const hereWalk = views.find((x) => x.here)?.walk ?? 0;
  return views.map((v) => {
    const rid = v.routines[0];
    let routine: StationInfo['routine'] = null;
    if (rid) {
      const r = routineView(engine, s, rid);
      // Sol 1 tutorial: maintenance only after both faults are fixed (UI rule, DESIGN §6b).
      const tutorialLock = sol1 && s.faults.length > 0;
      routine = { hours: r.cost.work, ok: !r.invalid && !tutorialLock, done: r.done };
    }
    return {
      id: v.id,
      walk: v.here ? 0 : v.walk + hereWalk,
      eva: v.eva,
      locked: v.locked,
      here: v.here,
      faults: v.faults.length,
      routine,
    };
  });
}
