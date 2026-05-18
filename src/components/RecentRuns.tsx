import type { Run, Dungeon, RosterMember } from '../lib/types';
import type { FilterState } from '../lib/scoring';
import { runMatchesFilter } from '../lib/scoring';
import { classColor } from '../lib/classColors';

interface RecentRunsProps {
  runs: Run[];
  dungeons: Dungeon[];
  roster: RosterMember[];
  filter: FilterState;
}

const LIMIT = 5;

function cellTier(level: number): { bg: string; fg: string } {
  if (level >= 20) return { bg: '#ec4899', fg: '#ffffff' };
  if (level >= 19) return { bg: '#d946ef', fg: '#ffffff' };
  if (level >= 18) return { bg: '#a855f7', fg: '#ffffff' };
  if (level >= 17) return { bg: '#8b5cf6', fg: '#ffffff' };
  if (level >= 16) return { bg: '#6366f1', fg: '#ffffff' };
  if (level >= 15) return { bg: '#4f46e5', fg: '#ffffff' };
  if (level >= 14) return { bg: '#3b82f6', fg: '#ffffff' };
  if (level >= 13) return { bg: '#0ea5e9', fg: '#ffffff' };
  if (level >= 12) return { bg: '#14b8a6', fg: '#ffffff' };
  if (level >= 11) return { bg: '#22c55e', fg: '#ffffff' };
  if (level >= 10) return { bg: '#84cc16', fg: '#1f2937' };
  return { bg: '#475569', fg: '#ffffff' };
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
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

export function RecentRuns({ runs, dungeons, roster, filter }: RecentRunsProps) {
  const dungeonById = new Map(dungeons.map(d => [d.id, d]));
  const memberById = new Map(roster.map(m => [m.id, m]));

  const filtered = runs.filter(r => runMatchesFilter(r, filter));
  const recent = [...filtered]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, LIMIT);

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-medium text-gray-100">Recent runs</span>
        <span className="text-xs text-gray-500">last {LIMIT} matching filter</span>
      </div>

      {recent.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-4">No runs match the current filter.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {recent.map(run => {
            const dungeon = dungeonById.get(run.dungeonId);
            const isTimed = run.result === 'timed';
            const tier = isTimed ? cellTier(run.level) : { bg: '#3f1d1d', fg: '#fca5a5' };
            const par = dungeon?.parTimeSeconds;
            const overUnder = par
              ? `${run.durationSeconds < par ? '−' : '+'}${formatDuration(Math.abs(run.durationSeconds - par))}`
              : null;

            return (
              <a
                key={run.id}
                href={`https://raider.io/mythic-plus-runs/season-mn-1/${run.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 hover:border-gray-600 transition-colors"
              >
                {/* Level badge */}
                <div
                  className="flex-shrink-0 rounded font-bold text-sm flex items-center justify-center"
                  style={{ backgroundColor: tier.bg, color: tier.fg, width: 44, height: 36 }}
                >
                  +{run.level}
                </div>

                {/* Middle: dungeon + result + time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-100 truncate">
                      {dungeon?.name ?? run.dungeonId}
                    </span>
                    <span
                      className={[
                        'text-[10px] font-semibold uppercase tracking-wider flex-shrink-0',
                        isTimed ? 'text-emerald-400' : 'text-red-400',
                      ].join(' ')}
                    >
                      {isTimed ? 'Timed' : 'Depleted'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="tabular-nums">{formatDuration(run.durationSeconds)}</span>
                    {overUnder && (
                      <span className={`tabular-nums ${isTimed ? 'text-emerald-500' : 'text-red-500'}`}>
                        {overUnder}
                      </span>
                    )}
                    <span>·</span>
                    <span>{formatRelative(run.completedAt)}</span>
                  </div>
                </div>

                {/* Right: roster dots + pug count */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <div className="flex -space-x-1">
                    {run.rosterMemberIds.map(id => {
                      const m = memberById.get(id);
                      if (!m) return null;
                      return (
                        <span
                          key={id}
                          className="rounded-full border border-gray-900"
                          style={{ width: 14, height: 14, backgroundColor: classColor(m.class) }}
                          title={m.name}
                        />
                      );
                    })}
                  </div>
                  {run.pugs.length > 0 && (
                    <span className="text-[10px] text-gray-500 tabular-nums">
                      +{run.pugs.length} pug{run.pugs.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
