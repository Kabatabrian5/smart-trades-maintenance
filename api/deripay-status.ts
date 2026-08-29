import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DERIPAY_API_KEY, deripayErrorMessage, deripayFetch } from './_lib/deripay';

// GET /api/deripay-status?transactionId=... — checks a Deripay transaction's real settlement
// state. Used both for polling after a deposit prompt and for populating the History tab.
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (!DERIPAY_API_KEY) return response.status(503).json({ error: 'Deripay is not configured' });

  const transactionId = Array.isArray(request.query.transactionId) ? request.query.transactionId[0] : request.query.transactionId;
  if (!transactionId) return response.status(400).json({ error: 'Missing transactionId' });

  try {
    const result = await deripayFetch('GET', `/api/v1/transactions/${encodeURIComponent(transactionId)}`);
    if (!result.ok) return response.status(result.status).json({ error: deripayErrorMessage(result.payload, 'Deripay status request failed') });
    return response.status(200).json(result.payload);
  } catch (error) {
    console.error('Deripay status request failed:', error);
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to reach Deripay' });
  }
}
