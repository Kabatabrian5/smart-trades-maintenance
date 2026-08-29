import React, { useEffect, useState } from 'react';
import PositionsDrawer from './components/layout/PositionsDrawer';
import { useDerivSocket } from './hooks/useDerivSocket';
import { derivService } from './services/derivSocket';
import { fetchOptionsAccounts, requestAccountWebSocketUrl, pickPrimaryAccount, type DerivOptionsAccount } from './services/derivAccounts';

const VOLATILITY_MARKETS = [
  { id: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  { id: '1HZ25V', name: 'Volatility 25 (1s) Index' },
  { id: '1HZ50V', name: 'Volatility 50 (1s) Index' },
  { id: '1HZ75V', name: 'Volatility 75 (1s) Index' },
  { id: '1HZ100V', name: 'Volatility 100 (1s) Index' },
  { id: 'R_10', name: 'Volatility 10 Index' },
  { id: 'R_25', name: 'Volatility 25 Index' },
  { id: 'R_50', name: 'Volatility 50 Index' },
  { id: 'R_75', name: 'Volatility 75 Index' },
  { id: 'R_100', name: 'Volatility 100 Index' },
  { id: 'BOOM300N', name: 'Boom 300 Index' },
  { id: 'BOOM500', name: 'Boom 500 Index' },
  { id: 'BOOM600', name: 'Boom 600 Index' },
  { id: 'BOOM900', name: 'Boom 900 Index' },
  { id: 'BOOM1000', name: 'Boom 1000 Index' },
  { id: 'CRASH300N', name: 'Crash 300 Index' },
  { id: 'CRASH500', name: 'Crash 500 Index' },
  { id: 'CRASH600', name: 'Crash 600 Index' },
  { id: 'CRASH900', name: 'Crash 900 Index' },
  { id: 'CRASH1000', name: 'Crash 1000 Index' },
  { id: 'JD10', name: 'Jump 10 Index' },
  { id: 'JD25', name: 'Jump 25 Index' },
  { id: 'JD50', name: 'Jump 50 Index' },
  { id: 'JD75', name: 'Jump 75 Index' },
  { id: 'JD100', name: 'Jump 100 Index' },
  { id: 'stpRNG', name: 'Step Index' },
  { id: 'stpRNG2', name: 'Step Index 2' },
  { id: 'stpRNG3', name: 'Step Index 3' },
  { id: 'stpRNG4', name: 'Step Index 4' },
  { id: 'stpRNG5', name: 'Step Index 5' },
  { id: 'RDBEAR', name: 'Daily Reset Bear Index' },
  { id: 'RDBULL', name: 'Daily Reset Bull Index' },
  { id: 'RB10', name: 'Range Break 10 Index' },
  { id: 'RB20', name: 'Range Break 20 Index' },
  { id: 'RB30', name: 'Range Break 30 Index' },
  { id: 'RB40', name: 'Range Break 40 Index' },
  { id: 'RB50', name: 'Range Break 50 Index' },
];

interface BotItem {
  id: string;
  name: string;
  lastModified: string;
  status: 'Unsaved' | 'Saved' | 'Running';
}

interface DerivAccount {
  loginid: string;
  token: string;
  currency: string;
  balance: number | null;
  accountType?: 'real' | 'demo';
}

interface AccountBalances {
  real: number | null;
  demo: number | null;
  currency: string;
}

interface Position {
  id: string;
  symbol: string;
  contract: string;
  stake: number;
  status: 'Pending' | 'Open' | 'Settled';
}

interface CashierTransaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  currency: string;
  phone: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
}

type TradeMode = 'MATCHES_DIFFERS' | 'EVEN_ODD' | 'OVER_UNDER' | 'RISE_FALL' | 'HIGHER_LOWER' | 'TOUCH_NO_TOUCH';

const TRADE_MODES: Array<{ id: TradeMode; label: string }> = [
  { id: 'MATCHES_DIFFERS', label: 'Matches / Differs' },
  { id: 'EVEN_ODD', label: 'Even / Odd' },
  { id: 'OVER_UNDER', label: 'Over / Under' },
  { id: 'RISE_FALL', label: 'Rise / Fall' },
  { id: 'HIGHER_LOWER', label: 'Higher / Lower' },
  { id: 'TOUCH_NO_TOUCH', label: 'Touch / No Touch' },
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

const DERIV_CLIENT_ID = import.meta.env.VITE_DERIV_CLIENT_ID || '34bIcDF1RsEKSAbKFKimH';

function normalizeBalance(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getAccountType(account: DerivAccount): 'real' | 'demo' {
  return account.accountType || (account.loginid.startsWith('VR') ? 'demo' : 'real');
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function derivOAuthUrl() {
  if (!DERIV_CLIENT_ID) throw new Error('Deriv OAuth client ID is not configured');
  const redirectUri = window.location.origin;
  const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(64)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = toBase64Url(new Uint8Array(digest));
  const state = toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem('deriv_pkce_verifier', verifier);
  sessionStorage.setItem('deriv_oauth_state', state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DERIV_CLIENT_ID,
    scope: 'trade account_manage payment',
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
}

function playSignalBeep() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(420, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(780, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.04, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.14);
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'manual-trading' | 'positions' | 'analysis' | 'signal' | 'dashboard' | 'bot-builder' | 'bots'>('manual-trading');
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [cashierTab, setCashierTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [cashierPhone, setCashierPhone] = useState('');
  const [cashierAmount, setCashierAmount] = useState('');
  const [cashierStatus, setCashierStatus] = useState('');
  const [isCashierSubmitting, setIsCashierSubmitting] = useState(false);
  const [cashierTransactions, setCashierTransactions] = useState<CashierTransaction[]>(() => {
    const saved = sessionStorage.getItem('smart-trades-transactions');
    return saved ? JSON.parse(saved) as CashierTransaction[] : [];
  });
  const [availableAccounts, setAvailableAccounts] = useState<DerivOptionsAccount[]>([]);
  const [account, setAccount] = useState<DerivAccount | null>(() => {
    const savedAccount = sessionStorage.getItem('smart-trades-account');
    return savedAccount ? JSON.parse(savedAccount) as DerivAccount : null;
  });
  const [accountBalances, setAccountBalances] = useState<AccountBalances>({ real: null, demo: null, currency: 'USD' });
  const [authStatus, setAuthStatus] = useState<'idle' | 'authorizing' | 'failed'>('idle');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('error')) {
      setAuthError(params.get('error_description') || params.get('error') || 'Deriv authorization was denied');
      setAuthStatus('failed');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    const code = params.get('code');
    const returnedState = params.get('state');
    const expectedState = sessionStorage.getItem('deriv_oauth_state');
    if (!code || !returnedState || returnedState !== expectedState) {
      return;
    }

    let isMounted = true;
    setAuthStatus('authorizing');
    fetch('/api/deriv-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, code_verifier: sessionStorage.getItem('deriv_pkce_verifier'), redirect_uri: window.location.origin }) }).then(async (response) => {
      const errorResponse = await response.clone().json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(errorResponse.error || `Token exchange failed (${response.status})`);
      }
      const tokenResponse = await response.json() as { access_token?: string };
      if (!tokenResponse.access_token) throw new Error('Deriv returned no usable access token');
      await authorizeWithAccessToken(tokenResponse.access_token);
      sessionStorage.removeItem('deriv_pkce_verifier');
      sessionStorage.removeItem('deriv_oauth_state');
      window.history.replaceState({}, document.title, window.location.pathname);
    }).catch((error: unknown) => {
      if (isMounted) {
        setAuthError(error instanceof Error ? error.message : 'Deriv authorization failed');
        setAuthStatus('failed');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Deriv's current Options API: an OIDC access token doesn't authenticate a WebSocket
  // connection directly. Instead we list the user's accounts, mint a one-time-password
  // WebSocket URL for the chosen account, and connect straight to that (no `authorize`
  // message needed — the OTP in the URL does it).
  async function authorizeWithAccessToken(accessToken: string) {
    const accounts = await fetchOptionsAccounts(accessToken, DERIV_CLIENT_ID);
    const primary = pickPrimaryAccount(accounts);
    if (!primary) throw new Error('Deriv account list was empty');
    setAvailableAccounts(accounts);

    const wsUrl = await requestAccountWebSocketUrl(accessToken, DERIV_CLIENT_ID, primary.account_id);
    derivService.connectToUrl(wsUrl);

    const nextAccount: DerivAccount = {
      loginid: primary.account_id,
      token: accessToken,
      currency: primary.currency,
      balance: normalizeBalance(primary.balance),
      accountType: primary.account_type === 'real' ? 'real' : 'demo',
    };
    sessionStorage.setItem('smart-trades-account', JSON.stringify(nextAccount));
    setAccount(nextAccount);
    setAccountBalances((previous) => ({
      ...previous,
      [getAccountType(nextAccount)]: nextAccount.balance,
      currency: nextAccount.currency,
    }));
    setAuthStatus('idle');
  }

  async function switchAccount(nextAccount: DerivOptionsAccount) {
    if (!account || nextAccount.account_id === account.loginid || nextAccount.status !== 'active') return;
    setAuthStatus('authorizing');
    setIsAccountMenuOpen(false);
    try {
      const wsUrl = await requestAccountWebSocketUrl(account.token, DERIV_CLIENT_ID, nextAccount.account_id);
      derivService.connectToUrl(wsUrl);
      const accountType = nextAccount.account_type === 'real' ? 'real' : 'demo';
      const updatedAccount: DerivAccount = {
        loginid: nextAccount.account_id,
        token: account.token,
        currency: nextAccount.currency,
        balance: normalizeBalance(nextAccount.balance),
        accountType,
      };
      sessionStorage.setItem('smart-trades-account', JSON.stringify(updatedAccount));
      setAccount(updatedAccount);
      setAccountBalances((previous) => ({ ...previous, [accountType]: normalizeBalance(nextAccount.balance), currency: nextAccount.currency }));
      setAuthStatus('idle');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Deriv account switch failed');
      setAuthStatus('failed');
    }
  }

  async function handleCashierDeposit() {
    if (!account || isCashierSubmitting) return;
    setIsCashierSubmitting(true);
    setCashierStatus('Sending M-Pesa prompt...');
    try {
      const phoneNumber = cashierPhone.replace(/\D/g, '').replace(/^0/, '254');
      const depositResponse = await fetch('/api/deripay-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, usdAmount: cashierAmount, loginid: account.loginid, userToken: account.token }),
      });
      const payload = await depositResponse.json().catch(() => ({})) as { message?: string; error?: string; transactionId?: string };
      if (!depositResponse.ok) throw new Error(payload.error || 'Deposit request failed');
      setCashierStatus(payload.message || 'M-Pesa prompt sent. Complete it on your phone.');
      if (payload.transactionId) {
        addTransaction({
          id: payload.transactionId,
          type: 'deposit',
          amount: Number(cashierAmount) || 0,
          currency: account.currency,
          phone: phoneNumber,
          status: 'pending',
          createdAt: Date.now(),
        });
        pollTransactionStatus(payload.transactionId);
      }
    } catch (error) {
      setCashierStatus(error instanceof Error ? error.message : 'Deposit request failed');
    } finally {
      setIsCashierSubmitting(false);
    }
  }

  function addTransaction(transaction: CashierTransaction) {
    setCashierTransactions((current) => {
      const next = [transaction, ...current];
      sessionStorage.setItem('smart-trades-transactions', JSON.stringify(next));
      return next;
    });
  }

  function updateTransactionStatus(id: string, status: CashierTransaction['status']) {
    setCashierTransactions((current) => {
      const next = current.map((tx) => (tx.id === id ? { ...tx, status } : tx));
      sessionStorage.setItem('smart-trades-transactions', JSON.stringify(next));
      return next;
    });
  }

  // Deripay's deposit call only confirms that the M-Pesa prompt was sent, not that money
  // actually settled. Poll GET /api/deripay-status until Deripay reports a final state
  // (completed/failed), then refresh the Deriv balance only once settlement is confirmed.
  function pollTransactionStatus(transactionId: string, attempt = 0) {
    const maxAttempts = 20; // roughly 2.5 minutes at 8s intervals
    if (attempt >= maxAttempts) return;
    setTimeout(async () => {
      try {
        const statusResponse = await fetch(`/api/deripay-status?transactionId=${encodeURIComponent(transactionId)}`);
        const statusPayload = await statusResponse.json().catch(() => ({})) as { status?: string; error?: string };
        if (!statusResponse.ok) throw new Error(statusPayload.error || 'Status check failed');
        const normalizedStatus = (statusPayload.status || '').toLowerCase();
        if (['completed', 'success', 'successful'].includes(normalizedStatus)) {
          updateTransactionStatus(transactionId, 'completed');
          setCashierStatus('Deposit confirmed. Refreshing balance...');
          derivService.send({ balance: 1, subscribe: 1 }).catch(() => {});
          return;
        }
        if (['failed', 'cancelled', 'canceled'].includes(normalizedStatus)) {
          updateTransactionStatus(transactionId, 'failed');
          setCashierStatus('Deposit failed or was cancelled.');
          return;
        }
        pollTransactionStatus(transactionId, attempt + 1);
      } catch {
        pollTransactionStatus(transactionId, attempt + 1);
      }
    }, 8000);
  }

  useEffect(() => {
    if (!account) return;

    const unsubscribeBalance = derivService.subscribe('balance', (data: { balance?: { balance?: number; loginid?: string; currency?: string } }) => {
      const balance = normalizeBalance(data.balance?.balance);
      if (balance === null) return;
      const isDemo = account.accountType === 'demo' || data.balance?.loginid?.startsWith('VR') || account.loginid.startsWith('VR');
      setAccountBalances((previous) => ({ ...previous, [isDemo ? 'demo' : 'real']: balance, currency: data.balance?.currency || previous.currency }));
      setAccount((previous) => {
        if (!previous) return previous;
        const updated = { ...previous, balance };
        sessionStorage.setItem('smart-trades-account', JSON.stringify(updated));
        return updated;
      });
    });

    derivService.send({ balance: 1, subscribe: 1 }).catch(() => {});
    return unsubscribeBalance;
  }, [account?.loginid]);

  const navigationItems = [
    { id: 'manual-trading' as const, label: 'Manual trading' },
    { id: 'positions' as const, label: 'Positions' },
    { id: 'signal' as const, label: 'Signal' },
    { id: 'dashboard' as const, label: 'Dashboard' },
    { id: 'bot-builder' as const, label: 'Bot Builder' },
    { id: 'bots' as const, label: 'Bots' },
  ];

  const handleNavigation = (id: (typeof navigationItems)[number]['id']) => {
    if (id === 'manual-trading' || id === 'positions' || id === 'signal' || id === 'dashboard' || id === 'bot-builder' || id === 'bots') {
      setCurrentTab(id);
      return;
    }
  };

  // Trading state
  const [selectedSymbol, setSelectedSymbol] = useState('1HZ100V');
  const [liveMarkets, setLiveMarkets] = useState(VOLATILITY_MARKETS);
  const [selectedDigit, setSelectedDigit] = useState<number>(3);
  const [tradeMode, setTradeMode] = useState<TradeMode>('MATCHES_DIFFERS');
  const [stake, setStake] = useState(10);
  const [ticksCount, setTicksCount] = useState(1);
  const [positions, setPositions] = useState<Position[]>(() => {
    const savedPositions = sessionStorage.getItem('smart-trades-positions');
    return savedPositions ? JSON.parse(savedPositions) as Position[] : [];
  });
  const [signalMarket, setSignalMarket] = useState('1HZ100V');
  const [signalDigitStats, setSignalDigitStats] = useState(digitStatsPlaceholder());
  const [isSearchingSignals, setIsSearchingSignals] = useState(false);
  const { currentTick, marketStatus, digitHistory } = useDerivSocket(selectedSymbol);

  function digitStatsPlaceholder() {
    return Array.from({ length: 10 }, (_, digit) => ({ digit, count: 0, pct: 0 }));
  }

  useEffect(() => {
    derivService.send({ active_symbols: 'brief', product_type: 'basic' }).then((response) => {
      if (!response?.active_symbols?.length) return;
      const availableSymbols = new Set(response.active_symbols.map((item: { symbol?: string }) => item.symbol).filter(Boolean));
      const available = VOLATILITY_MARKETS.filter((market) => availableSymbols.has(market.id));
      if (available.length) {
        setLiveMarkets(available);
        setSelectedSymbol((current) => available.some((market) => market.id === current) ? current : available[0].id);
      }
    }).catch(() => {
      // Keep the known catalog when the public symbol request is unavailable.
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsSearchingSignals(true);
    derivService.send({ ticks_history: signalMarket, adjust_start_time: 1, count: 120, end: 'latest', start: 1, style: 'ticks' }).then((response) => {
      if (!isMounted || !response?.history?.prices?.length) return;
      const pipSize = response.history.pip_size || response.pip_size || 2;
      const counts = digitStatsPlaceholder();
      response.history.prices.forEach((price: number) => {
        const formatted = Number(price).toFixed(pipSize);
        const digit = Number(formatted.charAt(formatted.length - 1));
        if (counts[digit]) counts[digit].count += 1;
      });
      const total = response.history.prices.length;
      setSignalDigitStats(counts.map((item) => ({ ...item, pct: Math.round((item.count / total) * 100) })));
    }).catch(() => {
      if (isMounted) setSignalDigitStats(digitStatsPlaceholder());
    }).finally(() => {
      if (isMounted) setTimeout(() => setIsSearchingSignals(false), 1400);
    });
    return () => { isMounted = false; };
  }, [signalMarket]);

  // Dashboard & Bot Manager state
  const [dashboardBots, setDashboardBots] = useState<BotItem[]>([
    { id: '1', name: 'Untitled Bot', lastModified: '15 Aug 2026', status: 'Unsaved' },
  ]);

  // Quick Strategy Modal State
  const [isQuickStrategyOpen, setIsQuickStrategyOpen] = useState(false);
  const [quickStrategyStep, setQuickStrategyStep] = useState<'template' | 'parameters'>('template');
  const [strategyFilter, setStrategyFilter] = useState<'all' | 'accumulators' | 'options'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  // Strategy Parameter Inputs State
  const [initialStakeInput, setInitialStakeInput] = useState<number>(1);
  const [martingaleFactorInput, setMartingaleFactorInput] = useState<number>(2);
  const [maxStakeLimitInput, setMaxStakeLimitInput] = useState<number>(100);

  // Active Strategy Execution Engine State
  const [activeStrategyConfig, setActiveStrategyConfig] = useState<{
    strategyName: string;
    initialStake: number;
    factor: number;
    maxLimit: number;
    currentStake: number;
    stepIndex: number;
    seriesProfit: number;
  } | null>(null);

  const accumulatorsStrategies = [
    'Martingale',
    'Martingale on Stat Reset',
    "D'Alembert",
    "D'Alembert on Stat Reset",
    'Reverse Martingale',
    'Reverse Martingale on Stat Reset',
    "Reverse D'Alembert",
    "Reverse D'Alembert on Stat Reset",
  ];

  const optionsStrategies = [
    'Martingale',
    "D'Alembert",
    'Reverse Martingale',
    "Reverse D'Alembert",
    "Oscar's Grind",
    '1-3-2-6',
  ];

  // Bot Builder internal state & Blocks Modal
  const [builderCategory, setBuilderCategory] = useState<string>('Trade parameters');
  const [rightPanelTab, setRightPanelTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
  const [positionsPanelTab, setPositionsPanelTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botRuns, setBotRuns] = useState(0);
  const [botProfit, setBotProfit] = useState(0);

  // Modal / Flyout state for category block details (Image 2)
  const [activeCategoryModal, setActiveCategoryModal] = useState<string | null>(null);

  // Canvas Blocks added to workspace
  const [canvasPurchaseBlocks, setCanvasPurchaseBlocks] = useState<string[]>(['Rise']);
  const [canvasSellBlocks, setCanvasSellBlocks] = useState<string[]>(['is available']);

  const totalTicks = Math.max(1, digitHistory.length);
  const digitStats = Array.from({ length: 10 }, (_, digit) => {
    const count = digitHistory.filter((d) => d === digit).length;
    const pct = Math.round((count / totalTicks) * 100);
    return { digit, pct, count };
  });
  const analysisStats = currentTab === 'signal' ? signalDigitStats : digitStats;

  const minPct = Math.min(...digitStats.map(s => s.pct));
  const lastDigit = currentTick !== null && !isNaN(currentTick) 
    ? parseInt(currentTick.toString().slice(-1), 10) 
    : 3;

  const calculateNextStake = (lastResult: 'win' | 'loss'): number => {
    if (!activeStrategyConfig) return stake;

    const { strategyName, initialStake, factor, maxLimit, currentStake } = activeStrategyConfig;
    let nextStake = currentStake;
    let newStepIndex = activeStrategyConfig.stepIndex;

    switch (strategyName) {
      case 'Martingale':
        if (lastResult === 'loss') {
          nextStake = currentStake * (factor || 2);
        } else {
          nextStake = initialStake;
        }
        break;
      case 'Reverse Martingale':
        if (lastResult === 'win') {
          nextStake = currentStake * (factor || 2);
        } else {
          nextStake = initialStake;
        }
        break;
      case "D'Alembert":
        if (lastResult === 'loss') {
          nextStake = currentStake + (factor || 1);
        } else {
          nextStake = Math.max(initialStake, currentStake - (factor || 1));
        }
        break;
      default:
        nextStake = initialStake;
        break;
    }

    if (nextStake > maxLimit) {
      nextStake = initialStake;
      newStepIndex = 0;
    }

    setActiveStrategyConfig(prev => prev ? { ...prev, currentStake: nextStake, stepIndex: newStepIndex } : null);
    setStake(nextStake);
    return nextStake;
  };

  const handleLoadStrategyToWorkspace = () => {
    if (!selectedStrategy) return;

    setActiveStrategyConfig({
      strategyName: selectedStrategy,
      initialStake: initialStakeInput,
      factor: martingaleFactorInput,
      maxLimit: maxStakeLimitInput,
      currentStake: initialStakeInput,
      stepIndex: 0,
      seriesProfit: 0,
    });
    setStake(initialStakeInput);

    setIsQuickStrategyOpen(false);
    setCurrentTab('bot-builder');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newBot: BotItem = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        lastModified: '21 Aug 2026',
        status: 'Saved',
      };
      setDashboardBots((prev) => [newBot, ...prev]);
    }
  };

  const handleGoogleSignIn = () => {
    const gapi = (window as any).gapi;
    const google = (window as any).google;

    if (!gapi || !google || !GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      alert("Google Drive is not configured yet.");
      return;
    }

    gapi.load('client:picker', () => {
      gapi.client.init({ apiKey: GOOGLE_API_KEY }).then(() => {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error) {
              alert(`Google Auth Error: ${response.error}`);
              return;
            }
            openPicker(response.access_token);
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      });
    });
  };

  const openPicker = (oauthToken: string) => {
    const google = (window as any).google;
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes('application/json,text/xml');

    if (!GOOGLE_CLIENT_ID) {
      alert('Google Drive is not configured yet.');
      return;
    }

    const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setAppId(GOOGLE_CLIENT_ID.split('-')[0])
      .setOAuthToken(oauthToken)
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const file = data.docs[0];
          const newBot: BotItem = {
            id: file.id || Date.now().toString(),
            name: file.name.replace(/\.[^/.]+$/, ""),
            lastModified: '21 Aug 2026',
            status: 'Saved',
          };
          setDashboardBots((prev) => [newBot, ...prev]);
        }
      })
      .build();

    picker.setVisible(true);
  };

  const handleDeleteBot = (id: string) => {
    setDashboardBots((prev) => prev.filter(b => b.id !== id));
  };

  const handleDuplicateBot = (bot: BotItem) => {
    const duplicated: BotItem = {
      ...bot,
      id: Date.now().toString(),
      name: `${bot.name} (Copy)`,
      status: 'Unsaved',
    };
    setDashboardBots((prev) => [duplicated, ...prev]);
  };

  const handlePurchase = async (contractType: string) => {
    try {
      const needsBarrier = ['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER', 'ONETOUCH', 'NOTOUCH'].includes(contractType);
      const proposalRes = await derivService.send({
        proposal: 1,
        amount: stake,
        basis: 'stake',
        currency: 'USD',
        symbol: selectedSymbol,
        contract_type: contractType,
        duration: ticksCount,
        duration_unit: 't',
        ...(needsBarrier ? { barrier: selectedDigit.toString() } : {}),
      });

      if (proposalRes.proposal) {
        const buyRes = await derivService.buyContract(proposalRes.proposal.id, proposalRes.proposal.ask_price);
        const recordedPosition: Position = {
          id: String(buyRes.buy.contract_id),
          symbol: selectedSymbol,
          contract: contractType,
          stake,
          status: 'Open',
        };
        setPositions((current) => {
          const updatedPositions = [recordedPosition, ...current];
          sessionStorage.setItem('smart-trades-positions', JSON.stringify(updatedPositions));
          return updatedPositions;
        });
        alert(`Digit Trade executed! Contract ID: ${buyRes.buy.contract_id}`);
      }
    } catch (error: any) {
      alert(`Trade failed: ${error.message || 'Unknown error'}`);
    }
  };

  const isDigitMode = ['MATCHES_DIFFERS', 'EVEN_ODD', 'OVER_UNDER'].includes(tradeMode);
  const tradeButtons = {
    MATCHES_DIFFERS: [{ label: 'Matches', type: 'DIGITMATCH' }, { label: 'Differs', type: 'DIGITDIFF' }],
    EVEN_ODD: [{ label: 'Even', type: 'DIGITEVEN' }, { label: 'Odd', type: 'DIGITODD' }],
    OVER_UNDER: [{ label: 'Over', type: 'DIGITOVER' }, { label: 'Under', type: 'DIGITUNDER' }],
    RISE_FALL: [{ label: 'Rise', type: 'CALL' }, { label: 'Fall', type: 'PUT' }],
    HIGHER_LOWER: [{ label: 'Higher', type: 'CALL' }, { label: 'Lower', type: 'PUT' }],
    TOUCH_NO_TOUCH: [{ label: 'Touch', type: 'ONETOUCH' }, { label: 'No Touch', type: 'NOTOUCH' }],
  }[tradeMode];
  const activeAccountType = account ? getAccountType(account) : null;
  const activeBalance = account ? account.balance ?? accountBalances[activeAccountType || 'real'] : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#16161c] text-white font-sans relative">
      <header className="h-auto min-h-14 bg-[#121217] border-b border-[#22222c] flex items-center justify-between px-3 py-2 sm:px-6 sm:py-0 shrink-0 z-20 gap-2">
        <div className="flex items-center space-x-6 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-teal-500 to-blue-600 flex items-center justify-center font-extrabold text-black text-xs">ST</span>
            <span className="hidden font-extrabold text-sm tracking-wide text-white whitespace-nowrap sm:inline">Smartest <span className="text-teal-400">Trades</span></span>
          </div>

          <nav className="hidden md:flex items-center space-x-1 overflow-x-auto">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  currentTab === item.id ? 'bg-[#222230] text-teal-400 shadow' : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {account && <div className="hidden items-center gap-1 md:flex"><span className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[9px] font-bold text-emerald-300">Real: {accountBalances.real === null ? '--' : accountBalances.real.toFixed(2)} {accountBalances.currency}</span><span className="rounded-lg border border-sky-500/30 px-2 py-1 text-[9px] font-bold text-sky-300">Demo: {accountBalances.demo === null ? '--' : accountBalances.demo.toFixed(2)} {accountBalances.currency}</span></div>}
          {account && <button onClick={() => setIsCashierOpen(true)} className="px-2.5 sm:px-4 py-2 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer">Cashier</button>}
          <button className="rounded-xl border border-slate-700 px-2.5 py-2 text-[10px] font-bold text-gray-200 transition hover:border-teal-400 hover:text-white sm:px-3 sm:text-xs">☀️ <span className="hidden sm:inline">Light</span></button>
          {account ? <div className="relative"><button title={`${activeAccountType === 'real' ? 'Real' : 'Demo'} account ${account.loginid}`} onClick={() => setIsAccountMenuOpen((open) => !open)} className="max-w-[126px] truncate rounded-xl border border-emerald-500/30 px-2 py-2 text-[10px] font-bold text-emerald-300 sm:max-w-none sm:px-3 sm:text-xs">{activeAccountType === 'real' ? 'Real' : 'Demo'} | {activeBalance === null ? '--' : activeBalance.toFixed(2)} {account.currency}⌄</button>{isAccountMenuOpen && <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-slate-700 bg-[#17171f] p-3 text-left shadow-2xl"><p className="px-2 text-[10px] uppercase tracking-wider text-gray-500">Switch account</p>{availableAccounts.map((option) => { const optionType = option.account_type === 'real' ? 'real' : 'demo'; const isActive = option.account_id === account.loginid; return <button key={option.account_id} disabled={isActive || option.status !== 'active'} onClick={() => void switchAccount(option)} className={`mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs ${isActive ? 'cursor-default bg-white/5 text-gray-500' : 'text-gray-200 hover:bg-white/10'}`}><span><span className="mr-2 font-bold">{optionType === 'real' ? 'Real' : 'Demo'}</span>{option.account_id}</span><span>{normalizeBalance(option.balance)?.toFixed(2) ?? '--'} {option.currency}</span></button>; })}</div>}</div> : <button onClick={async () => { try { window.location.href = await derivOAuthUrl(); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Deriv authorization failed'); setAuthStatus('failed'); } }} className="rounded-xl border border-slate-700 px-2.5 py-2 text-[10px] font-bold text-gray-200 transition hover:border-teal-400 hover:text-white sm:px-3 sm:text-xs">Log in</button>}
          {!account && <a href="https://home.deriv.com/dashboard/signup?_gl=1*4zo6tf*_gcl_au*MTM1MjEzODExOS4xNzg3NzcxMjUx&residence=ke" target="_blank" rel="noreferrer" className="rounded-xl bg-teal-400 px-2.5 py-2 text-[10px] font-extrabold text-[#071217] transition hover:bg-teal-300 sm:px-4 sm:text-xs">Sign up</a>}
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex h-16 min-h-16 items-stretch gap-1 overflow-x-auto border-t border-[#2a2a36] bg-[#121217]/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            className={`min-w-[92px] flex-1 rounded-xl px-2 py-2 text-[10px] font-bold leading-tight transition-all cursor-pointer whitespace-nowrap ${
              currentTab === item.id ? 'bg-teal-400 text-[#071217]' : 'text-gray-400 hover:bg-[#1a1a24] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Manual Trading View */}
      {currentTab === 'manual-trading' && (
        <div className="flex flex-1 flex-col overflow-y-auto pb-16 md:flex-row md:overflow-hidden md:pb-0">
          <main className="flex-1 min-w-0 flex flex-col bg-[#16161c] md:overflow-y-auto p-2 pb-28 sm:p-6 sm:pb-6 space-y-2 sm:space-y-4">
            <div className="flex items-center justify-between bg-[#1b1b24] px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-[#262633] shadow-md shrink-0">
              <div className="flex items-center space-x-3">
                <span className={`w-3 h-3 rounded-full ${marketStatus.includes('Live') ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <div>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => {
                      setSelectedSymbol(e.target.value);
                    }}
                    className="bg-transparent font-extrabold text-white text-sm outline-none cursor-pointer"
                  >
                    {liveMarkets.map((market) => (
                      <option key={market.id} value={market.id} className="bg-[#1b1b24] text-white">
                        {market.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    {currentTick !== null ? currentTick : 'Waiting for ticks...'} 
                    <span className="text-emerald-400 ml-2 font-semibold">({totalTicks} ticks analyzed)</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400">Status: <span className="text-white font-semibold">{marketStatus}</span></div>
            </div>

            <div className="flex-none min-h-[220px] items-center justify-start bg-[#1b1b24]/40 border border-[#262633] rounded-2xl p-2 pt-4 sm:p-8 md:flex md:flex-1 md:min-h-0 md:justify-center md:pt-8 relative shadow-inner">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-6 max-w-2xl w-full justify-items-center">
                {digitStats.map((item) => {
                  const isSelected = selectedDigit === item.digit;
                  const isCurrent = lastDigit === item.digit;
                  const isLowest = item.pct === minPct && totalTicks > 5;
                  
                  const radius = 34;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (item.pct / 100) * circumference;
                  const ringColor = isLowest ? '#ef4444' : (isSelected ? '#2dd4bf' : '#38bdf8');

                  return (
                    <button
                      key={item.digit}
                      onClick={() => setSelectedDigit(item.digit)}
                      className={`relative w-[clamp(3.25rem,16vw,5rem)] h-[clamp(3.25rem,16vw,5rem)] rounded-full flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected ? 'bg-[#222230] shadow-lg shadow-teal-500/20' : 'bg-[#1b1b24] hover:border-gray-500'
                      }`}
                    >
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r={radius} stroke="#262633" strokeWidth="3" fill="transparent" />
                        <circle
                          cx="40" cy="40" r={radius} stroke={ringColor} strokeWidth="3"
                          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round" fill="transparent" className="transition-all duration-500"
                        />
                      </svg>
                      <span className="text-xl font-bold font-mono text-white z-10">{item.digit}</span>
                      <span className={`text-[10px] font-semibold mt-0.5 z-10 ${isLowest ? 'text-rose-400' : 'text-gray-400'}`}>
                        {item.pct}%
                      </span>
                      {isCurrent && (
                        <span className="absolute -bottom-1 w-2 h-2 rounded-full bg-teal-400 animate-ping z-20"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </main>

          <aside className="w-full sm:w-80 bg-[#121217] border-t sm:border-t-0 sm:border-l border-[#22222c] flex flex-col h-auto sm:h-full text-white p-3 pb-28 sm:p-5 sm:pb-5 justify-between shrink-0 gap-3 sm:gap-0">
            <div className="space-y-2 sm:space-y-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-gray-400 border-b border-[#22222c] pb-2">
                <select value={tradeMode} onChange={(event) => setTradeMode(event.target.value as TradeMode)} className="max-w-[70%] bg-transparent text-xs font-bold uppercase text-gray-300 outline-none">
                  {TRADE_MODES.map((mode) => <option key={mode.id} value={mode.id} className="bg-[#17171f]">{mode.label}</option>)}
                </select>
                {isDigitMode && <span className="text-teal-400 font-mono">Barrier: {selectedDigit}</span>}
              </div>
              {isDigitMode ? (
                <div className="grid grid-cols-5 gap-1 sm:gap-1.5 bg-[#1b1b24] p-1.5 sm:p-2 rounded-xl border border-[#262633]">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button key={d} onClick={() => setSelectedDigit(d)} className={`py-1 sm:py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${selectedDigit === d ? 'bg-white text-black font-extrabold' : 'text-gray-400 hover:text-white hover:bg-[#252533]'}`}>{d}</button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#262633] bg-[#1b1b24] p-3 text-center text-xs text-gray-400">Choose a direction below to place this contract.</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl border border-[#262633] bg-[#1b1b24] px-2 py-1.5 sm:p-2 text-center text-[9px] sm:text-[10px] uppercase text-gray-500">Ticks
                  <span className="mt-0.5 sm:mt-1 flex items-center justify-between text-sm font-bold text-white"><button type="button" onClick={() => setTicksCount((value) => Math.max(1, value - 1))} className="rounded-lg bg-[#252533] px-2 py-0.5 sm:py-1 text-gray-300">-</button><span>{ticksCount}</span><button type="button" onClick={() => setTicksCount((value) => value + 1)} className="rounded-lg bg-[#252533] px-2 py-0.5 sm:py-1 text-gray-300">+</button></span>
                </label>
                <label className="rounded-xl border border-[#262633] bg-[#1b1b24] px-2 py-1.5 sm:p-2 text-center text-[9px] sm:text-[10px] uppercase text-gray-500">Stake
                  <input type="number" min="0.35" step="0.01" value={stake} onChange={(event) => setStake(Number(event.target.value))} className="mt-0.5 sm:mt-1 w-full bg-transparent text-center text-sm font-bold text-white outline-none" />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 sm:pt-4 border-t border-[#22222c]">
              {tradeButtons.map((button, index) => <button key={button.type} onClick={() => handlePurchase(button.type)} className={`py-3 px-2 rounded-xl text-center font-bold cursor-pointer ${index === 0 ? 'bg-teal-500 text-black' : 'bg-rose-600 text-white'}`}>{button.label}</button>)}
            </div>
            <div className="mt-3 space-y-1.5 rounded-xl border border-[#22222c] bg-[#181820] p-3 text-[11px] sm:hidden">
              <div className="flex items-center justify-between"><span className="text-gray-500">Market</span><span className="font-semibold text-gray-200">{liveMarkets.find((market) => market.id === selectedSymbol)?.name ?? selectedSymbol}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Contract</span><span className="font-semibold text-gray-200">{TRADE_MODES.find((mode) => mode.id === tradeMode)?.label}{isDigitMode ? ` · Digit ${selectedDigit}` : ''}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Ticks</span><span className="font-semibold text-gray-200">{ticksCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Stake at risk</span><span className="font-semibold text-white">{stake.toFixed(2)} USD</span></div>
            </div>
          </aside>
        </div>
      )}

      {currentTab === 'positions' && (
        <main className="flex flex-1 overflow-hidden bg-[#101116] text-white">
          <div className="hidden md:block"><PositionsDrawer positions={positions} /></div>
          <section className="flex-1 overflow-y-auto p-0 sm:p-6">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col border-x border-[#242630] bg-[#111217]">
            <div className="flex items-center justify-between border-b border-[#252630] px-4 py-4 sm:px-6"><div><p className="text-lg font-extrabold">Positions</p><p className="mt-1 text-[10px] text-gray-500">Recorded trading activity</p></div><span className="text-gray-500">×</span></div>
            <div className="grid grid-cols-3 border-b border-[#252630]">{(['summary', 'transactions', 'journal'] as const).map((tab) => <button key={tab} onClick={() => setPositionsPanelTab(tab)} className={`border-b-2 px-2 py-3 text-xs font-semibold capitalize transition-colors ${positionsPanelTab === tab ? 'border-rose-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>{tab}</button>)}</div>
            {positionsPanelTab === 'summary' && <>
              {positions.length === 0 ? <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center px-6 text-center"><div className="grid h-12 w-12 place-items-center rounded-xl border border-[#30313c] bg-[#1b1c25] text-lg">▥</div><p className="mt-4 text-sm font-bold text-gray-200">No positions yet</p><p className="mt-1 text-[10px] text-gray-500">Completed or open trades will appear here.</p></div> : <div className="space-y-2 p-4 sm:p-6">{positions.map((position) => <div key={position.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#262633] bg-[#1b1b24] p-4"><div><p className="font-bold">{position.symbol}</p><p className="text-xs text-gray-400">{position.contract} · Contract #{position.id}</p></div><div className="text-right"><p className="font-bold">{position.stake.toFixed(2)} USD</p><p className="text-xs text-emerald-400">{position.status}</p></div></div>)}</div>}
              <div className="border-t border-[#252630] px-4 py-5 sm:px-6"><div className="grid grid-cols-3 gap-y-5 text-center"><div><p className="text-[9px] uppercase text-gray-500">Total stake</p><p className="text-xs font-bold">{positions.reduce((total, position) => total + position.stake, 0).toFixed(2)} USD</p></div><div><p className="text-[9px] uppercase text-gray-500">Total payout</p><p className="text-xs font-bold">0.00 USD</p></div><div><p className="text-[9px] uppercase text-gray-500">No. of runs</p><p className="text-xs font-bold">{positions.length}</p></div><div><p className="text-[9px] uppercase text-gray-500">Contracts lost</p><p className="text-xs font-bold">0</p></div><div><p className="text-[9px] uppercase text-gray-500">Contracts won</p><p className="text-xs font-bold">0</p></div><div><p className="text-[9px] uppercase text-gray-500">Total profit/loss</p><p className="text-xs font-bold text-emerald-400">0.00 USD</p></div></div><button onClick={() => { setPositions([]); sessionStorage.removeItem('smart-trades-positions'); }} className="mt-5 w-full rounded-xl border border-[#363744] bg-[#1d1e27] py-2.5 text-xs font-bold text-gray-200 transition hover:border-rose-400 hover:text-white">Reset</button></div>
            </>}
            {positionsPanelTab === 'transactions' && <div className="flex min-h-[340px] flex-1 items-center justify-center p-6 text-xs text-gray-500">No active contract transactions yet.</div>}
            {positionsPanelTab === 'journal' && <div className="flex min-h-[340px] flex-1 items-center justify-center p-6 text-xs text-gray-500">System logs and triggers will appear here.</div>}
          </div>
          </section>
        </main>
      )}

      {currentTab === 'signal' && (
        <main className="relative flex-1 overflow-y-auto bg-[#16161c] p-4 text-white sm:p-8">
          {isSearchingSignals && <div className="signal-cinema" role="status" aria-live="polite"><div className="signal-cinema__scanline" /><div className="signal-cinema__radar" aria-hidden="true"><span /><i /><b /></div><p className="signal-cinema__eyebrow">SIGNAL ENGINE // LIVE SCAN</p><h2>Reading market behavior</h2><p className="signal-cinema__message">Sampling recent ticks, digit frequency, and contract patterns for {signalMarket}.</p><div className="signal-cinema__steps"><span className="signal-cinema__step signal-cinema__step--active">01 HISTORY</span><span className="signal-cinema__step">02 FREQUENCY</span><span className="signal-cinema__step">03 CONTEXT</span></div><div className="signal-cinema__bar"><span /></div></div>}
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">Digit signal</p><h1 className="mt-1 text-2xl font-extrabold">Hourly signal</h1><p className="mt-2 text-sm text-gray-400">Choose a market to scan the next hour.</p></div><select value={signalMarket} onChange={(event) => { setSignalMarket(event.target.value); playSignalBeep(); }} className="rounded-xl border border-[#30303d] bg-[#1b1b24] px-3 py-2 text-sm font-bold text-white outline-none">{liveMarkets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}</select></div>
            <div className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#08131c] p-5"><div className="flex items-center gap-4"><div className="relative grid h-14 w-14 place-items-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 text-2xl shadow-[0_0_25px_rgba(34,211,238,0.25)]"><span className="animate-pulse">◉</span><span className="absolute inset-0 animate-ping rounded-xl border border-cyan-400/40" /></div><div><p className="font-mono text-sm font-bold text-cyan-300">SIGNAL ENGINE // {isSearchingSignals ? 'SEARCHING...' : 'SCAN COMPLETE'}</p><p className="mt-1 text-xs text-slate-400">{isSearchingSignals ? `Scanning ${signalMarket} patterns and digit frequencies` : `Hourly scan ready for ${signalMarket}`}</p></div></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full bg-cyan-400 transition-all duration-700 ${isSearchingSignals ? 'w-2/3 animate-pulse' : 'w-full'}`} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#262633] bg-[#1b1b24] p-5"><p className="text-xs uppercase text-gray-500">Even / Odd</p><p className="mt-2 text-lg font-extrabold text-teal-400">{analysisStats.filter((item) => item.digit % 2 === 0).reduce((sum, item) => sum + item.pct, 0)}% Even</p><p className="text-sm text-gray-400">{analysisStats.filter((item) => item.digit % 2 !== 0).reduce((sum, item) => sum + item.pct, 0)}% Odd</p><p className="mt-3 text-xs text-gray-500">Suggested side: {analysisStats.filter((item) => item.digit % 2 === 0).reduce((sum, item) => sum + item.count, 0) >= analysisStats.filter((item) => item.digit % 2 !== 0).reduce((sum, item) => sum + item.count, 0) ? 'Even' : 'Odd'}</p></div>
              <div className="rounded-2xl border border-[#262633] bg-[#1b1b24] p-5"><p className="text-xs uppercase text-gray-500">Over / Under</p><p className="mt-2 text-lg font-extrabold text-teal-400">{analysisStats.filter((item) => item.digit > 5).reduce((sum, item) => sum + item.pct, 0)}% Over 5</p><p className="text-sm text-gray-400">{analysisStats.filter((item) => item.digit < 5).reduce((sum, item) => sum + item.pct, 0)}% Under 5</p><p className="mt-3 text-xs text-gray-500">Most common digit: {analysisStats.reduce((best, item) => item.count > best.count ? item : best, analysisStats[0]).digit}</p></div>
            </div>
            {currentTab === 'signal' && <div className="grid gap-3 sm:grid-cols-2">{TRADE_MODES.map((mode) => { const even = analysisStats.filter((item) => item.digit % 2 === 0).reduce((sum, item) => sum + item.pct, 0); const over = analysisStats.filter((item) => item.digit > 5).reduce((sum, item) => sum + item.pct, 0); const common = analysisStats.reduce((best, item) => item.count > best.count ? item : best, analysisStats[0]).digit; const suggestion = mode.id === 'EVEN_ODD' ? (even >= 50 ? 'Even' : 'Odd') : mode.id === 'OVER_UNDER' ? (over >= 50 ? 'Over 5' : 'Under 5') : mode.id === 'MATCHES_DIFFERS' ? `Match ${common}` : mode.label.split(' / ')[0]; return <div key={mode.id} className="flex items-center justify-between rounded-xl border border-[#262633] bg-[#1b1b24] p-4"><div><p className="text-xs text-gray-500">{mode.label}</p><p className="mt-1 font-bold text-white">{suggestion}</p></div><span className="rounded-lg bg-teal-400/10 px-2 py-1 text-[10px] font-bold uppercase text-teal-300">1 hour</span></div>; })}</div>}
            <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-5"><p className="text-xs uppercase tracking-wider text-teal-400">Statistical context</p><p className="mt-2 text-lg font-bold">Consider {analysisStats.filter((item) => item.digit > 5).reduce((sum, item) => sum + item.pct, 0) >= analysisStats.filter((item) => item.digit < 5).reduce((sum, item) => sum + item.pct, 0) ? 'Over 5' : 'Under 5'}</p><p className="mt-1 text-xs text-gray-400">Signals summarize recent ticks and cannot guarantee the next outcome.</p></div>
          </div>
        </main>
      )}

      {/* Dashboard View */}
      {currentTab === 'dashboard' && (
        <main className="flex-1 flex flex-col items-center justify-start bg-[#16161c] overflow-y-auto p-10 space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-2 mt-4">
            <p className="text-gray-300 text-sm">
              Import a bot from your computer or Google Drive, build it from scratch, or start with a quick strategy.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-6 max-w-3xl w-full">
            <label className="flex flex-col items-center justify-center bg-[#1b1b24] border border-[#262633] hover:border-teal-500/50 p-6 rounded-2xl cursor-pointer transition-all shadow-md group space-y-3">
              <span className="text-xs font-semibold text-gray-200">My computer</span>
              <div className="w-12 h-12 rounded-xl bg-[#222230] flex items-center justify-center text-xl">💻</div>
              <input type="file" accept=".xml,.json" onChange={handleFileUpload} className="hidden" />
            </label>

            <button 
              onClick={handleGoogleSignIn}
              className="flex flex-col items-center justify-center bg-[#1b1b24] border border-[#262633] hover:border-emerald-500/50 p-6 rounded-2xl cursor-pointer transition-all shadow-md space-y-3 group"
            >
              <span className="text-xs font-semibold text-gray-200">Google Drive</span>
              <div className="w-12 h-12 rounded-xl bg-[#222230] flex items-center justify-center text-xl">📁</div>
            </button>

            <button 
              onClick={() => setCurrentTab('bot-builder')}
              className="flex flex-col items-center justify-center bg-[#1b1b24] border border-[#262633] hover:border-sky-500/50 p-6 rounded-2xl cursor-pointer transition-all shadow-md space-y-3 group"
            >
              <span className="text-xs font-semibold text-gray-200">Bot Builder</span>
              <div className="w-12 h-12 rounded-xl bg-[#222230] flex items-center justify-center text-xl">🧩</div>
            </button>

            <button 
              onClick={() => setIsQuickStrategyOpen(true)}
              className="flex flex-col items-center justify-center bg-[#1b1b24] border border-[#262633] hover:border-purple-500/50 p-6 rounded-2xl cursor-pointer transition-all shadow-md space-y-3 group"
            >
              <span className="text-xs font-semibold text-gray-200">Quick strategy</span>
              <div className="w-12 h-12 rounded-xl bg-[#222230] flex items-center justify-center text-xl">⚡</div>
            </button>
          </div>

          <div className="max-w-3xl w-full bg-[#1b1b24] border border-[#262633] rounded-2xl p-6 shadow-inner space-y-4">
            <h3 className="text-sm font-bold text-gray-300">Your bots:</h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-[#262633] pb-2">
                  <th className="pb-3 font-semibold">Bot name</th>
                  <th className="pb-3 font-semibold">Last modified</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262633]/50">
                {dashboardBots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-[#22222c] transition-colors">
                    <td className="py-3.5 font-medium text-white">{bot.name}</td>
                    <td className="py-3.5 text-gray-400">{bot.lastModified}</td>
                    <td className="py-3.5 text-amber-400 font-mono text-[11px]">{bot.status}</td>
                    <td className="py-3.5 text-right space-x-3">
                      <button onClick={() => handleDuplicateBot(bot)} title="Duplicate">📄</button>
                      <button onClick={() => alert(`Saving ${bot.name}`)} title="Save">💾</button>
                      <button onClick={() => handleDeleteBot(bot.id)} title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Bot Builder Workspace View */}
      {currentTab === 'bot-builder' && (
        <div className="flex flex-1 flex-col overflow-y-auto bg-[#f4f5f7] pb-16 text-gray-800 md:flex-row md:overflow-hidden md:pb-0">
          <div className="w-full bg-white border-b border-gray-200 flex flex-col shrink-0 shadow-sm md:w-64 md:border-b-0 md:border-r">
            <div className="p-3 border-b border-gray-200">
              <button 
                onClick={() => setIsQuickStrategyOpen(true)} 
                className="w-full bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>Quick strategy</span>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">Blocks menu</span>
              <button onClick={() => setCurrentTab('dashboard')} className="text-[11px] text-blue-600 hover:underline cursor-pointer">← Exit</button>
            </div>

            <div className="p-3">
              <div className="flex items-center bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 space-x-2">
                <span className="text-gray-400 text-xs">🔍</span>
                <input type="text" placeholder="Search" className="w-full bg-transparent text-xs text-gray-800 outline-none" />
              </div>
            </div>

            <div className="flex max-h-64 flex-col text-xs font-medium divide-y divide-gray-100 overflow-y-auto md:max-h-none">
              {[
                'Trade parameters', 
                'Purchase conditions', 
                'Sell conditions (optional)', 
                'Restart trading conditions', 
                'Analysis', 
                'Utility'
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setBuilderCategory(cat);
                    if (cat === 'Purchase conditions' || cat === 'Sell conditions (optional)') {
                      setActiveCategoryModal(cat);
                    }
                  }}
                  className={`text-left px-4 py-3.5 transition-colors cursor-pointer flex items-center justify-between ${builderCategory === cat ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>{cat}</span>
                  <span className="text-gray-400">⌄</span>
                </button>
              ))}
            </div>

            <div className="p-4 mt-auto border-t border-gray-200">
              <button className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold py-2 px-3 rounded-lg shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer">
                <span>⚠️ Risk Disclaimer</span>
              </button>
            </div>
          </div>

          <div className="flex min-h-[420px] w-full flex-col overflow-hidden bg-[#f8f9fa] relative md:min-h-0 md:flex-1">
            <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 space-x-3 shrink-0 overflow-x-auto shadow-sm">
              <button title="Undo" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">🔄</button>
              <button title="Folder" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">📁</button>
              <button title="Save" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">💾</button>
              <button title="List" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">📊</button>
              <div className="h-4 w-[1px] bg-gray-300"></div>
              <button title="Undo Action" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">↩️</button>
              <button title="Redo Action" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">↪️</button>
              <button title="Delete All" className="p-1.5 hover:bg-gray-100 rounded text-gray-600">🗑️</button>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-4 relative sm:p-8 sm:space-y-6">
              <div className="bg-[#1e293b] text-white rounded-xl p-4 shadow-md w-full max-w-2xl space-y-3 border border-slate-700">
                <div className="text-xs font-bold text-teal-400">1. Trade parameters</div>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Market: Derived</div>
                  <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Continuous Indices</div>
                  <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Volatility 10 Index</div>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Trade Type: Up/Down</div>
                  <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Contract Type: Both</div>
                </div>
                <div className="text-[11px] text-gray-300">Default Candle Interval: <span className="bg-[#0f172a] px-2 py-1 rounded border border-slate-700 ml-1">1 minute</span></div>
              </div>

              {/* Rendered Purchase Conditions Block on Canvas with nested Purchase Blocks */}
              <div className="bg-[#1e293b] text-white rounded-xl p-4 shadow-md w-full max-w-2xl space-y-3 border border-blue-500/50">
                <div className="text-xs font-bold text-blue-400">2. Purchase conditions</div>
                <div className="space-y-2">
                  {canvasPurchaseBlocks.map((blockType, idx) => (
                    <div key={idx} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 flex items-center justify-between text-xs font-mono">
                      <span>Purchase {blockType}</span>
                      <button 
                        onClick={() => setCanvasPurchaseBlocks(prev => prev.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:text-rose-300 text-xs font-sans cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {canvasPurchaseBlocks.length === 0 && (
                    <div className="text-[11px] text-gray-400 italic">No purchase blocks added yet. Click 'Purchase conditions' in the left menu to add one.</div>
                  )}
                </div>
              </div>

              <div className="bg-[#1e293b] text-white rounded-xl p-4 shadow-md w-full max-w-2xl space-y-3 border border-emerald-500/50">
                <div className="text-xs font-bold text-emerald-400">3. Sell conditions (optional)</div>
                <div className="space-y-2">
                  <div className="bg-[#0f172a] p-2.5 rounded border border-slate-700 text-xs font-mono">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-emerald-400">if</span>
                      <span className="text-gray-500">then</span>
                    </div>
                  </div>
                  {canvasSellBlocks.map((blockType, idx) => (
                    <div key={idx} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 flex items-center justify-between text-xs font-mono">
                      <span>Sell {blockType}</span>
                      <button
                        onClick={() => setCanvasSellBlocks(prev => prev.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:text-rose-300 text-xs font-sans cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {canvasSellBlocks.length === 0 && (
                    <div className="text-[11px] text-gray-400 italic">Add a sell block inside the condition.</div>
                  )}
                </div>
              </div>

              {activeStrategyConfig && (
                <div className="bg-[#1e293b] text-white rounded-xl p-4 shadow-md w-full max-w-2xl space-y-2 border border-blue-500/50">
                  <div className="text-xs font-bold text-blue-400">Active Strategy Loaded: {activeStrategyConfig.strategyName}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
                    <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Initial Stake: {activeStrategyConfig.initialStake}</div>
                    <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Factor/Step: {activeStrategyConfig.factor}</div>
                    <div className="bg-[#0f172a] p-2 rounded border border-slate-700">Max Limit: {activeStrategyConfig.maxLimit}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-full bg-white border-t border-gray-200 flex min-h-[280px] flex-col justify-between shrink-0 shadow-sm md:w-80 md:min-h-0 md:border-l md:border-t-0">
            <div>
              <div className="flex border-b border-gray-200 text-xs font-semibold">
                {['summary', 'transactions', 'journal'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightPanelTab(tab as any)}
                    className={`flex-1 py-3 text-center capitalize transition-colors cursor-pointer ${rightPanelTab === tab ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-6 text-center space-y-6">
                {rightPanelTab === 'summary' && (
                  <div className="py-12 text-gray-500 text-xs leading-relaxed">
                    When you're ready to trade, hit <span className="text-blue-600 font-bold">Run</span>.<br />
                    You'll be able to track your bot's performance here.
                  </div>
                )}
                {rightPanelTab === 'transactions' && (
                  <div className="py-12 text-gray-500 text-xs">No active contract transactions yet.</div>
                )}
                {rightPanelTab === 'journal' && (
                  <div className="py-12 text-gray-500 text-xs">System logs and triggers will appear here.</div>
                )}

                <div className="grid grid-cols-2 gap-4 text-left border-t border-gray-200 pt-4 text-xs">
                  <div>
                    <div className="text-gray-500">Current Stake</div>
                    <div className="font-bold text-sm text-gray-800">{stake.toFixed(2)} AUD</div>
                  </div>
                  <div>
                    <div className="text-gray-500">No. of runs</div>
                    <div className="font-bold text-sm text-gray-800">{botRuns}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total profit/loss</div>
                    <div className={`font-bold text-sm ${botProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{botProfit.toFixed(2)} AUD</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex space-x-3 items-center">
              <button 
                onClick={() => { setBotRuns(0); setBotProfit(0); setIsBotRunning(false); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Reset
              </button>
              <button 
                onClick={() => {
                  const newRunningState = !isBotRunning;
                  setIsBotRunning(newRunningState);
                  if (newRunningState) {
                    setBotRuns(prev => prev + 1);
                    const outcome = Math.random() > 0.4 ? 'win' : 'loss';
                    const delta = outcome === 'win' ? 5 : -3;
                    setBotProfit(prev => prev + delta);
                    calculateNextStake(outcome);
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${isBotRunning ? 'bg-rose-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'}`}
              >
                {isBotRunning ? 'Stop' : 'Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Flyout / Modal for Purchase Conditions (Matches Image 2) */}
      {(activeCategoryModal === 'Purchase conditions' || activeCategoryModal === 'Sell conditions (optional)') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-gray-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-950">{activeCategoryModal}</h2>
              <div className="flex items-center space-x-3">
                {/* Plus button to add purchase block to workspace */}
                <button 
                  onClick={() => {
                    if (activeCategoryModal === 'Purchase conditions') {
                      setCanvasPurchaseBlocks(prev => [...prev, 'Rise']);
                    } else {
                      setCanvasSellBlocks(prev => [...prev, 'is available']);
                    }
                    setActiveCategoryModal(null);
                  }}
                  title="Add block to workspace"
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer shadow-sm"
                >
                  +
                </button>
                <button 
                  onClick={() => setActiveCategoryModal(null)}
                  className="text-gray-400 hover:text-gray-700 text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              <p className="text-xs text-gray-600 leading-relaxed">
                {activeCategoryModal === 'Purchase conditions'
                  ? 'This block is mandatory. Only one copy of this block is allowed. You can place the Purchase block here as well as conditional blocks to define your purchase conditions.'
                  : 'This optional block lets you define conditions for selling an active contract. Add sell blocks here to control when the bot exits a trade.'}
                {' '}<a href="#" className="text-rose-600 font-semibold hover:underline">Learn more</a>
              </p>

              <div className={`p-4 rounded-xl text-white space-y-2 shadow-inner ${activeCategoryModal === 'Purchase conditions' ? 'bg-[#1e3a5f]' : 'bg-[#14532d]'}`}>
                <div className="text-xs font-semibold">{activeCategoryModal === 'Purchase conditions' ? '2. Purchase conditions' : '3. Sell conditions (optional)'}</div>
                <div className="w-full bg-[#1b2a47] h-8 rounded border border-blue-400/30"></div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-bold text-gray-900">{activeCategoryModal === 'Purchase conditions' ? 'Purchase' : 'Sell'}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {activeCategoryModal === 'Purchase conditions'
                    ? 'Use this block to purchase the specific contract you want. You may add multiple Purchase blocks together with conditional blocks to define your purchase conditions.'
                    : 'Use this block to define when the bot should sell an active contract. You may add multiple Sell blocks together with conditional blocks.'}
                </p>

                <div className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 space-x-4">
                  <span className="text-xs font-mono font-bold text-gray-700">{activeCategoryModal === 'Purchase conditions' ? 'Purchase' : 'Sell'}</span>
                  <span className="text-gray-400 text-xs">▼</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Strategy Modal */}
      {isQuickStrategyOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col text-gray-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">Quick Strategy</h2>
              <button 
                onClick={() => setIsQuickStrategyOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 h-[520px]">
              <div className="w-64 bg-gray-50 border-r border-gray-200 p-6 flex flex-col space-y-6">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Choose a template below and set your trade parameters.
                </p>
                <div className="relative pl-6 space-y-8">
                  <div className="absolute left-2.5 top-3 bottom-3 w-[2px] bg-blue-600"></div>

                  <div className="relative flex items-center space-x-3 cursor-pointer" onClick={() => setQuickStrategyStep('template')}>
                    <div className={`absolute -left-6 w-4 h-4 rounded-full border-2 flex items-center justify-center ${quickStrategyStep === 'template' ? 'border-blue-600 bg-blue-600' : 'border-gray-400 bg-white'}`}>
                      {quickStrategyStep === 'template' ? (
                        <span className="w-2 h-2 rounded-full bg-white"></span>
                      ) : (
                        <span className="text-[10px] text-white font-bold">✓</span>
                      )}
                    </div>
                    <div className="font-bold text-gray-900">Choose template</div>
                  </div>

                  <div className="relative flex items-center space-x-3 cursor-pointer" onClick={() => selectedStrategy && setQuickStrategyStep('parameters')}>
                    <div className={`absolute -left-6 w-4 h-4 rounded-full border-2 flex items-center justify-center ${quickStrategyStep === 'parameters' ? 'border-blue-600 bg-blue-600' : 'border-gray-400 bg-white'}`}>
                      {quickStrategyStep === 'parameters' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                    </div>
                    <div className={`font-bold ${selectedStrategy ? 'text-gray-900' : 'text-gray-400'}`}>Set parameters</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                {quickStrategyStep === 'template' ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        {(['all', 'accumulators', 'options'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setStrategyFilter(filter)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                              strategyFilter === filter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Search strategy..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none w-48"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[320px] pr-2">
                      {(strategyFilter === 'all' || strategyFilter === 'options') &&
                        optionsStrategies
                          .filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((strat) => (
                            <div
                              key={`opt-${strat}`}
                              onClick={() => setSelectedStrategy(strat)}
                              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                selectedStrategy === strat ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-900">{strat}</span>
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Options</span>
                              </div>
                              <span className="text-[11px] text-gray-500 mt-2">Standard risk management strategy for options trading.</span>
                            </div>
                          ))}

                      {(strategyFilter === 'all' || strategyFilter === 'accumulators') &&
                        accumulatorsStrategies
                          .filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((strat) => (
                            <div
                              key={`acc-${strat}`}
                              onClick={() => setSelectedStrategy(strat)}
                              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                selectedStrategy === strat ? 'border-purple-600 bg-purple-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-900">{strat}</span>
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">Accumulators</span>
                              </div>
                              <span className="text-[11px] text-gray-500 mt-2">Tailored progressive risk algorithm for accumulator indices.</span>
                            </div>
                          ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-blue-600 font-semibold uppercase">Selected Template</div>
                          <div className="text-sm font-bold text-gray-900">{selectedStrategy}</div>
                        </div>
                        <button onClick={() => setQuickStrategyStep('template')} className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer">Change</button>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-700">Initial Stake</label>
                          <input
                            type="number"
                            value={initialStakeInput}
                            onChange={(e) => setInitialStakeInput(parseFloat(e.target.value) || 1)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-700">Martingale Factor</label>
                          <input
                            type="number"
                            value={martingaleFactorInput}
                            onChange={(e) => setMartingaleFactorInput(parseFloat(e.target.value) || 2)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-blue-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-700">Max Stake Limit</label>
                          <input
                            type="number"
                            value={maxStakeLimitInput}
                            onChange={(e) => setMaxStakeLimitInput(parseFloat(e.target.value) || 100)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-auto">
                  {quickStrategyStep === 'parameters' ? (
                    <button
                      onClick={() => setQuickStrategyStep('template')}
                      className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Back
                    </button>
                  ) : (
                    <div></div>
                  )}

                  {quickStrategyStep === 'template' ? (
                    <button
                      disabled={!selectedStrategy}
                      onClick={() => setQuickStrategyStep('parameters')}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all ${
                        selectedStrategy ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleLoadStrategyToWorkspace}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 cursor-pointer transition-all"
                    >
                      Load Strategy to Workspace
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {authStatus === 'failed' && <div className="fixed bottom-16 left-1/2 z-40 max-w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-rose-500/40 bg-[#29151b] px-4 py-3 text-xs text-rose-200 shadow-xl">Deriv login could not be completed: {authError || 'Please try again.'}</div>}
      {authStatus === 'authorizing' && (
        <div className="auth-cinema fixed inset-0 z-[70] overflow-hidden bg-[#05080d]" role="status" aria-live="polite">
          <div className="auth-cinema__grid" />
          <div className="auth-cinema__noise" />
          <div className="auth-cinema__content">
            <div className="auth-cinema__scene" aria-hidden="true">
              <div className="auth-cinema__ring auth-cinema__ring--outer" />
              <div className="auth-cinema__ring auth-cinema__ring--inner" />
              <div className="auth-cinema__core"><span>ST</span></div>
              <i className="auth-cinema__spark auth-cinema__spark--one" />
              <i className="auth-cinema__spark auth-cinema__spark--two" />
              <i className="auth-cinema__spark auth-cinema__spark--three" />
            </div>
            <p className="auth-cinema__eyebrow">SECURE DERIV LINK</p>
            <h1>Entering the market</h1>
            <p className="auth-cinema__message">Authenticating your account and preparing the live trading connection.</p>
            <div className="auth-cinema__progress" aria-hidden="true"><span /></div>
            <p className="auth-cinema__status"><span /> Establishing encrypted session</p>
          </div>
        </div>
      )}
      {isCashierOpen && account && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setIsCashierOpen(false)}>
          <section className="w-full max-w-md rounded-2xl border border-[#30303d] bg-[#17171f] p-6 text-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cashier-title" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[0.18em] text-emerald-400">{account.loginid}</p><h2 id="cashier-title" className="mt-2 text-2xl font-extrabold">Cashier</h2></div><button onClick={() => setIsCashierOpen(false)} className="text-2xl text-gray-400 hover:text-white" aria-label="Close cashier">&times;</button></div>
            <div className="rounded-xl border border-[#30303d] bg-[#121217] p-4"><p className="text-xs text-gray-400">Available balance</p><p className="mt-1 text-2xl font-extrabold text-emerald-400">{account.balance === null ? '--' : account.balance.toFixed(2)} {account.currency}</p></div>
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[#121217] p-1">{(['deposit', 'withdraw', 'history'] as const).map((tab) => <button key={tab} onClick={() => setCashierTab(tab)} className={`rounded-lg px-2 py-2 text-xs font-bold capitalize ${cashierTab === tab ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-500 hover:text-gray-200'}`}>{tab}</button>)}</div>
            {cashierTab === 'history' ? (cashierTransactions.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-[#30303d] p-8 text-center text-xs text-gray-500">No transactions</div> : <div className="mt-4 space-y-2">{cashierTransactions.map((tx) => <div key={tx.id} className="flex items-center justify-between rounded-xl border border-[#30303d] bg-[#121217] p-3"><div><p className="text-xs font-bold capitalize text-gray-200">{tx.type} · {tx.phone}</p><p className="mt-0.5 text-[10px] text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p></div><div className="text-right"><p className="text-sm font-bold text-white">{tx.amount.toFixed(2)} {tx.currency}</p><p className={`text-[10px] font-bold capitalize ${tx.status === 'completed' ? 'text-emerald-400' : tx.status === 'failed' ? 'text-rose-400' : 'text-amber-400'}`}>{tx.status}</p></div></div>)}</div>) : <div className="mt-4 rounded-xl border border-[#30303d] bg-[#121217] p-4"><p className="text-sm font-bold text-gray-200">{cashierTab === 'deposit' ? 'Pay with M-Pesa' : 'Withdraw to M-Pesa'}</p><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Phone</label><input value={cashierPhone} onChange={(event) => setCashierPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-[#30303d] bg-[#17171f] px-3 py-2 text-sm text-white outline-none" inputMode="tel" placeholder="07XX XXX XXX" /><label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Amount {account.currency} · min 5</label><input value={cashierAmount} onChange={(event) => setCashierAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-[#30303d] bg-[#17171f] px-3 py-2 text-sm text-white outline-none" type="number" min="5" placeholder="0.00" /><div className="mt-3 flex gap-1.5">{[5, 10, 20, 50, 100].map((amount) => <button key={amount} onClick={() => setCashierAmount(String(amount))} className="rounded-md border border-[#30303d] px-2 py-1 text-[10px] text-gray-400 hover:border-emerald-400 hover:text-emerald-300">${amount}</button>)}</div><button disabled={cashierTab !== 'deposit' || isCashierSubmitting} onClick={() => void handleCashierDeposit()} className="mt-4 w-full rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{cashierTab === 'deposit' ? (isCashierSubmitting ? 'Sending prompt...' : 'Pay with M-Pesa') : 'Request withdrawal (coming soon)'}</button>{cashierStatus && <p className="mt-3 text-center text-[10px] text-gray-400">{cashierStatus}</p>}</div>}
            <p className="mt-4 text-center text-[10px] text-gray-600">Powered by DeriPay</p>
          </section>
        </div>
      )}
    </div>
  );
}
