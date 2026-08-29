import { createHash, createHmac } from 'node:crypto';

export const DERIPAY_BASE_URL = process.env.DERIPAY_BASE_URL || 'https://deripay.site';
export const DERIPAY_API_KEY = process.env.DERIPAY_API_KEY;

export function deripayErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') return payload.message;
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

/** Deripay's signed request scheme: X-Signature = HMAC-SHA256(secret, `${timestamp}\n${method}\n${path}\n${sha256(body)}`) */
export function signDeripayRequest(method: string, path: string, body: string) {
  if (!DERIPAY_API_KEY) throw new Error('Deripay is not configured');
  const separator = DERIPAY_API_KEY.indexOf(':');
  if (separator < 1) throw new Error('Invalid Deripay API key configuration');
  const secret = DERIPAY_API_KEY.slice(separator + 1);
  const timestamp = new Date().toISOString();
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const signingPayload = `${timestamp}\n${method}\n${path}\n${bodyHash}`;
  const signature = createHmac('sha256', secret).update(signingPayload).digest('hex');
  return { timestamp, signature };
}

export async function deripayFetch(method: string, path: string, body?: string) {
  const { timestamp, signature } = signDeripayRequest(method, path, body || '');
  const headers: Record<string, string> = { 'X-API-Key': DERIPAY_API_KEY!, 'X-Timestamp': timestamp, 'X-Signature': signature };
  if (body) headers['Content-Type'] = 'application/json';
  const upstream = await fetch(`${DERIPAY_BASE_URL}${path}`, { method, headers, body });
  const payload = await upstream.json().catch(() => ({}));
  return { ok: upstream.ok, status: upstream.status, payload };
}
