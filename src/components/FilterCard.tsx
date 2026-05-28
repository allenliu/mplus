import type { RosterMember } from '../lib/types';
import type { FilterState, FilterMode } from '../lib/scoring';
import { PLAYERS } from '../lib/roster';

interface FilterCardProps {
  roster: RosterMember[];
  filter: FilterState;
  onToggleMember: (id: string) => void;
  onSetGroupSize: (size: FilterState['groupSize']) => void;
  onSetMode: (mode: FilterMode) => void;
  onClearAll: () => void;
}

const GROUP_SIZE_OPTIONS: { value: FilterState['groupSize']; shortLabel: string; label: string }[] = [
  { value: 'any', shortLabel: 'Any', label: 'Any' },
  { value: 5, shortLabel: '5', label: '5-stack' },
  { value: 4, shortLabel: '4', label: '4-stack' },
  { value: 3, shortLabel: '3', label: '3-stack' },
  { value: 2, shortLabel: '2', label: '2-stack' },
  { value: 1, shortLabel: 'Solo', label: 'Solo + pugs' },
];

export function FilterCard({
  roster,
  filter,
  onToggleMember,
  onSetGroupSize,
  onSetMode,
  onClearAll,
}: FilterCardProps) {
  const isPlayerMode = filter.mode === 'player';

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="font-medium text-gray-100">Filter by {isPlayerMode ? 'player' : 'character'}</span>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-gray-700 p-0.5 text-xs">
            {(['character', 'player'] as const).map((mode) => {
              const active = filter.mode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => onSetMode(mode)}
                  className={[
                    'px-2.5 py-0.5 rounded-full transition-colors cursor-pointer capitalize',
                    active ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200',
                  ].join(' ')}
                >
                  {mode}
                </button>
              );
            })}
          </div>
          <button
            onClick={onClearAll}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Sub-label */}
      <p className="text-xs text-gray-500 mb-3">
        {isPlayerMode
          ? 'Click to require a player in the run · click again to clear'
          : 'Click to require a character in the run · click again to clear'}
      </p>

      {/* Chip row — wraps on sm+, scrolls horizontally on mobile */}
      <div className="relative -mx-4 sm:mx-0">
        <div className="flex gap-2 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible px-4 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isPlayerMode
            ? [...PLAYERS]
                .sort((a, b) => a.acronym.localeCompare(b.acronym))
                .map((player) => {
                  const isRequired = filter.required.has(player.id);
                  return (
                    <button
                      key={player.id}
                      onClick={() => onToggleMember(player.id)}
                      className={[
                        'rounded-full px-3 py-1 text-sm font-medium border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0',
                        isRequired
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'border-gray-600 text-gray-400 hover:border-gray-400',
                      ].join(' ')}
                    >
                      {isRequired && <span aria-hidden="true">✓</span>}
                      {player.acronym}
                    </button>
                  );
                })
            : [...roster]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((member) => {
                  const isRequired = filter.required.has(member.id);
                  const color = member.displayColor ?? '#9ca3af';
                  const chipStyle: React.CSSProperties = isRequired
                    ? { backgroundColor: color, borderColor: color, color: '#ffffff' }
                    : { backgroundColor: 'transparent', borderColor: color, color };
                  return (
                    <button
                      key={member.id}
                      onClick={() => onToggleMember(member.id)}
                      style={chipStyle}
                      className="rounded-full px-3 py-1 text-sm font-medium border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      {isRequired && <span aria-hidden="true">✓</span>}
                      {member.name}
                    </button>
                  );
                })}
        </div>
        {/* Mobile right-edge fade hint */}
        <div className="sm:hidden pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-gray-900 to-transparent" />
      </div>

      {/* Group size row */}
      <div className="mt-3 flex flex-wrap gap-2">
        {GROUP_SIZE_OPTIONS.map(({ value, label, shortLabel }) => {
          const isActive = filter.groupSize === value;
          return (
            <button
              key={String(value)}
              onClick={() => onSetGroupSize(value)}
              className={[
                'rounded-full px-3 py-1 text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap',
                isActive
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'border-gray-600 text-gray-400 hover:border-gray-400',
              ].join(' ')}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
