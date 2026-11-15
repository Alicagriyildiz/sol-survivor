import type { ReactNode } from 'react';
import { tr } from '../content';
import { criticalResources, healthStatus, resourceStatus, type Status } from '../sim/selectors';
import { RESOURCES, type Deltas, type GameState, type ResourceId, type SolSnapshot } from '../sim/types';
import { colors, resourceIcon, statusColor, statusIcon } from './tokens';

export type Level = 'junior' | 'commander';

export const fmtNum = (n: number, digits = 1) =>
  (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString('tr-TR', { maximumFractionDigits: digits });
export const fmtHours = (h: number) => `${fmtNum(h)} ${tr.ui.hoursUnit}`;

export function Bar({
  label,
  icon,
  value,
  status,
  level,
  hint,
}: {
  label: string;
  icon: string;
  value: number;
  status: Status;
  level: Level;
  hint?: string;
}) {
  return (
    <div className={`bar bar-${status}`} title={hint}>
      <div className="bar-head">
        <span className="bar-label">
          <span aria-hidden>{icon}</span> {label}
        </span>
        <span className="bar-status" style={{ color: statusColor[status] }}>
          <span aria-hidden>{statusIcon[status]}</span> {level === 'commander' ? fmtNum(value, 0) : tr.status[status]}
        </span>
      </div>
      <div className="bar-track" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: statusColor[status] }} />
      </div>
    </div>
  );
}

export function TopBar({ s, level }: { s: GameState; level: Level }) {
  const rules = s.config.rules;
  return (
    <header className="topbar">
      <div className="sol-counter">
        <span className="sol-big">
          {tr.ui.sol} {s.sol}
        </span>
        <span className="dim">
          {' '}
          {tr.ui.of} {s.config.solCount}
        </span>
        <div className="hours">
          <span aria-hidden>{resourceIcon.hours}</span> {tr.ui.hoursLeft}: <strong>{fmtHours(s.hoursLeft)}</strong>
        </div>
        {level === 'commander' && (
          <div className="hours">
            <span aria-hidden>{resourceIcon.dose}</span> {tr.res.dose}: <strong>{fmtNum(s.dose, 0)}</strong>
          </div>
        )}
      </div>
      <div className="bars">
        {RESOURCES.map((r) => (
          <Bar
            key={r}
            label={tr.res[r]}
            icon={resourceIcon[r]}
            value={s.res[r]}
            status={resourceStatus(s.res[r], rules)}
            level={level}
            hint={tr.resDesc[r]}
          />
        ))}
        <Bar label={tr.res.health} icon={resourceIcon.health} value={s.health} status={healthStatus(s.health)} level={level} hint={tr.resDesc.health} />
      </div>
    </header>
  );
}

export function Warnings({ s }: { s: GameState }) {
  const crit = criticalResources(s);
  const reserveToday = s.trace.filter((e) => e.source.kind === 'reserve' && e.sol === s.sol);
  if (crit.length === 0 && reserveToday.length === 0) return null;
  return (
    <div className="warnings" role="status">
      {crit.map((r) => (
        <div key={r} className="warning danger">
          <span aria-hidden>{statusIcon.critical}</span> {tr.critical[r]}
        </div>
      ))}
      {reserveToday.map((e) => (
        <div key={e.key} className="warning warn">
          <span aria-hidden>🔋</span> {tr.res[(e.source as { res: ResourceId }).res]}: {tr.ui.reserveUsed}
        </div>
      ))}
    </div>
  );
}

const KEYS = ['power', 'life', 'shield', 'health', 'dose'] as const;

/** Effect preview: arrows for juniors, numbers for commanders. Never color alone. */
export function DeltaList({ d, level, empty }: { d: Deltas | null; level: Level; empty?: ReactNode }) {
  if (!d) return null;
  const parts: ReactNode[] = [];
  for (const k of KEYS) {
    const v = d[k];
    if (!v) continue;
    if (k === 'dose' && level === 'junior' && v < 1) continue;
    const good = k === 'dose' ? v < 0 : v > 0;
    const mag = Math.abs(v);
    const arrows = (v > 0 ? '▲' : '▼').repeat(mag >= 8 ? 3 : mag >= 3 ? 2 : 1);
    parts.push(
      <span key={k} className={`delta ${good ? 'up' : 'down'}`}>
        <span aria-hidden>{resourceIcon[k]}</span> {k === 'dose' ? tr.res.dose : tr.res[k]}{' '}
        {level === 'commander' ? `${v > 0 ? '+' : '−'}${fmtNum(mag)}` : arrows}
      </span>,
    );
  }
  for (const [item, n] of Object.entries(d.items ?? {})) {
    parts.push(
      <span key={item} className="delta down">
        {tr.items[item]} {n > 0 ? `+${n}` : `−${-n}`}
      </span>,
    );
  }
  if (parts.length === 0) return <>{empty ?? null}</>;
  return <span className="deltas">{parts}</span>;
}

/** Tiny dependency-free SVG line chart of one metric across sols for one or two runs. */
export function Chart({
  series,
  metric,
  height = 140,
}: {
  series: { name: string; color: string; data: SolSnapshot[]; dashed?: boolean }[];
  metric: 'health' | ResourceId;
  height?: number;
}) {
  const w = 320;
  const h = height;
  const pad = 22;
  const maxSol = 15;
  const x = (sol: number) => pad + ((w - pad - 6) * sol) / maxSol;
  const y = (v: number) => h - pad - ((h - pad - 6) * v) / 100;
  const val = (p: SolSnapshot) => (metric === 'health' ? p.health : p.res[metric]);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={metric === 'health' ? tr.res.health : tr.res[metric]}>
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={pad} x2={w - 6} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={t === 25 ? 1.5 : 0.6} strokeDasharray={t === 25 ? '4 3' : undefined} />
          <text x={2} y={y(t) + 3} fontSize={8} fill={colors.textDim}>
            {t}
          </text>
        </g>
      ))}
      {[0, 5, 10, 15].map((sol) => (
        <text key={sol} x={x(sol) - 3} y={h - 6} fontSize={8} fill={colors.textDim}>
          {sol}
        </text>
      ))}
      {series.map((s) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={s.color}
          strokeWidth={2.2}
          strokeDasharray={s.dashed ? '5 4' : undefined}
          points={s.data.map((p) => `${x(p.sol)},${y(val(p))}`).join(' ')}
        />
      ))}
    </svg>
  );
}
