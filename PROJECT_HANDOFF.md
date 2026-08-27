Here is the updated comprehensive project handoff document, incorporating all of the detailed technical context, architecture specifications, file paths, and current status notes you provided, while ensuring that all original components and handoff details remain fully intact.

Smart Trades Project Handoff
Repository and Deployment
Local project:

Plaintext
C:\projects\smart-trades
GitHub repository:
https://github.com/Kabatabrian5/smart-trades-maintenance

Git remote:

Plaintext
https://github.com/Kabatabrian5/smart-trades-maintenance.git
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

Deriv OAuth
The registered Deriv OAuth application shown in the Deriv dashboard is:

Plaintext
Application: smartest trades
App ID: 34bIcDF1RsEKSAbKFKimH
Type: OAuth
Redirect URL: https://smart-trades.site
The redirect URL must match exactly and currently uses no trailing slash.

The app uses Deriv's current OAuth endpoint:

Plaintext
https://auth.deriv.com/oauth2/auth
The request includes:

Plaintext
response_type=code
client_id=34bIcDF1RsEKSAbKFKimH
scope=trade account_manage payment
redirect_uri=https://smart-trades.site
state=...
code_challenge=...
code_challenge_method=S256
The OAuth flow is:

Generate a PKCE verifier.

Generate a PKCE challenge.

Generate and store an OAuth state value.

Redirect the user to Deriv.

Deriv shows login.

Deriv shows Smart Trades authorization consent.

Deriv returns an authorization code.

The frontend sends the code to /api/deriv-token.

The server exchanges the code for an access token.

The frontend authorizes the Deriv WebSocket.

The server-side exchange is implemented in:

Plaintext
api/deriv-token.ts
Required Vercel variables:

Plaintext
DERIV_CLIENT_ID=34bIcDF1RsEKSAbKFKimH
VITE_DERIV_CLIENT_ID=34bIcDF1RsEKSAbKFKimH
Current OAuth Problem
The user reported this sequence:

Smart Trades opens Deriv login.

User enters credentials.

Deriv shows the Smart Trades authorization screen.

User authorizes.

Smart Trades says the user could not be logged in.

This means the authorization redirect is working. The remaining issue is after consent, likely one of:

/api/deriv-token returns an error.

Vercel environment variables are missing.

Deriv rejects the token exchange.

The returned OAuth token cannot be used with the legacy WebSocket authorize method.

The production callback or client ID differs from the registered values.

The current production failure is:

Plaintext
Deriv login could not be completed: Deriv returned no usable account session token
The browser reaches Deriv login and consent successfully, then /api/deriv-token returns HTTP 502 while converting the OIDC access token into legacy account session tokens. The app accepts alphanumeric client IDs such as CR..., VRTC..., MF..., and CRW...; the 1 in acct1 and token1 is only the account position, not a numeric client ID requirement.

Deriv's official @deriv-com/auth-client performs this sequence:

requestOidcAuthentication redirects to the current OIDC endpoint.

requestOidcToken exchanges the callback code for an OIDC access token.

requestLegacyToken sends that access token to /oauth2/legacy/tokens.

The returned legacy token fields are passed to WebSocket authorize.

Smart Trades currently implements steps 1 and 2 and calls /oauth2/legacy/tokens, but the returned response does not match the known acct1/token1/cur1 shape. The next debugging step is to inspect the non-secret response field names and align the parser with the exact production response. Do not log or expose token values.

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
Current limitation: OAuth currently returns one access token and does not yet discover and authorize all real and demo accounts independently. Completing this requires:

Getting all authorized accounts.

Storing each account token separately.

Creating independent connections or switching authorization safely.

Requesting each account's balance.

Updating Real and Demo cards independently.

Live Market Problem
The app previously used symbols such as:

Plaintext
R_100
1HZ100V
Deriv returned:

Plaintext
InvalidSymbol
The app tried the public WebSocket app ID:

Plaintext
1089
It requests:

TypeScript
{ active_symbols: 'brief', product_type: 'basic' }
Deriv returned an empty list:

Plaintext
active_symbols: []
The app no longer simulates ticks. It now reports market errors instead of pretending the feed is live.

Next investigation:

Confirm the current Deriv WebSocket app ID.

Confirm the correct active-symbol request format.

Check whether product_type should be omitted or changed.

Verify current symbol names from Deriv.

Check whether the account or region affects available symbols.

Consider using the newer Deriv API instead of the legacy WebSocket endpoint.

Cashier and deripay
Cashier currently has UI only.

deripay has not been integrated.

A production payment system requires a secure backend with:

deripay merchant credentials

Payment initiation endpoint

Mobile prompt handling

Webhook endpoint

Webhook signature verification

Payment status tracking

Duplicate-payment protection

Reconciliation with Deriv deposits

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
http://192.168.88.234:5173/
Build validation:

PowerShell
npm run build
Current Status & Where We Have Reached
As of August 27, 2026, the project has reached this point:

The maintenance repository has been replaced with the Smart Trades application.

The application source is saved in GitHub at Kabatabrian5/smart-trades-maintenance.

Vercel production is connected to smart-trades.site.

The responsive interface is implemented for desktop and mobile.

Manual Trading, Positions, Signal, Dashboard, Bot Builder, and Bots are available.

Signal supports per-market one-hour statistical summaries.

Positions records only real Deriv buy responses; fake trades were removed.

Fake market ticks were removed; the app now reports market connection failures.

Deriv OAuth now reaches the login and Smart Trades authorization screens.

The current OAuth request reaches the modern Deriv consent screen and returns an OIDC code to smart-trades.site.

The current OAuth issue is the server-side legacy-token conversion returning an unexpected response shape and HTTP 502; repeated attempts consume one-time OAuth codes.

The app's real-market WebSocket implementation from commit 8025c63 remains in src/services/derivSocket.ts and src/hooks/useDerivSocket.ts; fresh production pages have shown Status: Live, while some catalog symbols still return InvalidSymbol.

Real/Demo balances and Cashier UI exist, but account discovery, fully independent balances, and deripay payment processing are not complete.

Completed:
Replaced maintenance repository contents with Smart Trades.

Pushed project to GitHub.

Deployed to Vercel.

Connected smart-trades.site to the Vercel deployment.

Added responsive desktop/mobile layout.

Added compact mobile navigation.

Improved mobile digit placement.

Made Bot Builder responsive.

Added market and contract selectors.

Fixed digit zero counting.

Added Signal section.

Added Positions page.

Removed fake ticks.

Removed fake trade responses.

Added OAuth PKCE flow.

Added server-side OAuth token exchange.

Added Real/Demo balance UI.

Set the exact Deriv login and signup destinations.

Compared the OAuth and live-market files with commits e07c0cc and 8025c63.

Confirmed the current login uses [https://auth.deriv.com/oauth2/auth](https://auth.deriv.com/oauth2/auth) with PKCE.

Added server-side legacy-token conversion and safe response diagnostics.

Pushed OAuth changes to GitHub in commits edefcc5, 7c1dd16, and d76faf4.

Still Needs Work:
Diagnose the unexpected /oauth2/legacy/tokens response shape without exposing token values.

Verify Vercel OAuth environment variables.

Complete independent real/demo account discovery.

Complete independent real/demo balance subscriptions.

Resolve empty Deriv active-symbol response.

Verify real trading with an authenticated account.

Implement secure deripay cashier integration.
