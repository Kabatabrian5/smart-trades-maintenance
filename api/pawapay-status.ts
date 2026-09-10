import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pawapayErrorMessage, pawapayFetch } from './_lib/pawapay.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const depositId = Array.isArray(request.query.depositId) ? request.query.depositId[0] : request.query.depositId;
  if (!depositId) return response.status(400).json({ error: 'Missing depositId' });

  try {
    const result = await pawapayFetch(`/v2/deposits/${encodeURIComponent(depositId)}`);
    if (!result.ok) return response.status(result.status).json({ error: pawapayErrorMessage(result.payload, 'pawaPay status request failed') });
    const status = result.payload.status === 'COMPLETED' ? 'completed' : ['FAILED', 'REJECTED'].includes(result.payload.status) ? 'failed' : 'pending';
    return response.status(200).json({ status, providerStatus: result.payload.status, failureReason: result.payload.failureReason });
  } catch (error) {
    console.error('pawaPay status failed', { error: error instanceof Error ? error.message : 'Unknown error', depositId });
    return response.status(503).json({ error: error instanceof Error ? error.message : 'pawaPay status request failed' });
  }
}
