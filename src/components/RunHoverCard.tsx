import type { Run, Dungeon, RosterMember } from '../lib/types';
import { classColor } from '../lib/classColors';

interface RunHoverCardProps {
  run: Run;
  dungeon: Dungeon;
  roster: RosterMember[];
  extraCount?: number; // additional runs in the same cell beyond this one
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const ROLE_LABEL: Record<string, string> = {
  tank: 'TANK',
  healer: 'HEAL',
  dps: 'DPS',
};

export function RunHoverCard({ run, dungeon, roster, extraCount = 0 }: RunHoverCardProps) {
  const rosterMembers = run.rosterMemberIds
    .map((id) => roster.find((m) => m.id === id))
    .filter((m): m is RosterMember => m != null);

  const isTimed = run.result === 'timed';
  const parSec = dungeon.parTimeSeconds;
  let overUnderLabel: string | null = null;
  if (parSec) {
    const delta = run.durationSeconds - parSec;
    const pct = (Math.abs(delta) / parSec) * 100;
    const sign = delta < 0 ? '−' : '+';
    overUnderLabel = `${sign}${formatDuration(Math.abs(delta))} (${pct.toFixed(1)}%${
      delta < 0 ? ' under' : ' over'
    })`;
  }

  return (
    <div
      className="rounded-lg border border-gray-700 bg-gray-900 shadow-2xl text-gray-100"
      style={{ width: 300 }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={[
              'inline-flex items-center justify-center rounded px-2 py-0.5 text-sm font-bold',
              isTimed ? 'text-white' : 'text-red-300',
            ].join(' ')}
            style={{ backgroundColor: isTimed ? '#0ea5e9' : '#3f1d1d' }}
          >
            +{run.level}
          </span>
          <span className="text-sm font-medium truncate">{dungeon.name}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          W{run.resetWeek}
        </span>
      </div>

      {/* Result + time */}
      <div className="px-3 py-2 border-b border-gray-800 text-xs">
        <div className="flex items-center justify-between">
          <span
            className={[
              'font-semibold uppercase tracking-wide text-[10px]',
              isTimed ? 'text-emerald-400' : 'text-red-400',
            ].join(' ')}
          >
            {isTimed ? 'Timed' : 'Depleted'}
          </span>
          <span className="text-gray-400">{formatRelative(run.completedAt)}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {formatDuration(run.durationSeconds)}
          </span>
          {overUnderLabel && (
            <span
              className={[
                'text-xs tabular-nums',
                isTimed ? 'text-emerald-400' : 'text-red-400',
              ].join(' ')}
            >
              {overUnderLabel}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-500 tabular-nums">
            {run.score.toFixed(1)} score
          </span>
        </div>
      </div>

      {/* Roster */}
      <div className="px-3 py-2">
        <div className="flex flex-col gap-1">
          {rosterMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, backgroundColor: classColor(m.class) }}
              />
              <span className="text-gray-100 flex-1 truncate">{m.name}</span>
              <span className="text-[10px] text-gray-500 tracking-wider">
                {ROLE_LABEL[m.primaryRole]}
              </span>
            </div>
          ))}
          {run.pugs.map((p, i) => (
            <div key={`pug-${i}`} className="flex items-center gap-2 text-xs">
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, backgroundColor: classColor(p.class) }}
              />
              <span className="text-gray-300 flex-1 truncate">
                {p.name}
                <span className="text-gray-600"> · {p.realm}</span>
              </span>
              <span className="text-[10px] text-gray-600 tracking-wider">PUG</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
        {extraCount > 0 ? (
          <span>+{extraCount} more run{extraCount > 1 ? 's' : ''} this week</span>
        ) : (
          <span />
        )}
        <span>click to open on raider.io ↗</span>
      </div>
    </div>
  );
}
