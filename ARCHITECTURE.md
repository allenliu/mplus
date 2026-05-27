# Architecture

## Data flow

```
raider.io API
     │
     ▼
GitHub Actions cron (every 2h)
  scripts/fetch-data.ts
     │
     ▼
public/data.json  ←──── one-time seeded by  scripts/backfill.ts
     │  (committed by the workflow if changed)
     ▼
Vercel build & deploy on push to main
     │
     ▼
Browser fetches /data.json
     │
     ▼
useGroupData hook
  ↳ paints from localStorage immediately
  ↳ revalidates from network
     │
     ▼
React components (App.tsx → SeasonGrid / IOScoreCard / RecentRuns / PugCompanions)
```

`data.json` is the single source of truth. The cron only ever adds runs (keyed by `keystone_run_id`) and updates the current-week benchmark — historical runs are immutable.

## Key files

```
src/
├── App.tsx                            # composes the page
├── hooks/
│   ├── useGroupData.ts                # fetch /data.json, localStorage cache, revalidate
│   └── useRosterFilter.ts             # roster + group-size filter state
├── lib/
│   ├── types.ts                       # GroupData / Run / Dungeon / RosterMember
│   ├── roster.ts                      # characters + player groupings + 8 dungeons
│   ├── raiderio.ts                    # API client
│   ├── groupRuns.ts                   # buildRun + applyRoster (Rio → Run)
│   ├── scoring.ts                     # FilterState + runMatchesFilter + computeGroupIO
│   ├── resets.ts                      # week-of-season math
│   └── classColors.ts                 # WoW class color palette
├── components/
│   ├── FilterCard.tsx                 # player/character chips + group-size pills (mode toggle)
│   ├── SeasonGrid.tsx                 # 8 dungeons × N weeks heat map + hover/tap card
│   ├── RunHoverCard.tsx               # flyout details (used by SeasonGrid + RecentRuns)
│   ├── IOScoreCard.tsx                # big number + deltas + cutoffs
│   ├── IOChart.tsx                    # SVG chart with dynamic Y axis
│   ├── RecentRuns.tsx                 # last 5 runs matching the filter
│   ├── PugCompanions.tsx              # top 10 pug players we've played with
│   └── FreshnessIndicator.tsx         # "last updated N min ago"

scripts/
├── fetch-data.ts                      # incremental refresh (cron + manual)
└── backfill.ts                        # full season scrape (Playwright + API)

.github/workflows/refresh-data.yml     # cron + commit + push
public/data.json                       # the data
```

## Notable design decisions

**Static JSON over a real backend.** The dataset is small (currently ~400 runs, ~300 KB) and read-only from the user's perspective. Shipping it as a static asset means zero server cost and free CDN caching; the cron workflow is the only "writer."

**localStorage first paint.** `useGroupData` paints from cached data immediately on load, then fetches `/data.json` in the background and swaps in any newer version. Makes repeat visits feel instant.

**`keystone_run_id` as the dedup key.** Every Rio run has a globally unique numeric ID. Used as the Map key when merging incremental fetches with the existing dataset, so the same run never appears twice.

**Backfill via Playwright fiber-walking, not the API.** raider.io's public API caps `recent_runs` at 10 per character. To seed the full season we scrape the React fiber tree on each character's profile page — the SSR'd `memoizedProps.runs` array contains every run for the season. Then we hit the `/run-details` API per ID to enrich with roster + score + dungeon timer.

**Roster matching by name + realm.** A run's roster slot includes character name + realm slug. We match against our 6-person roster case-insensitively; anyone unmatched is classified as a pug.

**Dynamic Y axis on the IO chart.** Hard-coding `Y_MAX = 4500` wasted half the chart while the group climbed from 2.8k → 3.8k. The chart now snaps to the data's actual range, rounded to "nice" gridline steps (50, 100, 250, 500, 1000), giving 4-6 horizontal lines.

**Benchmarks come from `graphData.p990/p999`, not the simple cutoffs endpoint.** The public `season-cutoffs` API only returns current point-in-time values. The cutoffs *page* embeds a hidden `graphData` field with 53 daily snapshots — we scrape that once during backfill and bucket by reset week to get a real per-week benchmark curve.

**Hover on desktop, tap-to-pin on mobile.** `matchMedia('(hover: hover)')` decides which mode at mount. Hover devices see a transient preview card (cell click opens raider.io directly); touch devices tap a cell to pin the card (with a close × and a tap-outside-to-dismiss listener), and the card's "Open on raider.io" button is the actual follow-up action.

**Player vs character filter.** Each player owns 1–3 characters in the roster. A segmented control toggles between character mode (default, finer-grained — "Sonofsid runs but not Runesid") and player mode (fewer chips, one player passes if any of their characters is in the run). The public dashboard shows player acronyms, not full names. Switching modes clears the required set since the two namespaces don't overlap meaningfully. On mobile the chip row scrolls horizontally with a fade-mask hint; on `sm+` it wraps as before.

**No exclusion filter.** Originally the roster chips had a tri-state (require / exclude / neutral). Trimmed to two states (require / neutral) — exclusion was a niche use case that introduced more cognitive load than value for a friend group dashboard.
