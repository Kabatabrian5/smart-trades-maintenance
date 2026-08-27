// Deriv WebSocket Service supporting both 'tick' and 'history' message types
const DERIV_WS_APP_ID = import.meta.env.VITE_DERIV_WS_APP_ID || '1089';
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(DERIV_WS_APP_ID)}`;
const OIDC_CLIENT_ID = '34bIcDF1RsEKSAbKFKimH';

class DerivSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Function[]> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestQueue: any[] = [];
  public onConnectionChange?: (status: string) => void;
  private apiToken: string | undefined = undefined;

  constructor() {
    this.loadToken();
    this.connect();
  }

  private loadToken() {
    // Check localStorage for OAuth tokens saved during login callback
    try {
      const localToken = localStorage.getItem('token1') || localStorage.getItem('access_token') || localStorage.getItem('deriv_access_token');
      if (localToken) {
        this.apiToken = localToken;
        return;
      }
      // Fallback to environment variable if available
      const envToken = import.meta.env.VITE_DERIV_API_TOKEN as string | undefined;
      if (envToken) {
        this.apiToken = envToken;
      }
    } catch (e) {
      console.error('Failed to load token from storage:', e);
    }
  }

  public connect() {
    this.loadToken(); // Refresh token check before connecting

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.onConnectionChange) this.onConnectionChange('Connecting...');

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        if (this.onConnectionChange) this.onConnectionChange('Live');
        this.authorize();

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

  public async authorize(token?: string) {
    if (token) {
      this.apiToken = token;
      localStorage.setItem('token1', token);
    }
    if (!this.apiToken) return null;

    try {
      return await this.send({ authorize: this.apiToken });
    } catch (error) {
      console.error('Authorization failed:', error);
      throw error;
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
