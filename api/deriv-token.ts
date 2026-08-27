import type { VercelRequest, VercelResponse } from '@vercel/node';

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || process.env.VITE_DERIV_APP_ID || '34bIcDF1RsEKSAbKFKimH';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!DERIV_CLIENT_ID) return response.status(500).json({ error: 'Deriv OAuth client ID is not configured' });

  const { code, code_verifier, redirect_uri } = request.body || {};
  if (!code || !code_verifier || !redirect_uri) return response.status(400).json({ error: 'Missing OAuth callback fields' });

  try {
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

    // Return the OIDC access token directly as token1 so the WebSocket authorize method can use it
    const accounts: Record<string, string> = {
      token1: tokenData.access_token,
      acct1: tokenData.local_id || tokenData.account_id || 'OIDC_USER',
      cur1: 'USD'
    };

    return response.status(200).json(accounts);
  } catch (error) {
    console.error('Deriv token exchange request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv token service' });
  }
}
