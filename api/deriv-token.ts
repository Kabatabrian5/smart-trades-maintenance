import type { VercelRequest, VercelResponse } from '@vercel/node';

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || process.env.VITE_DERIV_APP_ID || '34bIcDF1RsEKSAbKFKimH';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!DERIV_CLIENT_ID) return response.status(500).json({ error: 'Deriv OAuth client ID is not configured' });

  const { code, code_verifier, redirect_uri } = request.body || {};
  if (!code || !code_verifier || !redirect_uri) return response.status(400).json({ error: 'Missing OAuth callback fields' });

  try {
    // Exchange the authorization code for an OIDC access token.
    //
    // NOTE: Deriv's OAuth flow now stops here. The legacy `/oauth2/legacy/tokens` bridge that
    // used to convert this into acct1/token1/cur1-style legacy WebSocket tokens has been
    // retired — that host now serves Deriv's marketing site instead of an API. The frontend
    // is responsible for using this access_token against the current REST API (list accounts,
    // then mint a per-account OTP WebSocket URL) instead of the old legacy `authorize` call.
    // See src/services/derivAccounts.ts.
    const tokenResponse = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: DERIV_CLIENT_ID,
        code,
        code_verifier,
        redirect_uri,
      }),
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      return response.status(tokenResponse.status || 502).json({
        error: tokenData.error_description || tokenData.error || 'Deriv token exchange failed',
      });
    }

    return response.status(200).json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
    });
  } catch (error) {
    console.error('Deriv token exchange request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv token service' });
  }
}
