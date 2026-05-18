import type { Run, Dungeon } from './types';

export interface FilterState {
  required: Set<string>;
  groupSize: 'any' | 5 | 4 | 3 | 2 | 1;
}

export function runMatchesFilter(run: Run, filter: FilterState): boolean {
  for (const id of filter.required) if (!run.rosterMemberIds.includes(id)) return false;
  if (typeof filter.groupSize === 'number' && run.rosterMemberIds.length !== filter.groupSize) return false;
  return true;
}

export function computeGroupIO(
  runs: Run[],
  dungeons: Dungeon[],
  filter: FilterState,
  throughWeek?: number,
): number {
  let total = 0;
  for (const dungeon of dungeons) {
    let best = 0;
    for (const run of runs) {
      if (run.dungeonId !== dungeon.id) continue;
      if (throughWeek !== undefined && run.resetWeek > throughWeek) continue;
      if (!runMatchesFilter(run, filter)) continue;
      if (run.score > best) best = run.score;
    }
    total += best;
  }
  return total;
}

export const DEFAULT_FILTER: FilterState = {
  required: new Set(),
  groupSize: 'any',
};
