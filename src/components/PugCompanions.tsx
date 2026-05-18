import { useMemo, useState } from 'react';
import type { Run } from '../lib/types';
import type { FilterState } from '../lib/scoring';
import { runMatchesFilter } from '../lib/scoring';
import { classColor } from '../lib/classColors';

interface PugCompanionsProps {
  runs: Run[];
  filter: FilterState;
}

type SortKey = 'keys' | 'highest' | 'recent';
type ViewKey = 'specs' | 'players';

interface AggregateEntry {
  key: string;
  className: string;         // for color
  primaryLabel: string;
  secondaryLabel?: string;
  keyCount: number;
  highestLevel: number;
  lastSeenWeek: number;
}

const TOP_N_PLAYERS = 10;

// Specs: human-friendly names. Map class slug + spec slug -> "Frost Mage".
function titleCase(s: string): string {
  return s.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function specLabel(_classSlug: string, specSlug: string): string {
  return titleCase(specSlug);
}

function applySort(entries: AggregateEntry[], sort: SortKey): AggregateEntry[] {
  const copy = [...entries];
  if (sort === 'keys') {
    copy.sort((a, b) => b.keyCount - a.keyCount || b.highestLevel - a.highestLevel);
  } else if (sort === 'highest') {
    copy.sort((a, b) => b.highestLevel - a.highestLevel || b.keyCount - a.keyCount);
  } else {
    copy.sort((a, b) => b.lastSeenWeek - a.lastSeenWeek || b.keyCount - a.keyCount);
  }
  return copy;
}

export function PugCompanions({ runs, filter }: PugCompanionsProps) {
  const [view, setView] = useState<ViewKey>('specs');
  const [sort, setSort] = useState<SortKey>('keys');

  const players = useMemo<AggregateEntry[]>(() => {
    const map = new Map<string, AggregateEntry>();
    for (const run of runs) {
      if (!runMatchesFilter(run, filter)) continue;
      for (const pug of run.pugs) {
        const key = `${pug.name}@${pug.realm}`;
        const existing = map.get(key);
        if (existing) {
          existing.keyCount += 1;
          if (run.level > existing.highestLevel) existing.highestLevel = run.level;
          if (run.resetWeek > existing.lastSeenWeek) existing.lastSeenWeek = run.resetWeek;
        } else {
          map.set(key, {
            key,
            className: pug.class,
            primaryLabel: pug.name,
            secondaryLabel: pug.realm,
            keyCount: 1,
            highestLevel: run.level,
            lastSeenWeek: run.resetWeek,
          });
        }
      }
    }
    return applySort(Array.from(map.values()), sort);
  }, [runs, filter, sort]);

  const specs = useMemo<AggregateEntry[]>(() => {
    const map = new Map<string, AggregateEntry>();
    for (const run of runs) {
      if (!runMatchesFilter(run, filter)) continue;
      for (const pug of run.pugs) {
        if (!pug.spec) continue; // skip pugs missing spec data
        const key = `${pug.class}:${pug.spec}`;
        const existing = map.get(key);
        if (existing) {
          existing.keyCount += 1;
          if (run.level > existing.highestLevel) existing.highestLevel = run.level;
          if (run.resetWeek > existing.lastSeenWeek) existing.lastSeenWeek = run.resetWeek;
        } else {
          map.set(key, {
            key,
            className: pug.class,
            primaryLabel: specLabel(pug.class, pug.spec),
            keyCount: 1,
            highestLevel: run.level,
            lastSeenWeek: run.resetWeek,
          });
        }
      }
    }
    return applySort(Array.from(map.values()), sort);
  }, [runs, filter, sort]);

  const isSpecs = view === 'specs';
  const allEntries = isSpecs ? specs : players;
  const visibleEntries = isSpecs ? allEntries : allEntries.slice(0, TOP_N_PLAYERS);
  const hiddenCount = isSpecs ? 0 : Math.max(0, players.length - TOP_N_PLAYERS);
  const trueMax = allEntries.reduce((m, e) => Math.max(m, e.keyCount), 1);

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'keys', label: 'Most keys' },
    { value: 'highest', label: 'Highest key' },
    { value: 'recent', label: 'Most recent' },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <span className="font-medium text-gray-100">Pug companions</span>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSpecs ? 'Specs we have seen in matching runs' : 'Players who joined matching runs'}
          </p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-full border border-gray-700 overflow-hidden flex-shrink-0">
          {(['specs', 'players'] as ViewKey[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors cursor-pointer capitalize',
                view === v
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Sort pills */}
      <div className="mt-2 flex gap-1 flex-wrap">
        {SORT_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={[
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer',
              sort === value
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'border-gray-700 text-gray-500 hover:border-gray-500',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {visibleEntries.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
          {isSpecs ? 'No spec data yet' : 'No pug data yet'}
        </div>
      ) : (
        <div className="mt-3">
          {visibleEntries.map((entry) => {
            const color = classColor(entry.className);
            const barPct = (entry.keyCount / trueMax) * 100;

            return (
              <div
                key={entry.key}
                className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0"
              >
                {/* Class color dot */}
                <div
                  className="rounded-full flex-shrink-0"
                  style={{ width: 10, height: 10, backgroundColor: color }}
                />

                {/* Primary + secondary label */}
                <div className="w-40 flex-shrink-0 min-w-0">
                  <div className="text-sm text-gray-100 truncate">{entry.primaryLabel}</div>
                  {entry.secondaryLabel && (
                    <div className="text-xs text-gray-500 truncate">{entry.secondaryLabel}</div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex-grow bg-gray-800 rounded h-2 min-w-0">
                  <div
                    className="h-2 rounded"
                    style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.7 }}
                  />
                </div>

                {/* Key count */}
                <div className="text-sm text-gray-300 w-14 text-right flex-shrink-0 tabular-nums">
                  {entry.keyCount} keys
                </div>

                {/* Highest key badge */}
                <div className="text-xs rounded px-1 bg-gray-800 text-gray-300 flex-shrink-0 tabular-nums">
                  +{entry.highestLevel}
                </div>

                {/* Last seen week (players view only) */}
                {!isSpecs && (
                  <div className="text-xs text-gray-500 w-8 text-right flex-shrink-0 tabular-nums">
                    W{entry.lastSeenWeek}
                  </div>
                )}
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div className="pt-3 text-center text-xs text-gray-500">
              + {hiddenCount} more pug{hiddenCount > 1 ? 's' : ''} (showing top {TOP_N_PLAYERS})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
