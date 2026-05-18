# mplus

A private dashboard for a 6-person WoW *Midnight* Mythic+ group. Tracks the season's runs across 8 dungeons × N weeks, the group's IO score vs Top 1% / 0.1% benchmarks, and the pugs we end up running with.

Built with Vite + React 19 + TypeScript + Tailwind 4. Data sourced from raider.io's public API. Deployed on Vercel.

## Local development

```bash
npm install
npm run dev           # http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run fetch-data` | Incremental refresh — pulls each character's recent + best runs, updates `public/data.json` |
| `npm run backfill` | Full Playwright scrape of every season run (~5 min) + API enrichment |
| `npm run backfill -- --skip-scrape` | API-only repair pass (~1 min); useful after data-shape changes |

## Deployment

`main` is deployed automatically on push by Vercel. A GitHub Actions workflow (`.github/workflows/refresh-data.yml`) re-runs `fetch-data` every 2 hours and commits any changes to `public/data.json`, which triggers a redeploy.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data-flow overview, file map, and design notes.
