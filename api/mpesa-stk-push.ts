import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initiateStkPush, normalizeKenyanPhone } from './_lib/daraja.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const phoneNumber = normalizeKenyanPhone(request.body?.phoneNumber);
  const kesAmount = Number(request.body?.kesAmount);
  const accountId = typeof request.body?.accountId === 'string' ? request.body.accountId.trim() : '';
  if (!phoneNumber) return response.status(400).json({ error: 'Use a valid Kenyan phone number' });
  if (!Number.isInteger(kesAmount) || kesAmount < 10 || kesAmount > 150000) {
    return response.status(400).json({ error: 'M-Pesa amount must be a whole number between 10 and 150000 KES' });
  }
  if (!accountId) return response.status(400).json({ error: 'Missing Deriv account ID' });

  try {
    const result = await initiateStkPush(phoneNumber, kesAmount, accountId);
    if (!result.ok || result.payload.ResponseCode !== '0') {
      console.error('Daraja STK Push rejected', {
        upstreamStatus: result.status,
        responseCode: result.payload.ResponseCode,
        errorCode: result.payload.errorCode,
        errorMessage: result.payload.errorMessage,
        responseDescription: result.payload.ResponseDescription,
        configuredEnvironment: process.env.DARAJA_ENVIRONMENT || 'sandbox',
        hasShortcode: Boolean(process.env.DARAJA_SHORTCODE),
        hasPasskey: Boolean(process.env.DARAJA_PASSKEY),
        hasCallbackUrl: Boolean(process.env.DARAJA_CALLBACK_URL),
      });
      return response.status(result.status >= 400 ? result.status : 502).json({ error: result.payload.errorMessage || result.payload.ResponseDescription || 'Safaricom STK Push failed' });
    }
    return response.status(200).json({
      message: result.payload.CustomerMessage || 'M-Pesa prompt sent. Complete it on your phone.',
      checkoutRequestId: result.payload.CheckoutRequestID,
      merchantRequestId: result.payload.MerchantRequestID,
      status: 'pending',
    });
  } catch (error) {
    console.error('Daraja STK Push failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      configuredEnvironment: process.env.DARAJA_ENVIRONMENT || 'sandbox',
      hasConsumerKey: Boolean(process.env.DARAJA_CONSUMER_KEY),
      hasConsumerSecret: Boolean(process.env.DARAJA_CONSUMER_SECRET),
      hasShortcode: Boolean(process.env.DARAJA_SHORTCODE),
      hasPasskey: Boolean(process.env.DARAJA_PASSKEY),
      hasCallbackUrl: Boolean(process.env.DARAJA_CALLBACK_URL),
    });
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Safaricom is not configured' });
  }
}
