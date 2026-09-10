import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const callback = request.body?.Body?.stkCallback;
  if (!callback || typeof callback.CheckoutRequestID !== 'string') {
    return response.status(400).json({ error: 'Invalid Safaricom callback' });
  }

  console.info('Daraja STK callback received', {
    checkoutRequestId: callback.CheckoutRequestID,
    merchantRequestId: callback.MerchantRequestID,
    resultCode: callback.ResultCode,
  });

  return response.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
}