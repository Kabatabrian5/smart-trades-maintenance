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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  /**
   * Connect to a specific, already-authenticated (OTP-bearing) or public WebSocket URL.
   * Replaces the old `authorize(token)` flow: Deriv's current API authenticates the
   * connection itself via the OTP embedded in the URL, so no follow-up message is needed.
   */
  public connectToUrl(url: string) {
    if (this.currentUrl === url && this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.currentUrl = url;
    this.clearReconnectTimer();
    const previousSocket = this.ws;
    this.ws = null;
    previousSocket?.close();
    this.rejectPendingRequests(new Error('Deriv WebSocket connection changed'));
    this.connect();
  }

  /** Drop any authenticated session and return to the public market-data connection. */
  public connectPublic() {
    this.connectToUrl(PUBLIC_WS_URL);
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) this.onConnectionChange?.('Live');
      return;
    }

    this.clearReconnectTimer();
    if (this.onConnectionChange) this.onConnectionChange('Connecting...');

    try {
      const socket = new WebSocket(this.currentUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.reconnectDelay = 1000;
        if (this.onConnectionChange) this.onConnectionChange('Live');

        while (this.requestQueue.length > 0) {
          const req = this.requestQueue.shift();
          this.sendDirect(req);
        }
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
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

      socket.onerror = () => {
        if (this.ws !== socket) return;
        if (this.onConnectionChange) this.onConnectionChange('Connection error');
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.ws = null;
        this.rejectPendingRequests(new Error('Deriv WebSocket disconnected'));
        if (this.onConnectionChange) this.onConnectionChange('Disconnected');
        this.scheduleReconnect();
      };
    } catch (e) {
      if (this.onConnectionChange) this.onConnectionChange('Connection error');
      this.scheduleReconnect();
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

  private rejectPendingRequests(error: Error) {
    this.pendingRequests.forEach(({ reject }) => reject(error));
    this.pendingRequests.clear();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
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

  public async refreshBalance() {
    return this.send({ balance: 1 });
  }

  public async subscribeToContract(contractId: string) {
    return this.send({ proposal_open_contract: 1, contract_id: Number(contractId), subscribe: 1 });
  }
}

export const derivService = new DerivSocketService();
