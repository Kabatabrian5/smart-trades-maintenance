import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pawapayErrorMessage, pawapayFetch } from './_lib/pawapay.js';

function normalizeKenyanPhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  return null;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const phoneNumber = normalizeKenyanPhone(request.body?.phoneNumber);
  const amount = Number(request.body?.kesAmount);
  const accountId = typeof request.body?.accountId === 'string' ? request.body.accountId.trim() : '';
  const provider = process.env.PAWAPAY_PROVIDER;
  if (!phoneNumber) return response.status(400).json({ error: 'Use a valid Kenyan phone number' });
  if (!Number.isInteger(amount) || amount < 10 || amount > 150000) return response.status(400).json({ error: 'M-Pesa amount must be a whole number between 10 and 150000 KES' });
  if (!accountId) return response.status(400).json({ error: 'Missing Deriv account ID' });
  if (!provider) return response.status(503).json({ error: 'PAWAPAY_PROVIDER is not configured' });

  const depositId = randomUUID();
  try {
    const result = await pawapayFetch('/v2/deposits', {
      method: 'POST',
      body: JSON.stringify({
        depositId,
        payer: { type: 'MMO', accountDetails: { phoneNumber, provider } },
        amount: String(amount),
        currency: 'KES',
        clientReferenceId: accountId,
        customerMessage: 'Smart Trades deposit',
        metadata: [{ accountId }],
      }),
    });
    if (!result.ok || !['ACCEPTED', 'DUPLICATE_IGNORED'].includes(result.payload.status)) {
      console.error('pawaPay deposit rejected', { upstreamStatus: result.status, depositId, status: result.payload.status, failureCode: result.payload.failureReason?.failureCode });
      return response.status(result.status >= 400 ? result.status : 502).json({ error: pawapayErrorMessage(result.payload, 'pawaPay deposit request failed') });
    }
    return response.status(200).json({ depositId, status: result.payload.status, message: 'Payment request sent. Complete it on your phone.' });
  } catch (error) {
    console.error('pawaPay deposit failed', { error: error instanceof Error ? error.message : 'Unknown error', depositId });
    return response.status(503).json({ error: error instanceof Error ? error.message : 'pawaPay is not configured' });
  }
}
