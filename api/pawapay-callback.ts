import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const payload = request.body;
  if (!payload || typeof payload !== 'object') {
    return response.status(400).json({ error: 'Invalid pawaPay callback' });
  }

  const callback = payload as {
    depositId?: string;
    payoutId?: string;
    refundId?: string;
    status?: string;
    failureReason?: { failureCode?: string };
  };

  console.info('pawaPay callback received', {
    depositId: callback.depositId,
    payoutId: callback.payoutId,
    refundId: callback.refundId,
    status: callback.status,
    failureCode: callback.failureReason?.failureCode,
  });

  return response.status(200).json({ received: true });
}
