import { useState } from 'react';
import type { MissionLog } from '../blackbox';
import { DEFAULT_CONFIG, engine } from '../content';
import type { Action, GameState } from '../sim/types';
import { BlackBox } from './BlackBox';
import type { Level } from './parts';
import { Play } from './Play';
import { Briefing, End, SolReport, Start } from './Screens';

type Screen = 'start' | 'briefing' | 'play' | 'report' | 'end' | 'blackbox';

interface Session {
  seed: number;
  level: Level;
  state: GameState;
  actions: Action[];
}

export function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [session, setSession] = useState<Session | null>(null);
  const [reportSol, setReportSol] = useState(1);

  const start = (seed: number, level: Level) => {
    setSession({ seed, level, state: engine.init(seed, DEFAULT_CONFIG), actions: [] });
    setScreen('briefing');
  };

  const act = (a: Action) => {
    if (!session) return;
    const next = engine.step(session.state, a);
    setSession({ ...session, state: next, actions: [...session.actions, a] });
    if (a.type === 'endSol') {
      setReportSol(session.state.sol);
      setScreen('report');
    } else if (next.outcome) {
      setScreen('end');
    }
  };

  if (screen === 'start' || !session) return <Start onStart={start} />;
  const s = session.state;
  const log: MissionLog = { seed: session.seed, config: DEFAULT_CONFIG, actions: session.actions };

  switch (screen) {
    case 'briefing':
      return <Briefing s={s} onGo={() => setScreen('play')} />;
    case 'play':
      return <Play s={s} level={session.level} act={act} />;
    case 'report':
      return <SolReport s={s} sol={reportSol} level={session.level} onNext={() => setScreen(s.outcome ? 'end' : 'briefing')} />;
    case 'end':
      return (
        <End
          s={s}
          level={session.level}
          onBlackBox={() => setScreen('blackbox')}
          onAgain={() => setScreen('start')}
          onSame={() => start(session.seed, session.level)}
        />
      );
    case 'blackbox':
      return <BlackBox log={log} final={s} level={session.level} onBack={() => setScreen('end')} />;
  }
}
