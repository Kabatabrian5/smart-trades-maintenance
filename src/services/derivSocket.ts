// Deriv WebSocket Service supporting both 'tick' and 'history' message types.
//
// Deriv has retired the legacy `wss://ws.derivws.com/websockets/v3?app_id=...` transport
// (that's what produced the `InvalidSymbol` / empty `active_symbols` responses). The current
// endpoints are:
//   - Public, unauthenticated market data: wss://api.derivws.com/trading/v1/options/ws/public
//   - Authenticated (real or demo): wss://api.derivws.com/trading/v1/options/ws/{real|demo}?otp=...
// The OTP is minted per-account via a REST call (see derivAccounts.ts) and already authenticates
// the connection — there is no `authorize` message to send.
const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

class DerivSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Function[]> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestQueue: any[] = [];
  public onConnectionChange?: (status: string) => void;
  private currentUrl: string = PUBLIC_WS_URL;

  constructor() {
    this.connect();
  }

  /**
   * Connect to a specific, already-authenticated (OTP-bearing) or public WebSocket URL.
   * Replaces the old `authorize(token)` flow: Deriv's current API authenticates the
   * connection itself via the OTP embedded in the URL, so no follow-up message is needed.
   */
  public connectToUrl(url: string) {
    this.currentUrl = url;
    this.ws?.close();
    this.ws = null;
    this.connect();
  }

  /** Drop any authenticated session and return to the public market-data connection. */
  public connectPublic() {
    this.connectToUrl(PUBLIC_WS_URL);
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.onConnectionChange) this.onConnectionChange('Connecting...');

    try {
      this.ws = new WebSocket(this.currentUrl);

      this.ws.onopen = () => {
        if (this.onConnectionChange) this.onConnectionChange('Live');

        while (this.requestQueue.length > 0) {
          const req = this.requestQueue.shift();
          this.sendDirect(req);
        }
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.req_id && this.pendingRequests.has(data.req_id.toString())) {
          const { resolve, reject } = this.pendingRequests.get(data.req_id.toString())!;
          if (data.error) {
            reject(data.error);
          } else {
            resolve(data);
          }
          this.pendingRequests.delete(data.req_id.toString());
        }

        // Broadcast any message type to its respective subscribers (e.g., 'tick', 'history')
        if (data.msg_type && this.subscribers.has(data.msg_type)) {
          this.subscribers.get(data.msg_type)?.forEach((callback) => callback(data));
        }
      };

      this.ws.onerror = () => {
        if (this.onConnectionChange) this.onConnectionChange('Connection error');
      };

      this.ws.onclose = () => {
        if (this.onConnectionChange) this.onConnectionChange('Disconnected');
      };
    } catch (e) {
      if (this.onConnectionChange) this.onConnectionChange('Connection error');
    }
  }

  public send(data: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.requestQueue.push({ data, resolve, reject });
        this.connect();
        return;
      }

      this.sendDirect({ data, resolve, reject });
    });
  }

  private sendDirect({ data, resolve, reject }: { data: object; resolve: Function; reject: Function }) {
    const req_id = Math.floor(Math.random() * 1000000);
    this.pendingRequests.set(req_id.toString(), { resolve, reject });
    this.ws?.send(JSON.stringify({ ...data, req_id }));
  }

  public subscribe(msgType: string, callback: Function) {
    if (!this.subscribers.has(msgType)) {
      this.subscribers.set(msgType, []);
    }
    this.subscribers.get(msgType)?.push(callback);

    return () => {
      const subs = this.subscribers.get(msgType);
      if (subs) {
        this.subscribers.set(msgType, subs.filter((cb) => cb !== callback));
      }
    };
  }

  public async buyContract(proposalId: string, price: number) {
    return this.send({ buy: proposalId, price: price });
  }
}

export const derivService = new DerivSocketService();
