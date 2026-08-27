import { createHash, createHmac } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DERIPAY_BASE_URL = process.env.DERIPAY_BASE_URL || 'https://deripay.site';
const DERIPAY_API_KEY = process.env.DERIPAY_API_KEY;
const DERIV_APP_ID = process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_CLIENT_ID || '34bIcDF1RsEKSAbKFKimH';

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') return payload.message;
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!DERIPAY_API_KEY) return response.status(503).json({ error: 'Deripay is not configured' });

  const { phoneNumber, usdAmount, loginid, userToken } = request.body || {};
  const amount = typeof usdAmount === 'number' ? usdAmount : Number(usdAmount);
  if (!/^254\d{9}$/.test(String(phoneNumber))) return response.status(400).json({ error: 'Use a Kenyan phone number beginning with 254' });
  if (!Number.isFinite(amount) || amount < 5 || amount > 10000) return response.status(400).json({ error: 'Deposit amount must be between 5 and 10000 USD' });
  if (typeof loginid !== 'string' || !loginid || typeof userToken !== 'string' || !userToken) return response.status(400).json({ error: 'Missing Deriv account credentials' });

  const body = JSON.stringify({ phoneNumber, usdAmount: amount, currency: 'USD', loginid, userToken, appId: DERIV_APP_ID });
  const timestamp = new Date().toISOString();
  const separator = DERIPAY_API_KEY.indexOf(':');
  if (separator < 1) return response.status(500).json({ error: 'Invalid Deripay API key configuration' });
  const secret = DERIPAY_API_KEY.slice(separator + 1);
  const path = '/api/v1/deposit';
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const signingPayload = `${timestamp}\nPOST\n${path}\n${bodyHash}`;
  const signature = createHmac('sha256', secret).update(signingPayload).digest('hex');

  try {
    const upstream = await fetch(`${DERIPAY_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': DERIPAY_API_KEY, 'X-Timestamp': timestamp, 'X-Signature': signature },
      body,
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return response.status(upstream.status).json({ error: errorMessage(payload, 'Deripay deposit request failed') });
    return response.status(200).json(payload);
  } catch (error) {
    console.error('Deripay deposit request failed:', error);
    return response.status(502).json({ error: 'Unable to reach Deripay' });
  }
}