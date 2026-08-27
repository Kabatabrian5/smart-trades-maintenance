# Smart Trades Project Handoff

## Repository and Deployment

Local project:
```text
C:\projects\smart-trades
GitHub repository:
https://github.com/Kabatabrian5/smart-trades-maintenance

Git remote:

Plaintext
[https://github.com/Kabatabrian5/smart-trades-maintenance.git](https://github.com/Kabatabrian5/smart-trades-maintenance.git)
Production domain:
https://smart-trades.site

The maintenance repository was replaced with the Smart Trades application. Vercel is connected to the maintenance repository and has successfully aliased the production deployment to smart-trades.site.

Recent commits:

Plaintext
8025c63 Fix Deriv OAuth and use real trading data
6223191 Use strict Deriv OAuth client and callback
e07c0cc Use registered Smart Trades OAuth app
Save future changes:

PowerShell
Set-Location "C:\projects\smart-trades"
git add -A
git commit -m "Describe the change"
git push origin main
Deploy production:

PowerShell
Set-Location "C:\projects\smart-trades"
vercel --prod
Technology
React

TypeScript

Vite

Tailwind CSS

Deriv WebSocket API

Deriv OAuth 2.0 with PKCE

Vercel serverless functions

Important files:

Plaintext
src/App.tsx
src/hooks/useDerivSocket.ts
src/services/derivSocket.ts
src/components/layout/PositionsDrawer.tsx
api/deriv-token.ts
vercel.json
package.json
User Interface
The app contains these navigation sections:

Plaintext
Manual trading
Positions
Signal
Dashboard
Bot Builder
Bots
Analysis was removed as a separate section because Signal now contains statistical analysis.

Desktop behavior:

Navigation stays in the header.

Manual trading uses the desktop workspace layout.

Positions is a separate page.

Bot Builder remains a multi-column workspace.

Mobile behavior:

Header is compact.

Navigation moves to the bottom.

Manual trading stacks vertically.

Digits are positioned near the market selector.

Bot Builder stacks its blocks menu, canvas, and summary panels vertically.

Manual Trading
Supported market catalog includes:

Volatility 10, 25, 50, 75, and 100

One-second Volatility markets

Boom markets

Crash markets

Jump markets

Step markets

Daily Reset markets

Range Break markets

Supported contract modes:

Plaintext
Matches / Differs
Even / Odd
Over / Under
Rise / Fall
Higher / Lower
Touch / No Touch
Manual trading includes:

Market selector

Digit selector

Tick count control

Stake input

Trade buttons

Authenticated balance display

Digit Counting Fix
The old implementation used:

TypeScript
price.toString().slice(-1)
That loses trailing zeroes. For example, 1220.20 can become 1220.2, causing the last digit to be reported incorrectly.

The current implementation formats prices using the market precision before extracting the final digit. Digit 0 is now counted correctly.

The relevant code is in:

Plaintext
src/hooks/useDerivSocket.ts
Signal Section
Signal has a market selector and performs a separate history request for the selected market.

It displays one-hour statistical rows for:

Matches/Differs

Even/Odd

Over/Under

Rise/Fall

Higher/Lower

Touch/No Touch

It also shows:

Even versus Odd frequency

Over versus Under frequency

Most common digit

Statistical suggestion

Animated signal engine state

Searching progress bar

Robotic browser-generated beep when switching markets

Signal output is statistical context only. It does not guarantee the next market outcome.

Positions
Positions was originally displayed as a left drawer beside Manual Trading. It was moved into its own Positions page.

The Positions page contains:

Summary

Transactions

Journal

Recorded open trades

Stake and contract information

Real trade positions are added only after Deriv returns a real successful buy response.

Positions are stored in browser session storage using:

Plaintext
smart-trades-positions
Real Trading Behavior
Fake ticks and fake trade responses were removed.

The old implementation created dummy responses such as:

Plaintext
mock-prop
contract_id: 123456
Live (Simulated)
The current implementation does not create fake contract IDs or fake successful trades. If Deriv is unavailable, a trade must fail instead of appearing successful.

Deriv OAuth & Architectural Findings
The registered Deriv OAuth application shown in the Deriv dashboard is:

Plaintext
Application: smartest trades
App ID: 34bIcDF1RsEKSAbKFKimH
Type: OAuth
Redirect URL: [https://smart-trades.site](https://smart-trades.site)
The redirect URL must match exactly and currently uses no trailing slash.

The app uses Deriv's current OAuth endpoint:

Plaintext
[https://auth.deriv.com/oauth2/auth](https://auth.deriv.com/oauth2/auth)
The request includes:

Plaintext
response_type=code
client_id=34bIcDF1RsEKSAbKFKimH
scope=trade account_manage payment
redirect_uri=[https://smart-trades.site](https://smart-trades.site)
state=...
code_challenge=...
code_challenge_method=S256
The OAuth flow is:

Generate a PKCE verifier.

Generate a PKCE challenge.

Generate and store an OAuth state value.

Redirect the user to Deriv.

Deriv shows login and authorization consent.

Deriv returns an authorization code to smart-trades.site.

The frontend sends the code to /api/deriv-token.

The server exchanges the code for an OIDC access token.

The server-side exchange is implemented in:

Plaintext
api/deriv-token.ts
Required Vercel variables:

Plaintext
DERIV_CLIENT_ID=34bIcDF1RsEKSAbKFKimH
VITE_DERIV_CLIENT_ID=34bIcDF1RsEKSAbKFKimH
Critical Discovery from Claude Troubleshooting Session:
Retired Legacy Endpoint: The old legacy token conversion endpoint (https://oauth.deriv.com/oauth2/legacy/tokens) is deprecated/dead (returning HTML landing pages instead of JSON tokens).

Modern Direction: Deriv has shifted away from the legacy WebSocket authorize pattern toward modern REST endpoints and OTP-backed socket transports (wss://api.derivws.com/trading/v1/...).

CORS Prevention: Direct browser REST calls to fetch accounts or mint OTPs trigger browser CORS blocks, causing application crashes/blank screens. Consequently, account listing and token mapping must be routed securely through serverless backend functions.

Balances
After authentication, the header is intended to show:

Plaintext
Real: ...
Demo: ...
Cashier
The Cashier button is hidden before login and appears after authentication.

The Cashier panel shows:

Login ID

Real balance

Demo balance

Currency

Balances use the Deriv WebSocket balance subscription:

TypeScript
{ balance: 1, subscribe: 1 }
Current limitation: Transitioning to independent real/demo account discovery via server-side endpoints to populate multi-account balances correctly.

Live Market Problem
The app previously used symbols such as R_100 or 1HZ100V, which returned InvalidSymbol. Requesting active symbols via public app ID 1089 ({ active_symbols: 'brief', product_type: 'basic' }) returned an empty list (active_symbols: []).

The app no longer simulates ticks, correctly reporting market connection errors instead of pretending feeds are live. This ties into the broader transition away from legacy transport streams.

Cashier and deripay
Cashier currently has UI only. deripay has not been integrated.

A production payment system requires a secure backend with:

deripay merchant credentials

Payment initiation endpoint

Mobile prompt handling

Webhook endpoint and verification

Payment status tracking and reconciliation

Never place payment credentials in browser code or VITE_ variables.

Local Testing
Start the development server:

PowerShell
Set-Location "C:\projects\smart-trades"
npm run dev -- --host 0.0.0.0
On the development computer:

Plaintext
http://localhost:5173/
On a phone connected to the same Wi-Fi:

Plaintext
[http://192.168.88.234:5173/](http://192.168.88.234:5173/)
Build validation:

PowerShell
npm run build
Current Status & Where We Have Reached
As of August 27, 2026, the project has reached this point:

The maintenance repository has been replaced with the Smart Trades application.

The application source is saved in GitHub at Kabatabrian5/smart-trades-maintenance.

Vercel production is connected to smart-trades.site.

Responsive desktop/mobile UI, Signal summaries, Positions tracking, and Bot Builder modules are functional.

Fake market ticks and fake trade responses have been entirely removed.

OAuth PKCE redirection and consent loops successfully return authorization codes.

Discovered that the legacy token bridge is retired; architecture requires routing modern account/OTP management via server-side proxies to prevent browser CORS crashes.

Completed:
Replaced maintenance repository contents with Smart Trades and pushed to GitHub.

Deployed to Vercel and aliased smart-trades.site.

Added responsive desktop/mobile layouts, compact mobile navigation, and mobile digit positioning.

Fixed digit zero-counting bug via market precision formatting.

Added Signal section and Positions page.

Removed all mock/fake ticks and simulated trade responses.

Configured OAuth PKCE flow and server-side token exchange handler.

Identified and documented the deprecation of the legacy token endpoint and the requirement for server-side REST/OTP proxies.

During a production login test on 27 August 2026, OAuth returned to Smart Trades and account loading reached the UI, but rendering failed because Deriv supplied `balance` as a string while the UI called `.toFixed()` directly. `src/App.tsx` now normalizes numeric balance values from account discovery and live balance messages before storage and rendering. `npm run build` passes with this fix.

Still Needs Work:
Deploy and repeat the production login test after the balance normalization fix.
Finalize server-side routing for modern account listing and OTP generation to prevent browser CORS crashes.

Complete independent real/demo account discovery and balance subscriptions.

Resolve empty Deriv active-symbol responses under modern routing.

Implement secure deripay cashier integration.
