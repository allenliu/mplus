import { useGroupData } from './hooks/useGroupData';
import { useRosterFilter } from './hooks/useRosterFilter';
import { currentResetWeek } from './lib/resets';
import { FilterCard } from './components/FilterCard';
import SeasonGrid from './components/SeasonGrid';
import IOScoreCard from './components/IOScoreCard';
import { PugCompanions } from './components/PugCompanions';
import { RecentRuns } from './components/RecentRuns';
import { FreshnessIndicator } from './components/FreshnessIndicator';

export default function App() {
  const { data, loading, error } = useGroupData();
  const { filter, toggleMember, setGroupSize, setMode, clearAll } = useRosterFilter();

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const currentWeek = currentResetWeek();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-100 tracking-tight">mplus</h1>
          <FreshnessIndicator fetchedAt={data.fetchedAt} />
        </div>

        {/* Filter */}
        <FilterCard
          roster={data.roster}
          filter={filter}
          onToggleMember={toggleMember}
          onSetGroupSize={setGroupSize}
          onSetMode={setMode}
          onClearAll={clearAll}
        />

        {/* Season grid */}
        <SeasonGrid
          runs={data.runs}
          dungeons={data.dungeons}
          roster={data.roster}
          filter={filter}
        />

        {/* IO score + chart */}
        <IOScoreCard
          runs={data.runs}
          dungeons={data.dungeons}
          benchmarks={data.benchmarks}
          filter={filter}
          currentWeek={currentWeek}
        />

        {/* Recent runs */}
        <RecentRuns
          runs={data.runs}
          dungeons={data.dungeons}
          roster={data.roster}
          filter={filter}
        />

        {/* Pug companions */}
        <PugCompanions
          runs={data.runs}
          filter={filter}
        />

      </div>
    </div>
  );
}
