// US resets: Tuesday 15:00 UTC. Season 1 started 2026-03-24T15:00:00Z.
const SEASON_START_UTC = new Date('2026-03-24T15:00:00Z');
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function computeResetWeek(completedAtISO: string): number {
  const completed = new Date(completedAtISO);
  const weeks = Math.floor((completed.getTime() - SEASON_START_UTC.getTime()) / MS_PER_WEEK);
  return weeks + 1;
}

export function currentResetWeek(): number {
  return computeResetWeek(new Date().toISOString());
}
