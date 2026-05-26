// One-time backfill: scrapes full season history from raider.io pages via Playwright.
// Run with: npx tsx scripts/backfill.ts
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import type { GroupData, Run, Dungeon } from '../src/lib/types';
import { ROSTER, SEASON_DUNGEONS, SEASON, REGION } from '../src/lib/roster';
import { applyRoster } from '../src/lib/groupRuns';
import { computeResetWeek, currentResetWeek } from '../src/lib/resets';
import { fetchSeasonCutoffs } from '../src/lib/raiderio';

const DATA_PATH = resolve('public/data.json');
const RAIDERIO_BASE = 'https://raider.io/api/v1';
const RATE_LIMIT_MS = 350; // ~170 req/min — safely under the 200/min cap

const CHAR_URLS = [
  'https://raider.io/characters/us/aerie-peak/Nychar',
  'https://raider.io/characters/us/tichondrius/Sonofsid',
  'https://raider.io/characters/us/tichondrius/Runesid',
  'https://raider.io/characters/us/tichondrius/Slakklom',
  'https://raider.io/characters/us/tichondrius/Meowmeowface',
  'https://raider.io/characters/us/tichondrius/Sonophpy',
  'https://raider.io/characters/us/tichondrius/Joementum',
  'https://raider.io/characters/us/tichondrius/Yogileg',
  'https://raider.io/characters/us/burning-legion/Nighte',
  'https://raider.io/characters/us/tichondrius/Ubemilktea',
];

interface ScrapedSummary {
  keystone_run_id: number;
  dungeonSlug: string;
  mythic_level: number;
  completed_at: string;
  num_chests: number;
  score: number;
  clear_time_ms: number;
}

interface RosterSlot {
  character: {
    name: string;
    realm: { slug: string };
    region: { slug: string };
    class: { slug: string };
    spec?: { slug: string };
  };
  role: string;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface FetchedRun {
  roster: RosterSlot[];
  score: number;
  clearTimeMs: number;
  keystoneTimeMs: number;
  numChests: number;
  completedAt: string;
  mythicLevel: number;
  dungeonSlug: string;
  dungeonTimerMs: number;
}

async function fetchRunDetailsFull(runId: number): Promise<FetchedRun> {
  const url = `${RAIDERIO_BASE}/mythic-plus/run-details?season=${SEASON}&id=${runId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as any;
  const r = data.run ?? data;
  return {
    roster: r?.roster ?? [],
    score: r?.score ?? 0,
    clearTimeMs: r?.clear_time_ms ?? 0,
    keystoneTimeMs: r?.keystone_time_ms ?? 0,
    numChests: r?.num_chests ?? 0,
    completedAt: r?.completed_at ?? '',
    mythicLevel: r?.mythic_level ?? 0,
    dungeonSlug: r?.dungeon?.slug ?? '',
    dungeonTimerMs: r?.dungeon?.keystone_timer_ms ?? 0,
  };
}

async function scrapeCharacter(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>,
  url: string,
): Promise<ScrapedSummary[]> {
  console.log(`  → ${url}`);
  await page.goto(url + '#runs', { waitUntil: 'networkidle', timeout: 30_000 });

  // Expand all 8 dungeon rows
  await page.evaluate(() => {
    const DUNGEON_NAMES = [
      "Algeth'ar", 'Windrunner', 'Maisara', "Magisters'",
      'Nexus-Point', 'Pit of Saron', 'Seat of', 'Skyreach',
    ];
    for (const tr of Array.from(document.querySelectorAll('tr'))) {
      const el = tr as HTMLElement;
      if (el.querySelectorAll('td').length >= 3 && DUNGEON_NAMES.some(n => el.textContent?.includes(n))) {
        el.click();
      }
    }
  });

  await sleep(2500);

  // Walk React fiber tree to collect all run summaries from expanded sections.
  // Each expanded dungeon section renders a component with a `runs` prop array;
  // we reach it by finding date-text tds and walking up the fiber.
  const runs: ScrapedSummary[] = await page.evaluate(() => {
    const collected = new Map<number, any>();

    const dateTds = Array.from(document.querySelectorAll('td')).filter(td => {
      const t = td.textContent?.trim() ?? '';
      return (
        t.length < 55 &&
        (t.match(/\d+\s+(hour|day|week|month)s?\s+ago/) !== null ||
          t.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d/) !== null)
      );
    });

    for (const td of dateTds) {
      const fk = Object.keys(td).find((k: string) => k.startsWith('__reactFiber'));
      if (!fk) continue;
      let fiber = (td as any)[fk];
      for (let i = 0; i < 20 && fiber; i++, fiber = fiber.return) {
        const props = fiber.memoizedProps;
        if (
          props?.runs &&
          Array.isArray(props.runs) &&
          props.runs[0]?.summary?.keystone_run_id
        ) {
          for (const run of props.runs) {
            const s = run.summary;
            if (s?.keystone_run_id) {
              collected.set(s.keystone_run_id, {
                keystone_run_id: s.keystone_run_id,
                dungeonSlug: s.dungeon?.slug ?? '',
                mythic_level: s.mythic_level,
                completed_at: s.completed_at,
                num_chests: s.num_chests ?? 0,
                score: s.score ?? 0,
                clear_time_ms: s.clear_time_ms ?? 0,
              });
            }
          }
          break;
        }
      }
    }

    return [...collected.values()];
  });

  console.log(`    found ${runs.length} runs`);
  return runs;
}

async function main() {
  const existing: GroupData = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const runMap = new Map<number, Run>(existing.runs.map(r => [r.id, r]));
  const skipScrape = process.argv.includes('--skip-scrape');

  const allScraped = new Map<number, ScrapedSummary>();

  if (skipScrape) {
    console.log('Skipping Phase 1 (--skip-scrape). Will re-fetch any existing runs missing data.');
  } else {
    // --- Phase 1: scrape all character pages ---
    console.log('\nPhase 1 — Scraping character pages...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const url of CHAR_URLS) {
      try {
        const runs = await scrapeCharacter(page, url);
        for (const r of runs) allScraped.set(r.keystone_run_id, r);
      } catch (e) {
        console.warn(`  FAILED ${url}:`, (e as Error).message);
      }
      await sleep(1500);
    }

    await browser.close();
    console.log(`\nScraped ${allScraped.size} unique runs across all characters.`);
  }

  // --- Phase 2: fetch run-details ---
  // Include: brand-new scraped IDs + existing runs missing score (legacy data repair)
  const newIds = [...allScraped.keys()].filter(id => !runMap.has(id));
  const repairIds = [...runMap.values()]
    .filter(r =>
      !r.score
      || r.score === 0
      || r.pugs.some(p => !p.spec) // any pug missing spec (added later)
    )
    .map(r => r.id);
  const idsToFetch = [...new Set([...newIds, ...repairIds])];
  console.log(`\nPhase 2 — Fetching details for ${idsToFetch.length} runs (${newIds.length} new, ${repairIds.length} repair).`);
  const dungeonTimerMs = new Map<string, number>();
  let done = 0;
  for (const runId of idsToFetch) {
    const s = allScraped.get(runId);
    try {
      const r = await fetchRunDetailsFull(runId);
      if (r.dungeonSlug && r.dungeonTimerMs) {
        dungeonTimerMs.set(r.dungeonSlug, r.dungeonTimerMs);
      }
      const partial: Omit<Run, 'rosterMemberIds' | 'pugs'> = {
        id: runId,
        dungeonId: r.dungeonSlug || s?.dungeonSlug || '',
        level: r.mythicLevel || s?.mythic_level || 0,
        completedAt: r.completedAt || s?.completed_at || '',
        resetWeek: computeResetWeek(r.completedAt || s?.completed_at || ''),
        result: r.numChests > 0 ? 'timed' : 'depleted',
        durationSeconds: (r.clearTimeMs || s?.clear_time_ms || 0) / 1000,
        score: r.score,
      };
      runMap.set(runId, applyRoster(partial, r.roster, ROSTER));
    } catch (e) {
      console.warn(`  Skipping run ${runId}: ${(e as Error).message}`);
    }

    done++;
    if (done % 25 === 0 || done === idsToFetch.length) {
      process.stdout.write(`  ${done}/${idsToFetch.length}\r`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  // Merge captured dungeon timers into the catalog (prefer newly captured)
  const dungeonsWithTimers: Dungeon[] = SEASON_DUNGEONS.map(d => {
    const capturedSec = dungeonTimerMs.has(d.id)
      ? Math.round(dungeonTimerMs.get(d.id)! / 1000)
      : existing.dungeons.find(e => e.id === d.id)?.parTimeSeconds;
    return capturedSec ? { ...d, parTimeSeconds: capturedSec } : d;
  });

  // --- Phase 2.5: fetch full historical season cutoffs ---
  let benchmarks = existing.benchmarks;
  try {
    console.log('\nFetching season cutoffs...');
    const cutoffs = await fetchSeasonCutoffs(REGION);
    const p990 = cutoffs.graphData?.p990?.data ?? [];
    const p999 = cutoffs.graphData?.p999?.data ?? [];
    // Pair by timestamp (x); both series share the same daily snapshots
    const byX = new Map<number, { top1Pct?: number; top01Pct?: number }>();
    for (const pt of p990) {
      const e = byX.get(pt.x) ?? {};
      e.top1Pct = pt.y;
      byX.set(pt.x, e);
    }
    for (const pt of p999) {
      const e = byX.get(pt.x) ?? {};
      e.top01Pct = pt.y;
      byX.set(pt.x, e);
    }
    // Bucket by reset week, keep the latest snapshot per week (highest x)
    const perWeek = new Map<number, { x: number; top1Pct: number; top01Pct: number }>();
    for (const [x, e] of byX.entries()) {
      if (e.top1Pct == null || e.top01Pct == null) continue;
      const week = computeResetWeek(new Date(x).toISOString());
      if (week < 1) continue;
      const existing = perWeek.get(week);
      if (!existing || x > existing.x) {
        perWeek.set(week, { x, top1Pct: e.top1Pct, top01Pct: e.top01Pct });
      }
    }
    if (perWeek.size > 0) {
      benchmarks = [...perWeek.entries()]
        .map(([week, v]) => ({ week, top1Pct: v.top1Pct, top01Pct: v.top01Pct }))
        .sort((a, b) => a.week - b.week);
      console.log(`  Populated ${benchmarks.length} weekly benchmark points (W${benchmarks[0].week}–W${benchmarks[benchmarks.length - 1].week}).`);
    } else {
      // Fallback: at least record the current week's snapshot
      const week = currentResetWeek();
      benchmarks = [
        ...benchmarks.filter(b => b.week !== week),
        { week, top1Pct: cutoffs.p990.all.quantileMinValue, top01Pct: cutoffs.p999.all.quantileMinValue },
      ].sort((a, b) => a.week - b.week);
      console.log(`  No graphData — wrote current week (W${week}) only.`);
    }
  } catch (e) {
    console.warn(`  Cutoff fetch failed: ${(e as Error).message}`);
  }

  // --- Phase 2.7: reclassify pugs as roster members when roster grows ---
  // Idempotent: any pug whose (name, realm) matches a current roster member
  // gets promoted to rosterMemberIds and removed from pugs.
  function normName(s: string) { return s.toLowerCase(); }
  function normRealm(s: string) { return s.toLowerCase().replace(/\s+/g, '-'); }
  let reclassified = 0;
  for (const [id, run] of runMap.entries()) {
    const stayingPugs: typeof run.pugs = [];
    const addedIds: string[] = [];
    for (const p of run.pugs) {
      const member = ROSTER.find(
        m => normName(m.name) === normName(p.name) && normRealm(m.realm) === normRealm(p.realm),
      );
      if (member && !run.rosterMemberIds.includes(member.id)) {
        addedIds.push(member.id);
        reclassified++;
      } else if (!member) {
        stayingPugs.push(p);
      }
    }
    if (addedIds.length > 0) {
      runMap.set(id, { ...run, rosterMemberIds: [...run.rosterMemberIds, ...addedIds], pugs: stayingPugs });
    }
  }
  if (reclassified > 0) console.log(`\nReclassified ${reclassified} pug slot(s) as roster members.`);

  // --- Phase 3: write output ---
  const output: GroupData = {
    ...existing,
    fetchedAt: new Date().toISOString(),
    dungeons: dungeonsWithTimers,
    benchmarks,
    roster: ROSTER,
    runs: [...runMap.values()].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    ),
  };

  writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`\n\nDone. ${output.runs.length} runs written to public/data.json.`);
}

main().catch(e => { console.error(e); process.exit(1); });
