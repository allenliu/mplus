# Keystone — WoW M+ Group Dashboard

A private dashboard for a static group of 6 friends running Mythic+ keystones together in *World of Warcraft: Midnight* — Season 1. Visualizes the group's progression across the season, filterable by which players were in each run, with comparisons to global benchmarks.

This brief captures all design decisions made in a prior planning session. Read top-to-bottom before starting; it's self-contained.

---

## 1. Goals & non-goals

### Goals (v1)
- Visualize the group's M+ run history across the season, grouped by weekly reset
- Filter the data by who was in the run (include / exclude / ignore each player, plus group size)
- Show the group's aggregate IO score and its growth over the season vs global benchmarks (top 1% / top 0.1%)
- Track which pug characters we've played with and how often, filterable by current roster filter
- Distinguish full 5-stack group runs from runs with pugs

### Non-goals (v1)
- Warcraftlogs integration (damage/healing/death stats) — deferred to v2
- Per-character deep-dive pages
- Push notifications, automated alerts
- Multi-season history (current season only)
- Mobile-first design (desktop primary; should still be usable on mobile)

---

## 2. Tech stack & hosting

- **Vite + React + TypeScript** — fast dev server, simple build, strong typing for the data model
- **Tailwind CSS** for styling (utility-first, fast iteration)
- **Vercel** for hosting — auto-deploy on push to `main`, free tier, preview deploys for branches, handles SPA routing without config
- **GitHub Actions** cron for scheduled data refresh
- **Raider.io public API** (CORS-enabled, no auth, **200 req/min** unauthenticated limit per OpenAPI spec) as the sole data source
- **Pure client-side**, no backend or serverless functions needed
- For the IO growth chart, hand-rolled SVG is fine and gives full design control. `recharts` is an acceptable alternative if it speeds development.

---

## 3. Architecture & data flow

### The three caching layers

1. **GitHub Actions cron** — Runs every ~30 minutes. Fetches all 6 characters' run histories and current benchmark cutoffs from Raider.io. **Merges new runs into the existing `public/data.json`** (never replaces — see §3 Accumulation), commits, and the push triggers a Vercel redeploy.
2. **CDN-cached `data.json`** — The deployed site serves this static file. Page loads fetch it in ~50ms from Vercel's edge network. Single file, no API calls on cold load.
3. **`localStorage` in the browser** — Caches the last fetched data with a timestamp. Used to (a) paint instantly while revalidating in background, (b) survive Raider.io outages, (c) store results of manual "Fetch live" refreshes.

### Two refresh paths

- **Default (scheduled):** browser fetches `/data.json` from CDN on load, paints UI, updates `localStorage`.
- **Manual ("↻ Fetch live" button):** browser calls Raider.io API directly, bypasses CDN. Used after the group just finished a key and doesn't want to wait for the next cron tick.

### TTL strategy per data type
- **Character run histories** — re-fetched every cron run (30 min)
- **Benchmark cutoffs (top 1% / 0.1%)** — re-fetched once daily; they barely move
- **Dungeon list / season metadata** — once at start of season, then never until next season

### Accumulation strategy (critical)

`mythic_plus_recent_runs` returns only the **last 10 runs** per character — confirmed empirically. On an active night the group can run 8+ keys, meaning runs fall out of the API window between cron ticks if we replace instead of merge.

The fetcher **must** treat `public/data.json` as the source of truth for history. Algorithm:

1. Read existing `data.json` runs into a `Map<keystone_run_id, Run>`
2. Fetch new runs from the API
3. Fetch run-details for any `keystone_run_id` not already in the map (to get roster)
4. Merge new entries into the map
5. Write the updated set back to `data.json`

This means **historical data is never lost as long as the cron runs at least once per ~5 keys played**. At 30-min intervals and ~30 min per key, the buffer is comfortable for normal play but would miss runs during a very long offline gap.

### Backfill note

Raider.io's **public API** exposes no historical run data beyond the last 10 recent runs. However, the Raider.io **character page** (Next.js SSR) embeds the full season run history in server-rendered React props — verified empirically: Sonophpy has **180 runs** across all 8 dungeons from April 6 to May 17 accessible from the page's fiber tree, versus only 10 from the API.

A one-time **Playwright backfill script** (`scripts/backfill.ts`) can extract this:
1. Load each character's page (e.g. `https://raider.io/characters/us/tichondrius/Sonophpy#runs`)
2. Click each dungeon row to expand it
3. Walk the React fiber tree (`memoizedProps.runs`) to collect all `keystone_run_id`s with metadata
4. Call Endpoint 2 (`run-details`) for each unique run ID to get roster
5. Write the resulting runs into `public/data.json` as the initial seed

After the one-time backfill, the normal cron accumulation takes over.

The internal endpoint `/api/characters/mythic-plus-runs?season=season-mn-1&characterId={id}` (found in the Raider.io JS bundle) also caps at 10 — same as the public API. The SSR page is the only source of full history.

Character IDs are embedded in `run-details` roster responses: e.g. Sonophpy = `304539449` (US/Tichondrius). Fetch any known run for a character, read the roster, find their `character.id`.

---

## 4. Project structure

```
keystone/
├── .github/
│   └── workflows/
│       └── refresh-data.yml      # cron + manual trigger
├── public/
│   └── data.json                 # the committed data snapshot
├── scripts/
│   ├── fetch-data.ts             # fetcher logic — used by GH Action and locally
│   └── backfill.ts               # one-time Playwright scraper for full season history
├── src/
│   ├── lib/
│   │   ├── types.ts              # shared TypeScript types
│   │   ├── raiderio.ts           # API client
│   │   ├── groupRuns.ts          # cross-character matching
│   │   ├── resets.ts             # Tuesday-15:00-UTC bucketing
│   │   └── scoring.ts            # group IO score computation
│   ├── hooks/
│   │   ├── useGroupData.ts       # loads data.json + manages localStorage
│   │   └── useRosterFilter.ts    # filter state
│   ├── components/
│   │   ├── FilterCard.tsx
│   │   ├── SeasonGrid.tsx
│   │   ├── IOScoreCard.tsx
│   │   ├── IOChart.tsx
│   │   ├── PugCompanions.tsx
│   │   └── FreshnessIndicator.tsx
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## 5. Data model

```ts
// src/lib/types.ts

export type Region = 'us' | 'eu' | 'kr' | 'tw' | 'cn';
export type Role = 'tank' | 'healer' | 'dps';
export type RunResult = 'timed' | 'depleted';

export interface RosterMember {
  id: string;              // short stable id (e.g. "T", "V") — used in run.rosterMemberIds
  name: string;
  realm: string;           // raider.io slug, lowercase with dashes (e.g. "stormrage")
  region: Region;
  class: string;           // e.g. "death-knight"
  primaryRole: Role;       // default/most-common role — display only, NOT used for run filtering
  displayColor?: string;   // optional UI accent
}

export interface Dungeon {
  id: string;              // e.g. "windrunner-spire"
  name: string;            // e.g. "Windrunner Spire"
  shortName?: string;
  category: 'new' | 'legacy';
}

export interface PugCharacter {
  name: string;
  realm: string;
  region: Region;
  class: string;           // for class-color tinting in the pug list
  role: Role;
}

export interface Run {
  id: string;                       // raider.io run id (used for dedupe across characters)
  dungeonId: string;
  level: number;
  completedAt: string;              // ISO-8601 UTC
  resetWeek: number;                // 1-indexed; computed via resets.ts
  result: RunResult;
  durationSeconds: number;
  score: number;                    // Raider.io's per-run score (don't reimplement)
  rosterMemberIds: string[];        // 0..5 of your group; rest are pugs
  pugs: PugCharacter[];             // 0..5 — fills the remaining slots
}

export interface BenchmarkPoint {
  week: number;
  top1Pct: number;
  top01Pct: number;
}

export interface GroupData {
  fetchedAt: string;                // ISO-8601
  season: string;                   // e.g. "season-mn-1" (confirmed from live API)
  seasonStartedAt: string;          // ISO-8601 of week 1, Tuesday 15:00 UTC
  region: Region;
  roster: RosterMember[];
  dungeons: Dungeon[];
  runs: Run[];                      // deduped across characters
  benchmarks: BenchmarkPoint[];
}
```

---

## 6. Raider.io API integration

Full OpenAPI spec: `https://raider.io/swagger.json`. Interactive docs: `https://raider.io/api`. Rate limit: **200 req/min** unauthenticated. Register an app at raider.io/settings/apps for higher limits.

### Endpoint 1 — Character run history
```
GET https://raider.io/api/v1/characters/profile
  ?region={region}
  &realm={realm}
  &name={name}
  &fields=mythic_plus_recent_runs,mythic_plus_best_runs:all,mythic_plus_scores_by_season:current
```

**`mythic_plus_recent_runs`** — Last **10 runs** (hard cap, confirmed). Each entry includes `keystone_run_id`, `dungeon`, `short_name`, `mythic_level`, `completed_at`, `clear_time_ms`, `par_time_ms`, `num_keystone_upgrades`, `score`, `affixes`, `url`. **No roster field** — requires a separate run-details call.

**`mythic_plus_best_runs:all`** — All of a character's best-scored runs for the season (`:all` removes the default 10-run cap). Best run per dungeon across all 8 dungeons. Use on first deploy to seed historical best runs.

**`mythic_plus_alternate_runs`** — Not applicable to Midnight Season 1. This season runs Tyrannical and Fortified simultaneously every week; there is no alternating week structure, so alternate runs never exist. Omit from the fields query entirely.

**`mythic_plus_scores_by_season:current`** — Returns the character's current IO score directly. Useful for cross-checking computed group IO.

Other available fields (not needed for v1): `mythic_plus_highest_level_runs`, `mythic_plus_weekly_highest_level_runs`, `mythic_plus_previous_weekly_highest_level_runs`.

**Season slug:** `season-mn-1` (confirmed from live run URLs and API defaults).

### Endpoint 2 — Run details (roster / pug detection)
```
GET https://raider.io/api/v1/mythic-plus/run-details
  ?season=season-mn-1
  &id={keystone_run_id}
```

Returns full run data including a `roster` array with one entry per player: `character.name`, `character.realm.slug`, `character.class.slug`, `character.spec`, `character.region.slug`.

This is the **only way to get roster data** for pug detection. Call once per unique run; cache in `data.json` permanently — never re-fetch a run already stored.

### Endpoint 3 — Season cutoffs (benchmarks)
```
GET https://raider.io/api/v1/mythic-plus/season-cutoffs
  ?season=season-mn-1
  &region=us
```

**Confirmed working.** Returns `p999` (top 0.1%) and `p990` (top 1%) with faction-split and combined `all` values. As of week 8: top 0.1% ≈ 3891, top 1% ≈ 3567 (all factions, US). Use `cutoffs.p999.all.quantileMinValue` and `cutoffs.p990.all.quantileMinValue`. Cache for 24h.

### Endpoint 4 — Dungeon static data
```
GET https://raider.io/api/v1/mythic-plus/static-data
  ?expansion_id=11
```

Returns the official dungeon list for Midnight (expansion 11). Use this at startup to get authoritative dungeon IDs and slugs rather than hardcoding §12. Verify slugs returned here against hardcoded values.

### Endpoint 5 — Score tiers (cell colors)
```
GET https://raider.io/api/v1/mythic-plus/score-tiers
  ?season=season-mn-1
```

Returns official score tier thresholds and associated colors. Can replace the hardcoded tier color ranges in `SeasonGrid` if preferred.

### API call budget per cron tick
- 6 character profile fetches (with all M+ fields)
- Up to ~10 run-detail fetches (new `keystone_run_id`s not yet in `data.json`)
- 1 season-cutoffs fetch (if 24h cache expired)

Total: ~17 calls per cron tick, well within the 200/min limit.

### Benchmark endpoint (top 1% / 0.1%)
Confirmed: `https://raider.io/api/v1/mythic-plus/season-cutoffs?season=season-mn-1&region=us`. No need to compute from leaderboard. Cache for 24h.

### Roster identification logic (`src/lib/groupRuns.ts`)

Dedup key: **`keystone_run_id`** — a stable, unique ID returned in every character's run list for the same physical key. No composite key needed.

Roster data comes from Endpoint 2 (`run-details`), not the character profile. The fetcher must call `run-details` for each `keystone_run_id` not already in `data.json`, then classify each roster member as a known player or pug.

Algorithm:
```ts
// pseudocode
async function mergeRuns(existingRuns: Run[], allCharacterFetches, rosterMembers): Promise<Run[]> {
  const runMap = new Map<number, Run>(existingRuns.map(r => [r.id, r]));

  const newRunIds: number[] = [];
  for (const charFetch of allCharacterFetches) {
    for (const r of charFetch.recent_runs) {
      if (!runMap.has(r.keystone_run_id)) {
        newRunIds.push(r.keystone_run_id);
        runMap.set(r.keystone_run_id, {
          id: r.keystone_run_id,
          dungeonId: slugify(r.dungeon),  // normalize to slug
          level: r.mythic_level,
          completedAt: r.completed_at,
          resetWeek: computeResetWeek(r.completed_at),
          result: r.num_keystone_upgrades > 0 ? 'timed' : 'depleted',
          durationSeconds: r.clear_time_ms / 1000,
          score: r.score,
          rosterMemberIds: [],  // filled below
          pugs: [],
        });
      }
    }
  }

  // Fetch roster for new runs only
  for (const runId of newRunIds) {
    const details = await fetchRunDetails(runId);  // Endpoint 2
    const run = runMap.get(runId)!;
    for (const slot of details.roster) {
      const known = findRosterMember(slot.character, rosterMembers);
      if (known) run.rosterMemberIds.push(known.id);
      else run.pugs.push(toPug(slot.character));
    }
  }

  return [...runMap.values()];
}
```

Notes:
- `run-details` roster includes `character.name`, `character.realm.slug`, `character.region.slug`, `character.class.slug`. Match by `name + realm` (case-insensitive, normalized).
- Watch for character renames/realm transfers mid-season — flag as an open question.

### Reset bucketing (`src/lib/resets.ts`)

Tuesdays at 15:00 UTC for US region (Wednesday 04:00 UTC for EU). Reset week N is the Nth full reset window since season launch.

Midnight Season 1 launched the week of **March 24, 2026**. The first reset window started **Tuesday, March 24, 2026 at 15:00 UTC** (US).

```ts
const SEASON_START_UTC = new Date('2026-03-24T15:00:00Z');

export function computeResetWeek(completedAtISO: string): number {
  const completed = new Date(completedAtISO);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor(
    (completed.getTime() - SEASON_START_UTC.getTime()) / msPerWeek
  );
  return weeksSinceStart + 1;  // 1-indexed
}
```

For EU groups, swap `SEASON_START_UTC` to the EU reset (Wednesday 04:00 UTC of the same week, roughly).

---

## 7. IO scoring logic

### Per-run score
Use `run.score` directly from Raider.io. Do not reimplement the formula — the values change with patches.

### Personal IO score
Sum of each player's best run score per dungeon across all 8 dungeons. (Raider.io already exposes this in the character profile, but for the group view we compute our own based on runs in our dataset.)

### Group IO score (the key concept)

> The score for a set of players is the sum of best scores per dungeon, restricted to runs that all selected players participated in together.

```ts
// src/lib/scoring.ts

interface FilterState {
  required: Set<string>;        // roster ids that MUST be present
  excluded: Set<string>;        // roster ids that must NOT be present
  groupSize: 'any' | 5 | 4 | '3-';
}

function runMatchesFilter(run: Run, filter: FilterState): boolean {
  for (const id of filter.required) if (!run.rosterMemberIds.includes(id)) return false;
  for (const id of filter.excluded) if (run.rosterMemberIds.includes(id)) return false;
  if (filter.groupSize === 5 && run.rosterMemberIds.length !== 5) return false;
  if (filter.groupSize === 4 && run.rosterMemberIds.length !== 4) return false;
  if (filter.groupSize === '3-' && run.rosterMemberIds.length > 3) return false;
  return true;
}

export function computeGroupIO(
  runs: Run[],
  dungeons: Dungeon[],
  filter: FilterState,
  throughWeek?: number,
): number {
  let total = 0;
  for (const d of dungeons) {
    let best = 0;
    for (const r of runs) {
      if (r.dungeonId !== d.id) continue;
      if (throughWeek !== undefined && r.resetWeek > throughWeek) continue;
      if (!runMatchesFilter(r, filter)) continue;
      if (r.score > best) best = r.score;
    }
    total += best;
  }
  return total;
}
```

### Cumulative weekly growth (for the IO chart)
For each week 1..N, compute `computeGroupIO(runs, dungeons, filter, throughWeek=week)`. Since it's cumulative-best, the curve only goes up.

### Benchmark comparison
Top 1% and top 0.1% lines are constant regardless of filter — they're global. The chart shows your group's cumulative-best line against these two reference lines, both dashed.

---

## 8. UI component specs

The visual language overall: clean, data-forward, neutral background with a green accent (#1D9E75 family) for the group's data. Soft borders, generous but not wasteful spacing. Tailwind defaults are mostly fine.

### 8.1 `FilterCard.tsx`

**Purpose:** Lets the user filter the entire dashboard by which players were in the run.

**Layout:**
- Title "Filter by roster" + sub-help "Click once: must be in run. Click again: must NOT be in run. Click again: clear."
- A row of player chips (one per roster member). Each chip has a 22×22 avatar circle with the player's initials and the player's display name.
- Tri-state per chip: **neutral** (default border), **in** (green border + light green bg + checkmark badge), **out** (red border + light red bg + line-through name + ✕ badge).
- Below: a row of group-size buttons — `Any` / `5 (no pugs)` / `4 (+1 pug)` / `3 or fewer`. Mutually exclusive, default `Any`.
- A "Clear all" button on the right.
- Below that: a label "Quick presets" with chip-style preset buttons. Suggested presets:
  - "5-stack: no <Player>" — one for each likely sit-out
  - "Tank + Healer present" (required: tank id + healer id)
  - "<Player> sat out" — one for each player
  - "All full 5-stacks" (group size 5, no required/excluded)

**State:** kept in a `useRosterFilter` hook so multiple components can read it.

### 8.2 `SeasonGrid.tsx`

**Purpose:** Visualize the best run per dungeon per reset week, filtered by the current roster filter.

**Layout:**
- A header row with reset week labels (W1, W2, ... W8 currently — auto-grow as season progresses)
- Two grouped row sections with subtle dividers: "New — Midnight dungeons" and "Legacy dungeons"
- Each row: dungeon name (left, ~150px column) + a row of cells, one per reset week.
- Cell width ~46×36px, gap 3px.

**Cell states:**
- **No run this week:** dashed border, transparent bg, "—" character, tertiary text color
- **Timed run:** filled bg colored by tier (low/mid/high/top):
  - +7..10: light green (`#E1F5EE` bg, dark green text)
  - +11..12: mid green (`#9FE1CB`)
  - +13..15: vibrant green (`#1D9E75`, light text)
  - +16+: dark green (`#085041`, light text)
  - Show `+N` centered
- **Depleted run:** light red bg (`#FCEBEB`), dark red text, show `+N` (the level they tried)
- **Markers:**
  - `P` in top-right corner if the best run had pugs. `P2` if two pugs.
  - `xN` in bottom-right corner if there were multiple matching runs in that cell (showing only the best)

**Best-run picker:** timed beats depleted; otherwise higher key wins.

**Filter behavior:** when filter changes, the cells re-render. Cells that have runs but none matching the filter show "—". Cells with no runs at all also show "—" (distinguish via tooltip).

### 8.3 `IOScoreCard.tsx` + `IOChart.tsx`

**Purpose:** Show the group's current IO score, comparison to benchmarks, and growth over the season.

**Top section (numbers):**
- Big number: group IO score (large 30px, weight 500)
- Subtitle: "+X from last week" (last week's delta)
- Three deltas separated by vertical rules:
  - vs top 1% (signed, colored green if positive, red if negative). Sub-label: "1700 is top 1%"
  - vs top 0.1% (same)
  - Weeks ahead: estimated weeks to reach top 1% based on last 2-week pace. Shows "✓ at pace" if already above 1%, "—" if pace is flat/declining.

**Chart section (SVG):**
- Width: 100% of card. Aspect roughly 700×215 viewBox.
- Y axis: 0 to 4000, gridlines at 1000 intervals. Labels: 0, 1k, 2k, 3k, 4k on the left.
- X axis: weeks 1..N (currently 8). Labels below the chart.
- Three lines:
  - **Group line** — solid #1D9E75, 2px, with circle dots at each week (radius 3, white-stroked). Light green area under the line at 10% opacity.
  - **Top 1% line** — dashed #BA7517 (amber), 1.5px, no dots.
  - **Top 0.1% line** — dashed #3C3489 (purple), 1.5px, no dots.
- Legend in top-right of chart: small swatches for each.

**Filter behavior:** the group line changes with the filter; benchmark lines stay constant.

### 8.4 `PugCompanions.tsx`

**Purpose:** Show which pugs the group has played with, filterable.

**Layout:**
- Card title "Pug companions" + sub "Players who filled empty slots in matching runs"
- Sort buttons on the right: `Most keys` / `Highest key` / `Most recent`
- A list of pug rows, sorted by the active criterion.

**Each pug row:**
- 9px class-colored dot (class colors below)
- Name column (~150px): name + smaller realm/class text
- Horizontal bar (flex-grow, max 260px): width proportional to key count, colored with the class color at ~85% opacity, on a neutral gray track
- Key count text: "N keys"
- Highest key pill: small rounded badge "+N"
- Last seen: "WN"

**Class color palette (WoW canonical, lightly adjusted for readability):**
```ts
const CLASS_COLORS: Record<string, string> = {
  mage:          '#3FC7EB',
  priest:        '#B0B3B5',
  shaman:        '#0070DD',
  paladin:       '#F48CBA',
  hunter:        '#94B964',
  rogue:         '#D9B900',
  warlock:       '#8788EE',
  monk:          '#00CC85',
  druid:         '#FF7C0A',
  evoker:        '#33937F',
  'demon-hunter':'#A330C9',
  'death-knight':'#C41E3A',
  warrior:       '#C69B6D',
};
```

**Filter behavior:** the pug list reflects only pugs from runs matching the current roster filter. So "Vexara sat out" shows the pugs who joined those specific runs.

### 8.5 `FreshnessIndicator.tsx`

Small element shown at the top of the page or in the header:

```
📡 Last updated 14 min ago · [↻ Fetch live]
```

- Reads `fetchedAt` from the loaded data, shows relative time ("Just now", "12 min ago", "2 hours ago").
- The button triggers a manual refresh: calls `fetch-data.ts` logic client-side, replaces `localStorage` data, updates the UI.
- Shows a spinner during refresh.

---

## 9. GitHub Actions cron

```yaml
# .github/workflows/refresh-data.yml
name: Refresh data

on:
  schedule:
    - cron: '*/30 * * * *'   # every 30 min
  workflow_dispatch: {}       # manual trigger

permissions:
  contents: write             # to commit data.json

jobs:
  refresh:
    runs-on: ubuntu-latest
    concurrency:
      group: refresh-data
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run fetch-data
      - name: Commit data.json if changed
        run: |
          git config user.name "keystone-bot"
          git config user.email "bot@users.noreply.github.com"
          git add public/data.json
          if ! git diff --staged --quiet; then
            git commit -m "Refresh data $(date -u +%Y-%m-%dT%H:%M:%SZ)"
            git push
          else
            echo "No changes"
          fi
```

The same `scripts/fetch-data.ts` runs locally (`npm run fetch-data`) for testing.

---

## 10. Build order (suggested)

Tackle in this order — each step builds on the previous, and you'll have something visible by step 7.

1. **Scaffold** — `npm create vite@latest keystone -- --template react-ts`, install Tailwind, set up the file structure above
2. **Type definitions** — `src/lib/types.ts` with everything from §5
3. **Reset bucketing** — `src/lib/resets.ts` with `computeResetWeek` and unit tests
4. **Raider.io client** — `src/lib/raiderio.ts` with typed fetch functions for character profile and benchmarks
5. **Run grouping** — `src/lib/groupRuns.ts` implementing the cross-character matching from §6
6. **Fetcher script** — `scripts/fetch-data.ts` that ties it all together, writes `public/data.json`. Run `scripts/backfill.ts` (Playwright) first to seed the full season history, then the cron takes over.
7. **First render** — `App.tsx` loads `data.json` via `useGroupData`, dump it as JSON to confirm wiring. Then build `SeasonGrid` to visualize.
8. **Filter** — `useRosterFilter` hook + `FilterCard` component. Connect to `SeasonGrid`.
9. **IO score + chart** — `scoring.ts`, then `IOScoreCard` and `IOChart`. Use the existing filter state.
10. **Pug list** — `PugCompanions`. Connect to the filter.
11. **Freshness indicator + manual refresh** — `FreshnessIndicator` + client-side refresh path.
12. **GitHub Actions cron** — `.github/workflows/refresh-data.yml`. Set up the repo and verify the cron runs.
13. **Vercel deploy** — connect repo, deploy, verify CDN-cached `data.json` loads.
14. **Quick presets** — populate the `FilterCard` presets based on the actual roster.

---

## 11. Roster

Confirmed from live API (`/api/v1/characters/profile`). Realm slugs from character page URLs.

```ts
export const ROSTER: RosterMember[] = [
  { id: 'sid',  name: 'Sonofsid',     realm: 'tichondrius', region: 'us', class: 'monk',         primaryRole: 'tank',   displayColor: '#00CC85' },
  { id: 'ny',   name: 'Nychar',       realm: 'aerie-peak',  region: 'us', class: 'shaman',       primaryRole: 'healer', displayColor: '#0070DD' },
  { id: 'meow', name: 'Meowmeowface', realm: 'tichondrius', region: 'us', class: 'druid',        primaryRole: 'healer', displayColor: '#FF7C0A' },
  { id: 'rune', name: 'Runesid',      realm: 'tichondrius', region: 'us', class: 'death-knight', primaryRole: 'dps',    displayColor: '#C41E3A' },
  { id: 'slak', name: 'Slakklom',     realm: 'tichondrius', region: 'us', class: 'rogue',        primaryRole: 'dps',    displayColor: '#D9B900' },
  { id: 'sono', name: 'Sonophpy',     realm: 'tichondrius', region: 'us', class: 'evoker',       primaryRole: 'dps',    displayColor: '#33937F' },
];
```

`primaryRole` is for display only (e.g. role icon next to the name chip in `FilterCard`). Players may flex — Nychar plays Restoration or Elemental, Runesid plays Frost or Unholy — but we don't track per-run role.

Note: Nychar is on a different realm (Aerie Peak) from the rest (Tichondrius).

---

## 12. Midnight Season 1 dungeons

```ts
export const SEASON_DUNGEONS: Dungeon[] = [
  // New (Midnight) — expansion_id 11
  { id: 'windrunner-spire',         name: "Windrunner Spire",         shortName: 'WS',   category: 'new' },
  { id: 'maisara-caverns',          name: "Maisara Caverns",          shortName: 'MC',   category: 'new' },
  { id: 'magisters-terrace',        name: "Magisters' Terrace",       shortName: 'MT',   category: 'new' },
  { id: 'nexuspoint-xenas',         name: "Nexus-Point Xenas",        shortName: 'NPX',  category: 'new' },
  // Legacy
  { id: 'algethar-academy',         name: "Algeth'ar Academy",        shortName: 'AA',   category: 'legacy' },
  { id: 'seat-of-the-triumvirate',  name: "Seat of the Triumvirate",  shortName: 'SEAT', category: 'legacy' },
  { id: 'skyreach',                 name: "Skyreach",                 shortName: 'SR',   category: 'legacy' },
  { id: 'pit-of-saron',             name: "Pit of Saron",             shortName: 'POS',  category: 'legacy' },
];
```

Slugs confirmed from `GET /api/v1/mythic-plus/static-data?expansion_id=11`. No normalizer needed — use the `slug` field from that endpoint directly if slugs ever diverge.

---

## 13. Open questions to revisit

- **Benchmark source:** confirm whether Raider.io exposes a clean "season cutoffs" endpoint or if we need to compute cutoffs from the leaderboard ourselves. If the latter, what page size and how many pages to fetch?
- **Region per player:** roster supports per-character region in the type but the season-start UTC is region-specific. Decide whether to support mixed-region rosters or assume single-region.
- **Character renames / realm transfers:** how to handle a player whose name changes mid-season. Probably maintain an aliases map keyed to the stable `id`.
- **Pug consolidation:** is "Mystic-Stormrage" and "Mýstic-Stormrage" the same character? Normalize names with diacritic stripping for matching.
- **Run history depth:** ~~RESOLVED~~ The public Raider.io API (`recent_runs`) is hard-capped at 10 runs. The Blizzard API (`mythic-keystone-profile/season/17`) returns only best-per-dungeon runs. The Raider.io character **website** (Next.js SSR) does embed the full season run history in React component props — verified empirically: 180 runs for Sonophpy, going back to the character's first season run (Apr 6). This full history is NOT accessible via any public API endpoint — only via browser-rendering the page. See §3 Backfill for the Playwright extraction approach. For the ongoing cron, the accumulation strategy (§3) remains the correct solution.
- **Time-zone display:** store all timestamps in UTC. For displayed "completed at" times, convert to user's local TZ.

---

## 14. Future enhancements (v2+)

- **Warcraftlogs integration:** deaths, interrupts, avoidable damage, performance percentiles
- **Hall of Fame / Shame:** auto-generated weekly awards (the GOAT, Stood in the Fire, Turbo, etc.)
- **Per-dungeon detail pages:** click a dungeon row to see all runs in that dungeon, route notes, best comp
- **Per-player profile pages:** individual breakdowns
- **Push notifications:** when a new highest key gets timed
- **Multi-season history:** archive past seasons, season-over-season comparison
- **Affix weekly view:** how the group performs by affix combination

---

## First message to send Claude Code

> Read `PROJECT_BRIEF.md` start to finish. Then scaffold the Vite + React + TypeScript project per §4, install Tailwind, and create the type definitions in `src/lib/types.ts` from §5. Don't fetch any data yet — I'll fill in the roster placeholders in §11 once the scaffold is up. Confirm when ready.
