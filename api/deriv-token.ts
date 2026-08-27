import type { VercelRequest, VercelResponse } from '@vercel/node';

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || process.env.VITE_DERIV_APP_ID || '34bIcDF1RsEKSAbKFKimH';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!DERIV_CLIENT_ID) return response.status(500).json({ error: 'Deriv OAuth client ID is not configured' });

  const { code, code_verifier, redirect_uri } = request.body || {};
  if (!code || !code_verifier || !redirect_uri) return response.status(400).json({ error: 'Missing OAuth callback fields' });

  try {
    // Step 1: exchange the authorization code for an OIDC access token.
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

    const accessToken = tokenData.access_token as string;

    // Step 22: exchange the OIDC access token for legacy account session tokens.
    // The legacy WebSocket `authorize` call does not accept an OIDC bearer token directly;
    // it needs the acct1/token1/cur1-style tokens returned by this endpoint.
    // This mirrors requestLegacyToken() in @deriv-com/auth-client.
    const legacyResponse = await fetch('https://oauth.deriv.com/oauth2/legacy/tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const legacyText = await legacyResponse.text();
    let legacyData: Record<string, unknown> = {};
    try {
      legacyData = legacyText ? JSON.parse(legacyText) : {};
    } catch {
      // Non-JSON body from Deriv; fall through and report diagnostics below.
    }

    const hasAccountTokens = Object.keys(legacyData).some((key) => /^token\d+$/.test(key));

    if (!legacyResponse.ok || !hasAccountTokens) {
      // Surface field names only (never token values) so we can align the parser
      // with whatever shape Deriv is actually returning, without logging secrets.
      return response.status(legacyResponse.status || 502).json({
        error: 'Deriv did not return usable legacy account tokens',
        deriv_error: (legacyData as { error?: string; error_description?: string }).error_description
          || (legacyData as { error?: string }).error
          || undefined,
        response_keys: Object.keys(legacyData),
      });
    }

    return response.status(200).json(legacyData);
  } catch (error) {
    console.error('Deriv token exchange request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv token service' });
  }
}
