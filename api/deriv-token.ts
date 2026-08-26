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
    if (!tokenResponse.ok) {
      return response.status(tokenResponse.status).json({
        error: tokenData.error_description || tokenData.error || 'Deriv token exchange failed',
      });
    }

    if (!tokenData.access_token) return response.status(502).json({ error: 'Deriv did not return an access token' });

    const legacyResponse = await fetch('https://oauth.deriv.com/oauth2/legacy/tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const legacyData = await legacyResponse.json().catch(() => ({}));
    if (!legacyResponse.ok) {
      return response.status(legacyResponse.status).json({
        error: legacyData.error_description || legacyData.error || 'Deriv legacy token request failed',
      });
    }

    const legacyTokens = legacyData.tokens || legacyData.accounts || legacyData.data?.tokens || legacyData.data || legacyData;
    if (Array.isArray(legacyTokens)) {
      const normalizedTokens = legacyTokens.reduce((tokens: Record<string, string>, item: { loginid?: string; acct?: string; account?: string; account_id?: string; token?: string; access_token?: string; cur?: string; currency?: string }, index: number) => {
        const loginid = item.loginid || item.acct || item.account || item.account_id;
        const token = item.token || item.access_token;
        if (loginid && token) {
          const accountNumber = index + 1;
          tokens[`acct${accountNumber}`] = loginid;
          tokens[`token${accountNumber}`] = token;
          tokens[`cur${accountNumber}`] = item.cur || item.currency || 'USD';
        }
        return tokens;
      }, {});
      return response.status(200).json(normalizedTokens);
    }

    if (legacyTokens.loginid && (legacyTokens.token || legacyTokens.access_token)) {
      return response.status(200).json({
        acct1: legacyTokens.loginid,
        token1: legacyTokens.token || legacyTokens.access_token,
        cur1: legacyTokens.cur || legacyTokens.currency || 'USD',
      });
    }

    if (!legacyTokens.token1 || !legacyTokens.acct1) {
      return response.status(502).json({
        error: 'Deriv returned an unusable account session response',
        response_keys: Object.keys(legacyData),
      });
    }
    return response.status(200).json(legacyTokens);
  } catch (error) {
    console.error('Deriv token exchange request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv token service' });
  }
}
