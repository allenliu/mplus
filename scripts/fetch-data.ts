// Run with: npx tsx scripts/fetch-data.ts
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import type { GroupData, Run, PugCharacter } from '../src/lib/types';
import { ROSTER, SEASON_DUNGEONS, SEASON, REGION } from '../src/lib/roster';
import { fetchCharacterProfile, fetchRunDetails, fetchSeasonCutoffs } from '../src/lib/raiderio';
import { buildRun, applyRoster } from '../src/lib/groupRuns';
import { computeResetWeek, currentResetWeek } from '../src/lib/resets';
import { computeGroupIO, DEFAULT_FILTER } from '../src/lib/scoring';

const DATA_PATH = resolve('public/data.json');

async function main() {
  const existing: GroupData = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const runMap = new Map<number, Run>(existing.runs.map(r => [r.id, r]));

  // Fetch all character profiles
  console.log('Fetching character profiles...');
  const profiles = await Promise.all(
    ROSTER.map(m => fetchCharacterProfile(m.region, m.realm, m.name)),
  );

  // Collect new run IDs
  const newRunIds: number[] = [];
  for (const profile of profiles) {
    const allRuns = [...(profile.mythic_plus_recent_runs ?? []), ...(profile.mythic_plus_best_runs ?? [])];
    for (const rioRun of allRuns) {
      if (!runMap.has(rioRun.keystone_run_id)) {
        newRunIds.push(rioRun.keystone_run_id);
        const partial = buildRun(rioRun);
        runMap.set(partial.id, { ...partial, rosterMemberIds: [], pugs: [] });
      }
    }
  }

  // Fetch run details for new runs only
  const unique = [...new Set(newRunIds)];
  console.log(`Fetching details for ${unique.length} new runs...`);
  for (const runId of unique) {
    try {
      const details = await fetchRunDetails(runId);
      const partial = runMap.get(runId)!;
      const full = applyRoster(partial, details.roster, ROSTER);
      runMap.set(runId, full);
    } catch (e) {
      console.warn(`Skipping run ${runId}:`, e);
    }
  }

  // Refresh current-week benchmark on every run so the latest cutoff value tracks
  // the API as it grows mid-week. Historical weeks (set by the backfill from
  // graphData) are preserved.
  let benchmarks = existing.benchmarks;
  try {
    const cutoffs = await fetchSeasonCutoffs(REGION);
    const week = currentResetWeek();
    benchmarks = [
      ...benchmarks.filter(b => b.week !== week),
      {
        week,
        top1Pct: cutoffs.p990.all.quantileMinValue,
        top01Pct: cutoffs.p999.all.quantileMinValue,
      },
    ].sort((a, b) => a.week - b.week);
  } catch (e) {
    console.warn('Benchmark fetch failed:', e);
  }

  // Merge existing per-dungeon timers (captured by backfill) into the catalog
  const dungeonsWithTimers = SEASON_DUNGEONS.map(d => {
    const existingDungeon = existing.dungeons.find(e => e.id === d.id);
    return existingDungeon?.parTimeSeconds
      ? { ...d, parTimeSeconds: existingDungeon.parTimeSeconds }
      : d;
  });

  const output: GroupData = {
    fetchedAt: new Date().toISOString(),
    season: SEASON,
    seasonStartedAt: existing.seasonStartedAt,
    region: existing.region,
    roster: ROSTER,
    dungeons: dungeonsWithTimers,
    runs: [...runMap.values()].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    ),
    benchmarks,
  };

  writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`Done. ${output.runs.length} total runs (${unique.length} new).`);
}

main().catch(e => { console.error(e); process.exit(1); });
