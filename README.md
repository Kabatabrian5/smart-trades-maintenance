# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # Smartest Trades

  Production web trading client for Deriv Options.

  ## Repositories and deployment

  - GitHub: https://github.com/Kabatabrian5/smart-trades-maintenance
  - Production: https://smart-trades.site
  - Local path: `C:\projects\smart-trades`
  - Deployment: Vercel follows `main` automatically.

  ## Run locally

  ```powershell
  Set-Location "C:\projects\smart-trades"
  npm install
  npm run dev -- --host 0.0.0.0
  ```

  Validate a change:

  ```powershell
  npm run build
  ```

  The production build is the reliable validation command. `npm run lint` currently reports older repository-wide issues in `App.tsx` and `useDerivSocket.ts`; do not treat those unrelated findings as a reason to undo working changes.

  ## Current trading behavior

  - OAuth 2.0 PKCE login uses the modern Deriv OIDC flow.
  - Account discovery and authenticated WebSocket URLs use `api.derivws.com` REST/OTP endpoints.
  - Manual proposals use `underlying_symbol`, not the retired `symbol` proposal field.
  - A successful trade is recorded only after Deriv returns a real buy response.
  - After every successful buy, the app opens the Positions section automatically.
  - Positions react to `proposal_open_contract` updates with tick progress, live P/L, contract value, payout, and final win/loss status.
  - The balance is refreshed after buy and after settlement.
  - Real/demo switching requests a fresh OTP WebSocket connection for the selected account.
  - Positions are persisted in browser session storage under `smart-trades-positions`.

  ## Important files

  - `src/App.tsx`: application state, OAuth, account switching, cashier, trade placement, and Positions page.
  - `src/services/derivAccounts.ts`: modern account discovery and OTP requests.
  - `src/services/derivSocket.ts`: WebSocket transport, buy, balance, and contract subscriptions.
  - `src/components/layout/PositionsDrawer.tsx`: desktop reactive Positions drawer.
  - `api/deriv-token.ts`: server-side OAuth code exchange.
  - `api/deripay-deposit.ts`: server-side deposit request signing and forwarding.
  - `api/deripay-status.ts`: payment status proxy.
  - `PROJECT_HANDOFF.md`: detailed architecture and outstanding work.

  ## Environment variables

  Frontend:

  ```text
  VITE_DERIV_CLIENT_ID
  VITE_GOOGLE_CLIENT_ID
  VITE_GOOGLE_API_KEY
  ```

  Server-only Vercel variables:

  ```text
  DERIV_CLIENT_ID
  DERIV_APP_ID          # separate numeric legacy ID for DeriPay only
  DERIV_CLIENT_SECRET
  DERIPAY_API_KEY
  ```

  Never expose DeriPay keys, Deriv secrets, or user tokens in `VITE_` variables or committed files. The modern OAuth client ID is alphanumeric and must not be used as DeriPay's numeric `appId`.

  ## Latest deployment

  Latest pushed commit: `081c795 Open reactive positions after trades`.

  Recent fixes include the modern proposal field (`fda746c`), real/demo switching (`d8f2bdc`), and reactive Positions navigation and settlement display (`081c795`).

  ## Next work

  1. Verify the reactive Positions flow on production with demo and real accounts.
  2. Confirm modern OIDC token compatibility with DeriPay before enabling live deposits.
  3. Finish DeriPay transaction polling/webhooks and withdrawal verification.
  4. Reconcile live balance/account identity behavior across account switches.
  5. Add focused tests for proposal payloads, settlement updates, and account switching.

  ## Cashier status

  The Cashier UI and payment endpoints are currently paused and hidden from users while the funding architecture is being verified.

  - DeriPay requires a compatible numeric Deriv App ID bound to its API key and a Deriv token with the `payments` scope. The current modern OAuth client ID has not been confirmed compatible.
  - pawaPay provides documented mobile-money APIs, but its documented Kenya `MPESA_KEN` configuration is payouts-only for the current account; Kenya deposits are not confirmed.
  - No payment should be treated as a Deriv credit until the payment provider, Deriv Payment Agent authorization, webhook reconciliation, and durable transaction storage are verified.
  - Daraja sandbox code remains available for investigation but is not a production funding path. The sandbox shortcode `174379` must never be used for live payments.

  Do not enable the Cashier again until one provider confirms Kenya deposits and the Deriv settlement path is tested end to end.
