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
    console.log('OIDC Token Response Keys:', Object.keys(tokenData));

    if (!tokenResponse.ok) {
      return response.status(tokenResponse.status).json({
        error: tokenData.error_description || tokenData.error || 'Deriv token exchange failed',
      });
    }

    if (!tokenData.access_token) {
      return response.status(502).json({ error: 'Deriv did not return an access token' });
    }

    // Build accounts mapping directly from OIDC token response or user token properties
    const accounts: Record<string, string> = {};
    
    // If Deriv passes account list in token response or we map access_token as token1
    accounts.token1 = tokenData.access_token;
    accounts.acct1 = tokenData.account_list?.[0]?.loginid || tokenData.local_id || tokenData.sub || 'CR_DEFAULT';
    accounts.cur1 = tokenData.account_list?.[0]?.currency || 'USD';

    // If there are multiple accounts returned in tokenData
    if (Array.isArray(tokenData.account_list)) {
      tokenData.account_list.forEach((acc: any, idx: number) => {
        accounts[`acct${idx + 1}`] = acc.loginid;
        accounts[`token${idx + 1}`] = acc.token || tokenData.access_token;
        accounts[`cur${idx + 1}`] = acc.currency || 'USD';
      });
    }

    return response.status(200).json(accounts);
  } catch (error) {
    console.error('Deriv token exchange request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv token service' });
  }
}
