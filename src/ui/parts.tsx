import type { ReactNode } from 'react';
import { engine, fmt, tr } from '../content';
import { criticalResources, healthStatus, previewParts, resourceStatus, type Status } from '../sim/selectors';
import { RESOURCES, type Action, type Deltas, type GameState, type ResourceId, type SolSnapshot } from '../sim/types';
import { colors, resourceIcon, statusColor, statusIcon } from './tokens';

export type Level = 'junior' | 'commander';

export const fmtNum = (n: number, digits = 1) =>
  (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString('tr-TR', { maximumFractionDigits: digits });
export const fmtHours = (h: number) => `${fmtNum(h)} ${tr.ui.hoursUnit}`;

/** Arrows for one value change: ▲ / ▼, more arrows for bigger changes. */
const arrows = (v: number) => (v > 0 ? '▲' : '▼').repeat(Math.abs(v) >= 8 ? 3 : Math.abs(v) >= 3 ? 2 : 1);

export function Bar({
  label,
  icon,
  value,
  status,
  level,
  hint,
  change,
}: {
  label: string;
  icon: string;
  value: number;
  status: Status;
  level: Level;
  hint?: string;
  /** Change caused by the last action (shown next to the label until the next action). */
  change?: number;
}) {
  return (
    <div className={`bar bar-${status}`} title={hint}>
      <div className="bar-head">
        <span className="bar-label">
          <span aria-hidden>{icon}</span> {label}
          {change !== undefined && Math.abs(change) >= 0.5 && (
            <span className={`bar-change ${change > 0 ? 'up' : 'down'}`}>
              {' '}
              {level === 'commander' ? `${change > 0 ? '+' : '−'}${fmtNum(Math.abs(change))}` : arrows(change)}
            </span>
          )}
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

/** Ten one-hour cells: left hours bright, used hours dim. Text says the number too. */
export function HoursStrip({ left, total }: { left: number; total: number }) {
  return (
    <div className="hours-strip" role="meter" aria-valuenow={left} aria-valuemin={0} aria-valuemax={total} aria-label={tr.ui.hoursLeft}>
      {Array.from({ length: total }, (_, i) => {
        const fill = Math.max(0, Math.min(1, left - i));
        return (
          <span key={i} className="hour-cell">
            <span style={{ width: `${fill * 100}%` }} />
          </span>
        );
      })}
    </div>
  );
}

export function TopBar({
  s,
  level,
  flash = null,
  coach = null,
}: {
  s: GameState;
  level: Level;
  /** Last action, to show what it changed next to each bar. */
  flash?: { action: Action; before: GameState } | null;
  /** Tutorial highlight. */
  coach?: 'bars' | 'hours' | null;
}) {
  const rules = s.config.rules;
  const change = flash ? (previewParts(engine, flash.before, flash.action).preview ?? {}) : {};
  return (
    <header className="topbar">
      <div className={`sol-counter ${coach === 'hours' ? 'coach-target' : ''}`}>
        <span className="sol-big">
          {tr.ui.sol} {s.sol}
        </span>
        <span className="dim">
          {' '}
          {tr.ui.of} {s.config.solCount}
        </span>
        <div className="hours">
          <span aria-hidden>{resourceIcon.hours}</span> {tr.ui.hoursLeft}: <strong>{fmt(tr.ui.hoursOf, { left: fmtNum(s.hoursLeft) })}</strong>
        </div>
        <HoursStrip left={s.hoursLeft} total={s.config.hoursPerSol} />
        {level === 'commander' && (
          <div className="hours">
            <span aria-hidden>{resourceIcon.dose}</span> {tr.res.dose}: <strong>{fmtNum(s.dose, 0)}</strong>
          </div>
        )}
      </div>
      <div className={`bars ${coach === 'bars' ? 'coach-target' : ''}`}>
        {RESOURCES.map((r) => (
          <Bar
            key={r}
            label={tr.res[r]}
            icon={resourceIcon[r]}
            value={s.res[r]}
            status={resourceStatus(s.res[r], rules)}
            level={level}
            hint={tr.resDesc[r]}
            change={change[r]}
          />
        ))}
        <Bar
          label={tr.res.health}
          icon={resourceIcon.health}
          value={s.health}
          status={healthStatus(s.health)}
          level={level}
          hint={tr.resDesc.health}
          change={change.health}
        />
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
    parts.push(
      <span key={k} className={`delta ${good ? 'up' : 'down'}`}>
        <span aria-hidden>{resourceIcon[k]}</span> {k === 'dose' ? tr.res.dose : tr.res[k]}{' '}
        {level === 'commander' ? `${v > 0 ? '+' : '−'}${fmtNum(mag)}` : arrows(v)}
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
  marker,
}: {
  series: { name: string; color: string; data: SolSnapshot[]; dashed?: boolean }[];
  metric: 'health' | ResourceId;
  height?: number;
  /** Vertical marker (e.g. "autopilot from here"). */
  marker?: { sol: number; label: string; color: string };
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
      {marker && (
        <g>
          <line x1={x(marker.sol - 1)} x2={x(marker.sol - 1)} y1={4} y2={h - pad} stroke={marker.color} strokeWidth={1.2} strokeDasharray="2 3" />
          <text x={Math.min(x(marker.sol - 1) + 3, w - 70)} y={12} fontSize={8} fill={marker.color}>
            {marker.label}
          </text>
        </g>
      )}
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
