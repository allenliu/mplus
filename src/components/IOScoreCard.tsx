import type { Run, Dungeon, BenchmarkPoint } from '../lib/types';
import type { FilterState } from '../lib/scoring';
import { computeGroupIO } from '../lib/scoring';
import IOChart from './IOChart';

export interface IOScoreCardProps {
  runs: Run[];
  dungeons: Dungeon[];
  benchmarks: BenchmarkPoint[];
  filter: FilterState;
  currentWeek: number;
}

function signed(n: number): string {
  return n >= 0 ? `+${Math.round(n)}` : `${Math.round(n)}`;
}

function deltaColor(n: number): string {
  return n >= 0 ? 'text-emerald-400' : 'text-red-400';
}

export default function IOScoreCard({
  runs,
  dungeons,
  benchmarks,
  filter,
  currentWeek,
}: IOScoreCardProps) {
  const currentIO = computeGroupIO(runs, dungeons, filter, currentWeek);
  const prevIO =
    currentWeek > 1 ? computeGroupIO(runs, dungeons, filter, currentWeek - 1) : 0;
  const weekDelta = currentIO - prevIO;

  const latestBenchmark = benchmarks.reduce<BenchmarkPoint | null>((best, b) =>
    best === null || b.week > best.week ? b : best, null);

  const top1 = latestBenchmark?.top1Pct;
  const top01 = latestBenchmark?.top01Pct;

  const vsTop1 = top1 != null ? currentIO - top1 : null;
  const vsTop01 = top01 != null ? currentIO - top01 : null;

  // Weeks-to-top-1% estimate: pace = IO gained over last 2 weeks
  let weeksToTop1: string;
  if (top1 == null) {
    weeksToTop1 = '—';
  } else if (currentIO >= top1) {
    weeksToTop1 = '✓ at pace';
  } else {
    const twoWeeksAgo =
      currentWeek > 2 ? computeGroupIO(runs, dungeons, filter, currentWeek - 2) : 0;
    const pace = currentIO - twoWeeksAgo; // IO gained over last 2 weeks
    if (pace <= 0) {
      weeksToTop1 = '—';
    } else {
      const weeksNeeded = Math.ceil(((top1 - currentIO) / pace) * 2);
      weeksToTop1 = `~${weeksNeeded}w`;
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      {/* Big IO number */}
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-semibold text-white">
          {Math.round(currentIO).toLocaleString()}
        </span>
        <span className="text-sm text-gray-400">
          {weekDelta !== 0
            ? `${signed(weekDelta)} from last week`
            : 'no change from last week'}
        </span>
      </div>

      {/* Delta pills */}
      <div className="mt-3 flex items-stretch divide-x divide-gray-700 border border-gray-700 rounded-lg overflow-hidden">
        {/* vs top 1% */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
          <span className={`text-sm font-medium ${vsTop1 != null ? deltaColor(vsTop1) : 'text-gray-500'}`}>
            {vsTop1 != null ? signed(vsTop1) : '—'}
          </span>
          <span className="text-xs text-gray-500 mt-0.5">vs top 1%</span>
          {top1 != null && (
            <span className="text-[10px] text-gray-600 tabular-nums mt-1">
              cutoff {Math.round(top1).toLocaleString()}
            </span>
          )}
        </div>

        {/* vs top 0.1% */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
          <span className={`text-sm font-medium ${vsTop01 != null ? deltaColor(vsTop01) : 'text-gray-500'}`}>
            {vsTop01 != null ? signed(vsTop01) : '—'}
          </span>
          <span className="text-xs text-gray-500 mt-0.5">vs top 0.1%</span>
          {top01 != null && (
            <span className="text-[10px] text-gray-600 tabular-nums mt-1">
              cutoff {Math.round(top01).toLocaleString()}
            </span>
          )}
        </div>

        {/* Weeks to top 1% */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
          <span
            className={`text-sm font-medium ${
              weeksToTop1 === '✓ at pace'
                ? 'text-emerald-400'
                : weeksToTop1 === '—'
                ? 'text-gray-500'
                : 'text-gray-200'
            }`}
          >
            {weeksToTop1}
          </span>
          <span className="text-xs text-gray-500 mt-0.5">weeks to top 1%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4">
        <IOChart
          runs={runs}
          dungeons={dungeons}
          benchmarks={benchmarks}
          filter={filter}
          currentWeek={currentWeek}
        />
      </div>
    </div>
  );
}
