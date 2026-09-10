const PAWAPAY_BASE_URL = process.env.PAWAPAY_ENVIRONMENT === 'production'
  ? 'https://api.pawapay.io'
  : 'https://api.sandbox.pawapay.io';

export function pawapayToken() {
  const token = process.env.PAWAPAY_API_TOKEN;
  if (!token) throw new Error('PAWAPAY_API_TOKEN is not configured');
  return token;
}

export function pawapayErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'failureReason' in payload) {
    const reason = payload.failureReason;
    if (reason && typeof reason === 'object' && 'failureMessage' in reason && typeof reason.failureMessage === 'string') return reason.failureMessage;
  }
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') return payload.message;
  return fallback;
}

export async function pawapayFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${pawapayToken()}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${PAWAPAY_BASE_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}
