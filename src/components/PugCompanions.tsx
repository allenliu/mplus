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

interface PugEntry {
  key: string;
  name: string;
  realm: string;
  class: string;
  role: string;
  keyCount: number;
  highestLevel: number;
  lastSeenWeek: number;
}

export function PugCompanions({ runs, filter }: PugCompanionsProps) {
  const [sort, setSort] = useState<SortKey>('keys');

  const pugs = useMemo<PugEntry[]>(() => {
    const map = new Map<string, PugEntry>();

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
            name: pug.name,
            realm: pug.realm,
            class: pug.class,
            role: pug.role,
            keyCount: 1,
            highestLevel: run.level,
            lastSeenWeek: run.resetWeek,
          });
        }
      }
    }

    const entries = Array.from(map.values());

    if (sort === 'keys') {
      entries.sort((a, b) => b.keyCount - a.keyCount || b.highestLevel - a.highestLevel);
    } else if (sort === 'highest') {
      entries.sort((a, b) => b.highestLevel - a.highestLevel || b.keyCount - a.keyCount);
    } else {
      entries.sort((a, b) => b.lastSeenWeek - a.lastSeenWeek || b.keyCount - a.keyCount);
    }

    return entries;
  }, [runs, filter, sort]);

  const TOP_N = 10;
  const visiblePugs = pugs.slice(0, TOP_N);
  const hiddenCount = Math.max(0, pugs.length - TOP_N);
  const trueMax = pugs.reduce((m, p) => Math.max(m, p.keyCount), 1);

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'keys', label: 'Most keys' },
    { value: 'highest', label: 'Highest key' },
    { value: 'recent', label: 'Most recent' },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <span className="font-medium text-gray-100">Pug companions</span>
          <p className="text-xs text-gray-500 mt-0.5">Players who joined matching runs</p>
        </div>
        {/* Sort pills */}
        <div className="flex gap-1 flex-shrink-0">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={[
                'rounded-full px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer',
                sort === value
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'border-gray-600 text-gray-400 hover:border-gray-400',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {pugs.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
          No pug data yet
        </div>
      ) : (
        <div className="mt-3">
          {visiblePugs.map((pug) => {
            const color = classColor(pug.class);
            const barPct = (pug.keyCount / trueMax) * 100;

            return (
              <div
                key={pug.key}
                className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0"
              >
                {/* Class color dot */}
                <div
                  className="rounded-full flex-shrink-0"
                  style={{ width: 10, height: 10, backgroundColor: color }}
                />

                {/* Name + realm */}
                <div className="w-36 flex-shrink-0 min-w-0">
                  <div className="text-sm text-gray-100 truncate">{pug.name}</div>
                  <div className="text-xs text-gray-500 truncate">{pug.realm}</div>
                </div>

                {/* Progress bar */}
                <div className="flex-grow bg-gray-800 rounded h-2 min-w-0">
                  <div
                    className="h-2 rounded"
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                </div>

                {/* Key count */}
                <div className="text-sm text-gray-300 w-14 text-right flex-shrink-0">
                  {pug.keyCount} keys
                </div>

                {/* Highest key badge */}
                <div className="text-xs rounded px-1 bg-gray-800 text-gray-300 flex-shrink-0">
                  +{pug.highestLevel}
                </div>

                {/* Last seen week */}
                <div className="text-xs text-gray-500 w-8 text-right flex-shrink-0">
                  W{pug.lastSeenWeek}
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div className="pt-3 text-center text-xs text-gray-500">
              + {hiddenCount} more pug{hiddenCount > 1 ? 's' : ''} (showing top {TOP_N})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
