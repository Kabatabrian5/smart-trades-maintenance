import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DERIPAY_API_KEY, deripayErrorMessage, deripayFetch } from './_lib/deripay';

const DERIV_APP_ID = process.env.DERIV_APP_ID;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  if (!DERIPAY_API_KEY) return response.status(503).json({ error: 'Deripay is not configured' });
  if (!DERIV_APP_ID || !/^\d+$/.test(DERIV_APP_ID)) return response.status(503).json({ error: 'A numeric DERIV_APP_ID is required for Deripay' });

  const { phoneNumber, usdAmount, loginid, userToken } = request.body || {};
  const amount = typeof usdAmount === 'number' ? usdAmount : Number(usdAmount);
  if (!/^254\d{9}$/.test(String(phoneNumber))) return response.status(400).json({ error: 'Use a Kenyan phone number beginning with 254' });
  if (!Number.isFinite(amount) || amount < 5 || amount > 10000) return response.status(400).json({ error: 'Deposit amount must be between 5 and 10000 USD' });
  if (typeof loginid !== 'string' || !loginid || typeof userToken !== 'string' || !userToken) return response.status(400).json({ error: 'Missing Deriv account credentials' });

  const body = JSON.stringify({ phoneNumber, usdAmount: amount, currency: 'USD', loginid, userToken, appId: DERIV_APP_ID });

  try {
    const result = await deripayFetch('POST', '/api/v1/deposit', body);
    if (!result.ok) return response.status(result.status).json({ error: deripayErrorMessage(result.payload, 'Deripay deposit request failed') });
    return response.status(200).json(result.payload);
  } catch (error) {
    console.error('Deripay deposit request failed:', error);
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to reach Deripay' });
  }
}
