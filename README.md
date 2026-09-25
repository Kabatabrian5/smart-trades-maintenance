# SmartTrades

SmartTrades is a Vite + React + TypeScript trading dashboard built for Deriv synthetic markets. The app combines a live manual trading workspace, AI-assisted signal scanning, bot editing, and a client/admin flow that keeps sensitive control actions behind a gated admin mode.

## Product overview

The current product focuses on:

- live Deriv market selection and tick monitoring
- manual contract selection for digit, over/under, and directional trades
- automated trade simulation and demo validation for admin review
- position tracking and journal/profit visualization
- bot template discovery and embeddable builder access
- mobile-first layout improvements for a native trading app feel

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Deriv OAuth and WebSocket integration
- Browser session persistence

## Local setup

```powershell
cd C:\projects\smart-trades
npm install
npm run dev -- --host 0.0.0.0
```

Validate a change with:

```powershell
cd C:\projects\smart-trades
npm run build
```

## Current repository / deployment notes

- Primary app folder: `C:\projects\smart-trades`
- Main deployment branch: `main`
- The app is designed to work with the live Vercel deployment tied to the active GitHub repo and branch.

## Key app behavior

### Client view

- Public trading dashboard is the default experience.
- Users can browse markets, open positions, run scans, and use the cashier flow.
- The app uses Deriv redirects and account selection to keep money handling on the official Deriv side rather than directly in the frontend.

### Admin view

- Admin mode is not openly exposed in normal client flow.
- Access is controlled by a hidden trigger in the footer that toggles between client and admin view.
- The default admin password is set from the environment variable `VITE_ADMIN_PASSWORD`; if not provided, the app falls back to `ben2026`.
- Once unlocked, the admin area shows a dedicated admin control strip for demo trade simulation and testing flows.

### Mobile UI refinement

Recent UI work centered on improving the native app feel:

- cleaner shell styling for the header and footer
- improved compact nav chips and action grouping
- clearer market and trade controls
- more polished visual hierarchy for mobile screens
- admin styling aligned with the shared client shell so the admin mode looks consistent with the rest of the app

## Important files

- `src/App.tsx` – main app shell, trading screens, admin gating, mobile layout, footer controls, and app state
- `src/hooks/useDerivSocket.ts` – live market tick subscription logic
- `src/services/derivAccounts.ts` – account discovery and OTP flow
- `src/services/derivSocket.ts` – Deriv WebSocket connection and execution helpers
- `src/components/layout/PositionsDrawer.tsx` – desktop positions drawer display
- `src/lib/botRegistry.ts` – signal scoring and bot recommendation logic
- `public/bot-builder/index.html` – embedded bot-builder route
- `vercel.json` – deployment routing and route exclusions

## Environment variables

Frontend variables:

```text
VITE_DERIV_CLIENT_ID
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_API_KEY
VITE_ADMIN_PASSWORD
```

Server-side / API variables:

```text
DERIV_CLIENT_ID
DERIV_APP_ID
DERIV_CLIENT_SECRET
DERIPAY_API_KEY
```

Do not commit secrets or expose sensitive values in client-side environment variables.

## Notes

- The UI has been refocused on a cleaner mobile-first trading experience.
- Admin access is intentionally hidden from regular client users.
- Demo/testing actions are placed inside the admin workspace so product flows remain easier to validate without exposing management controls to the general customer view.
- Build validation remains the standard proof step before shipping UI changes.
