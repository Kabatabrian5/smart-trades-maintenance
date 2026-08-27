import type { VercelRequest, VercelResponse } from '@vercel/node';

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || process.env.VITE_DERIV_APP_ID || '34bIcDF1RsEKSAbKFKimH';

type TokenRecord = Record<string, unknown>;

function findLegacyAccounts(value: unknown, accounts: Record<string, string> = {}, index = { value: 0 }) {
  if (!value || typeof value !== 'object') return accounts;
  if (Array.isArray(value)) {
    value.forEach((item) => findLegacyAccounts(item, accounts, index));
    return accounts;
  }

  const record = value as TokenRecord;
  if (typeof record.acct1 === 'string' && typeof record.token1 === 'string') {
    return Object.keys(record).reduce((tokens: Record<string, string>, key) => {
      const item = record[key];
      if (typeof item === 'string') tokens[key] = item;
      return tokens;
    }, {});
  }

  const loginid = record.loginid || record.acct || record.account || record.account_id;
  const token = record.token || record.oauth_token || record.session_token || record.access_token;
  if (typeof loginid === 'string' && typeof token === 'string') {
    index.value += 1;
    accounts[`acct${index.value}`] = loginid;
    accounts[`token${index.value}`] = token;
    accounts[`cur${index.value}`] = typeof record.cur === 'string' ? record.cur : typeof record.currency === 'string' ? record.currency : 'USD';
    return accounts;
  }

  Object.entries(record).forEach(([key, item]) => {
    if (/^(CR|CRW|MF|MFW|VR|VRT|VRW)\w+$/i.test(key) && typeof item === 'string') {
      index.value += 1;
      accounts[`acct${index.value}`] = key;
      accounts[`token${index.value}`] = item;
      accounts[`cur${index.value}`] = 'USD';
      return;
    }
    findLegacyAccounts(item, accounts, index);
  });
  return accounts;
}

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

    // Request legacy tokens using POST with correct headers & body if required by Deriv OIDC spec
    const legacyResponse = await fetch('https://oauth.deriv.com/oauth2/legacy/tokens', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target_client_id: DERIV_CLIENT_ID })
    });

    const rawText = await legacyResponse.text();
    console.log('Legacy Token Raw Response Text:', rawText);

    let legacyData: any = {};
    try {
      legacyData = JSON.parse(rawText);
    } catch (e) {
      legacyData = { raw: rawText };
    }

    if (!legacyResponse.ok) {
      return response.status(legacyResponse.status).json({ 
        error: 'Deriv legacy token request failed',
        details: legacyData 
      });
    }

    const accounts = findLegacyAccounts(legacyData);
    
    // Fallback: If legacy endpoint returns token directly inside tokenData or array items
    if (!accounts.token1 || !accounts.acct1) {
      if (tokenData.token && tokenData.account_list) {
        // Map tokenData accounts directly if available
        tokenData.account_list.forEach((acc: any, idx: number) => {
          accounts[`acct${idx + 1}`] = acc.loginid;
          accounts[`token${idx + 1}`] = acc.token;
          accounts[`cur${idx + 1}`] = acc.currency || 'USD';
        });
      }
    }

    if (!accounts.token1 || !accounts.acct1) {
      return response.status(502).json({ 
        error: 'Deriv returned no usable account session token', 
        raw_response: rawText.slice(0, 400)
      });
    }

    return response.status(200).json(accounts);
  } catch (error) {
    console.error('Deriv token exchange request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv token service' });
  }
}
