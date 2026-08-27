import type { VercelRequest, VercelResponse } from '@vercel/node';

const DERIV_API_URL = 'https://api.derivws.com/trading/v1/options/accounts';
const DERIV_APP_ID = process.env.DERIV_APP_ID || process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || '34bIcDF1RsEKSAbKFKimH';

function getAccessToken(request: VercelRequest) {
  const authorization = request.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const accessToken = getAccessToken(request);
  const accountId = typeof request.body?.account_id === 'string' ? request.body.account_id.trim() : '';
  if (!accessToken) return response.status(401).json({ error: 'Missing Deriv access token' });
  if (!/^[A-Za-z0-9_-]+$/.test(accountId)) return response.status(400).json({ error: 'Invalid Deriv account ID' });

  try {
    const upstream = await fetch(`${DERIV_API_URL}/${encodeURIComponent(accountId)}/otp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Deriv-App-ID': DERIV_APP_ID,
      },
    });
    const data = await upstream.json().catch(() => ({ error: 'Invalid response from Deriv' }));
    return response.status(upstream.status).json(data);
  } catch (error) {
    console.error('Deriv OTP request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deriv OTP service' });
  }
}