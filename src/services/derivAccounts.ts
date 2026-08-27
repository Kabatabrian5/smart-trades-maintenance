// Deriv's OAuth login now returns a plain OIDC access token — it is no longer accepted
// directly by the legacy WebSocket `authorize` call, and the old `/oauth2/legacy/tokens`
// bridge that used to convert it has been retired (it now returns Deriv's marketing page).
// The current, documented path is:
//   1. GET  /trading/v1/options/accounts            -> list the user's Options accounts
//   2. POST /trading/v1/options/accounts/{id}/otp   -> get a one-time-password WebSocket URL
//   3. Connect directly to that URL (no `authorize` message needed; the OTP authenticates it)

const API_BASE = 'https://api.derivws.com';

export interface DerivOptionsAccount {
  account_id: string;
  balance: number;
  currency: string;
  group: string;
  status: string;
  account_type: 'real' | 'demo' | string;
}

interface DerivApiError {
  errors?: Array<{ status?: number; code?: string; message?: string }>;
}

function extractErrorMessage(body: DerivApiError, fallback: string) {
  return body.errors?.[0]?.message || fallback;
}

export async function fetchOptionsAccounts(accessToken: string, appId: string): Promise<DerivOptionsAccount[]> {
  const response = await fetch(`${API_BASE}/trading/v1/options/accounts`, {
    headers: {
      'Deriv-App-ID': appId,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({})) as DerivApiError & { data?: DerivOptionsAccount | DerivOptionsAccount[] };
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, `Failed to list Deriv accounts (${response.status})`));
  }

  const data = body.data;
  if (Array.isArray(data)) return data;
  if (data) return [data];
  return [];
}

export async function requestAccountWebSocketUrl(accessToken: string, appId: string, accountId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
    method: 'POST',
    headers: {
      'Deriv-App-ID': appId,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => ({})) as DerivApiError & { data?: { url?: string } };
  if (!response.ok || !body.data?.url) {
    throw new Error(extractErrorMessage(body, `Failed to open a Deriv WebSocket session (${response.status})`));
  }

  return body.data.url;
}

/** Pick which account to connect to by default: prefer a real-money account over demo. */
export function pickPrimaryAccount(accounts: DerivOptionsAccount[]): DerivOptionsAccount | null {
  if (!accounts.length) return null;
  return accounts.find((account) => account.account_type === 'real') || accounts[0];
}
