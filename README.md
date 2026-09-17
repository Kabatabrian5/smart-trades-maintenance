# SmartTrades Maintenance

SmartTrades is a Vite + React + TypeScript trading dashboard for Deriv markets, designed around an AI-assisted market scanner, manual trading controls, live position monitoring, and bot-template recommendations.

This repository is the live maintenance branch for the SmartTrades product currently deployed at https://smart-trades.site.

## Product direction

The current app is focused on a hybrid trading workflow:

- AI market scanning and recommendations for Deriv synthetic indices
- Manual trade execution with clear control panels and live market feedback
- Position tracking and settlement updates from Deriv WebSocket events
- Bot template suggestions mapped to the visible strategy library
- A public static bot-builder route for templated strategy loading

The immediate priority is now manual trading perfection before further bot-builder expansion.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Deriv OAuth / WebSocket integrations
- Session persistence in the browser

## Repository and deployment

- GitHub: https://github.com/Kabatabrian5/smart-trades-maintenance
- Production site: https://smart-trades.site
- Local working directory: C:\Users\hp\smart-trades-maintenance
- Default deploy branch: main

## Local setup

```powershell
cd C:\Users\hp\smart-trades-maintenance
npm install
npm run dev -- --host 0.0.0.0
```

Validate a change with:

```powershell
cd C:\Users\hp\smart-trades-maintenance
npm run build
```

## Current app status

The repo is synced to the live GitHub remote and the working branch is aligned with `origin/main`.

Highlights in the current product flow:

- AI scanner flow exists and recommends a template based on the selected market
- Floating AI scan trigger is available from the main trading screen
- Manual trading flow is the current priority for tighter P/L math and trade-loop quality
- Public static bot-builder assets are separated from the SPA router to avoid route conflicts
- Positions and settlement updates are wired to real Deriv contract events
- Balance refresh and market/account switching continue to be refined

## Core files

- `src/App.tsx` – main trading UI, scanner flow, manual trade controls, positions, dashboard, and app routing
- `src/lib/botRegistry.ts` – market scanning and template recommendation engine
- `src/services/derivAccounts.ts` – Deriv account discovery and OTP request logic
- `src/services/derivSocket.ts` – Deriv WebSocket connection and trade data flow
- `src/components/layout/PositionsDrawer.tsx` – live positions drawer and settlement handling
- `public/bot-builder/index.html` – static public builder route used by the embedded template launcher
- `vercel.json` – deployment rewrite config and route exclusions

## Environment variables

Frontend environment variables used by the app:

```text
VITE_DERIV_CLIENT_ID
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_API_KEY
```

Server-side variables for API functions:

```text
DERIV_CLIENT_ID
DERIV_APP_ID
DERIV_CLIENT_SECRET
DERIPAY_API_KEY
```

Do not commit secrets or expose sensitive values in client-side environment variables.

## Current project focus

The next implementation passes are centered on manual trading quality:

1. Improve TP/SL automation and multi-cycle trade handling
2. Tighten one-trade-at-a-time versus looped execution modes
3. Fix P/L math so losing trades reduce net performance correctly
4. Improve mobile journal readability and chart interpretation
5. Keep the bot-builder work separate until the manual experience is fully refined

## Notes

- The repo is intentionally kept aligned to the live GitHub state before shipping UI changes.
- Build validation is the default proof step for safe changes.
- The project is currently being optimized around product usability and manual trading accuracy rather than isolated builder experimentation.
