import type { RosterMember } from '../lib/types';
import type { FilterState } from '../lib/scoring';

interface FilterCardProps {
  roster: RosterMember[];
  filter: FilterState;
  onToggleMember: (id: string) => void;
  onSetGroupSize: (size: FilterState['groupSize']) => void;
  onClearAll: () => void;
}

const GROUP_SIZE_OPTIONS: { value: FilterState['groupSize']; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 5, label: '5-stack' },
  { value: 4, label: '4-stack' },
  { value: 3, label: '3-stack' },
  { value: 2, label: '2-stack' },
  { value: 1, label: 'Solo + pugs' },
];

export function FilterCard({
  roster,
  filter,
  onToggleMember,
  onSetGroupSize,
  onClearAll,
}: FilterCardProps) {
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-gray-100">Filter by roster</span>
        <button
          onClick={onClearAll}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Sub-label */}
      <p className="text-xs text-gray-500 mb-3">
        Click: must be in run · Click again: must NOT · Click again: clear
      </p>

      {/* Player chips */}
      <div className="flex flex-wrap gap-2">
        {[...roster].sort((a, b) => a.name.localeCompare(b.name)).map((member) => {
          const isRequired = filter.required.has(member.id);
          const isExcluded = filter.excluded.has(member.id);
          const color = member.displayColor ?? '#9ca3af';

          let chipStyle: React.CSSProperties;
          let chipContent: React.ReactNode;

          if (isRequired) {
            chipStyle = {
              backgroundColor: color,
              borderColor: color,
              color: '#ffffff',
            };
            chipContent = (
              <>
                <span aria-hidden="true">✓</span>
                {member.name}
              </>
            );
          } else if (isExcluded) {
            chipStyle = {
              backgroundColor: '#fee2e2',
              borderColor: '#991b1b',
              color: '#991b1b',
            };
            chipContent = (
              <>
                <span aria-hidden="true">✕</span>
                <span className="line-through">{member.name}</span>
              </>
            );
          } else {
            chipStyle = {
              backgroundColor: 'transparent',
              borderColor: color,
              color: color,
            };
            chipContent = <>{member.name}</>;
          }

          return (
            <button
              key={member.id}
              onClick={() => onToggleMember(member.id)}
              style={chipStyle}
              className="rounded-full px-3 py-1 text-sm font-medium border transition-colors cursor-pointer flex items-center gap-1"
            >
              {chipContent}
            </button>
          );
        })}
      </div>

      {/* Group size row */}
      <div className="mt-3 flex gap-2">
        {GROUP_SIZE_OPTIONS.map(({ value, label }) => {
          const isActive = filter.groupSize === value;
          return (
            <button
              key={String(value)}
              onClick={() => onSetGroupSize(value)}
              className={[
                'rounded-full px-3 py-1 text-sm font-medium border transition-colors cursor-pointer',
                isActive
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'border-gray-600 text-gray-400 hover:border-gray-400',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

    </div>
  );
}
