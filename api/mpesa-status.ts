import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryStkPush } from './_lib/daraja.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const checkoutRequestId = Array.isArray(request.query.checkoutRequestId) ? request.query.checkoutRequestId[0] : request.query.checkoutRequestId;
  if (!checkoutRequestId) return response.status(400).json({ error: 'Missing checkoutRequestId' });

  try {
    const result = await queryStkPush(checkoutRequestId);
    const resultCode = String(result.payload.ResultCode ?? '');
    const status = resultCode === '' || result.payload.ResponseCode === '0' && result.payload.ResultCode === undefined
      ? 'pending'
      : resultCode === '0' ? 'completed' : 'failed';
    return response.status(result.ok ? 200 : 502).json({ status, resultCode, message: result.payload.ResultDesc || result.payload.errorMessage });
  } catch (error) {
    console.error('Daraja STK status query failed:', error);
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Safaricom status query failed' });
  }
}
