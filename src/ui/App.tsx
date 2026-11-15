import { useEffect, useRef, useState } from 'react';
import { carefulBot } from '../bots/bots';
import { createRng } from '../sim/rng';
import type { MissionLog } from '../blackbox';
import { DEFAULT_CONFIG, engine } from '../content';
import type { Action, GameState } from '../sim/types';
import { BlackBox } from './BlackBox';
import type { Level } from './parts';
import { Play, type LastAction, type TutorialStep } from './Play';
import { DataScreen } from './DataViews';
import { useLang } from './LangSwitch';
import { Briefing, End, SolReport, Start } from './Screens';
import { initialView, saveView, type View } from './view';

type Screen = 'start' | 'briefing' | 'play' | 'report' | 'end' | 'blackbox' | 'data';

interface Session {
  seed: number;
  level: Level;
  state: GameState;
  actions: Action[];
  last: LastAction | null;
  tutorial: TutorialStep | null;
  tutorialOn: boolean;
}

export function App() {
  // Re-render the whole tree when the language changes (LangSwitch -> setLang). No remount.
  useLang();
  const [screen, setScreen] = useState<Screen>('start');
  const [session, setSession] = useState<Session | null>(null);
  const [reportSol, setReportSol] = useState(1);
  const [dataFrom, setDataFrom] = useState<Screen>('start');
  const [view, setViewState] = useState<View>(initialView);
  const setView = (v: View) => {
    setViewState(v);
    saveView(v);
  };
  /** The state the next action must start from: a stale (double) click is ignored. */
  const current = useRef<GameState | null>(null);
  const openData = (from: Screen) => {
    setDataFrom(from);
    setScreen('data');
  };

  const start = (seed: number, level: Level, tutorialOn: boolean, jumpTo = 0) => {
    let state = engine.init(seed, DEFAULT_CONFIG);
    const actions: Action[] = [];
    // Dev only: let the careful bot play up to sol `jumpTo` (screenshots, testing).
    const rng = createRng(seed);
    while (jumpTo > state.sol && !state.outcome) {
      const a = carefulBot(state, engine, rng);
      actions.push(a);
      state = engine.step(state, a);
    }
    current.current = state;
    setSession({
      seed,
      level,
      state,
      actions,
      last: null,
      tutorial: tutorialOn ? 'bars' : null,
      tutorialOn,
    });
    setScreen('briefing');
  };

  const act = (a: Action) => {
    if (!session || current.current !== session.state) return;
    const next = engine.step(session.state, a);
    current.current = next;
    setSession({ ...session, state: next, actions: [...session.actions, a], last: a.type === 'endSol' ? null : { action: a, before: session.state, after: next } });
    if (a.type === 'endSol') {
      setReportSol(session.state.sol);
      setScreen('report');
    } else if (next.outcome) {
      setScreen('end');
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const q = new URLSearchParams(window.location.search);
    const sol = Number(q.get('jump'));
    if (sol > 0) {
      start(Number(q.get('seed')) || 1, 'junior', sol === 1, sol);
      setScreen('play');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (screen === 'data') return <DataScreen onBack={() => setScreen(dataFrom)} />;
  if (screen === 'start' || !session) return <Start onStart={start} onData={() => openData('start')} view={view} setView={setView} />;
  const s = session.state;
  const log: MissionLog = { seed: session.seed, config: DEFAULT_CONFIG, actions: session.actions };

  switch (screen) {
    case 'briefing':
      return <Briefing s={s} onGo={() => setScreen('play')} />;
    case 'play':
      return (
        <Play
          s={s}
          level={session.level}
          act={act}
          last={session.last}
          clearLast={() => setSession({ ...session, last: null })}
          tutorial={session.tutorial}
          setTutorial={(t) => setSession((cur) => (cur ? { ...cur, tutorial: t } : cur))}
          view={view}
          setView={setView}
        />
      );
    case 'report':
      return <SolReport s={s} sol={reportSol} level={session.level} onNext={() => setScreen(s.outcome ? 'end' : 'briefing')} />;
    case 'end':
      return (
        <End
          s={s}
          level={session.level}
          onBlackBox={() => setScreen('blackbox')}
          onAgain={() => setScreen('start')}
          onSame={() => start(session.seed, session.level, session.tutorialOn)}
          onData={() => openData('end')}
        />
      );
    case 'blackbox':
      return <BlackBox log={log} final={s} level={session.level} onBack={() => setScreen('end')} />;
  }
}
