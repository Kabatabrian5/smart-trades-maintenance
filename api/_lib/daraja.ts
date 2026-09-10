import { Buffer } from 'node:buffer';

const DARAJA_BASE_URL = process.env.DARAJA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let cachedToken: { value: string; expiresAt: number } | null = null;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function normalizeKenyanPhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  return null;
}

function darajaTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

async function darajaToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const credentials = `${required('DARAJA_CONSUMER_KEY')}:${required('DARAJA_CONSUMER_SECRET')}`;
  const response = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` },
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: string };
  if (!response.ok || !payload.access_token) throw new Error('Safaricom authorization failed');
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 3599) * 1000 };
  return cachedToken.value;
}

async function darajaRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${DARAJA_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await darajaToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

export async function initiateStkPush(phoneNumber: string, kesAmount: number, accountReference: string) {
  const shortcode = required('DARAJA_SHORTCODE');
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${shortcode}${required('DARAJA_PASSKEY')}${timestamp}`).toString('base64');
  return darajaRequest('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: process.env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    Amount: kesAmount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: required('DARAJA_CALLBACK_URL'),
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: 'Smart Trades deposit',
  });
}

export async function queryStkPush(checkoutRequestId: string) {
  const shortcode = required('DARAJA_SHORTCODE');
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${shortcode}${required('DARAJA_PASSKEY')}${timestamp}`).toString('base64');
  return darajaRequest('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  });
}
