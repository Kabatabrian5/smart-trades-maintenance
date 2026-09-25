import React, { useEffect, useRef, useState } from 'react';
import PositionsDrawer from './components/layout/PositionsDrawer';
import { useDerivSocket } from './hooks/useDerivSocket';
import { derivService } from './services/derivSocket';
import { fetchOptionsAccounts, requestAccountWebSocketUrl, pickPrimaryAccount, type DerivOptionsAccount } from './services/derivAccounts';
import { scanMarket, recommendBot, type MarketType } from './lib/botRegistry';

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

interface BotTemplate {
  id: string;
  name: string;
  file: string;
  description: string;
  accent: string;
}

const BOT_TEMPLATES: BotTemplate[] = [
  { id: 'accumulators-pro', name: 'Accumulators Pro', file: 'accumulators-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
  { id: 'asian-up-down-pro', name: 'Asian Up Down Pro', file: 'asian-up-down-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
  { id: 'even-odd-pro', name: 'Even Odd Pro', file: 'even-odd-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
  { id: 'matches-differs-pro', name: 'Matches Differs Pro', file: 'matches-differs-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
  { id: 'only-ups-down-pro', name: 'Only Ups Downs Pro', file: 'only-ups-down-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
  { id: 'over-under-pro', name: 'Over Under Pro', file: 'over-under-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
  { id: 'rise-fall-pro', name: 'Rise Fall Pro', file: 'rise-fall-pro.xml', description: 'Smart automated trading strategy', accent: 'from-violet-500 to-fuchsia-500' },
];

const TEMPLATE_RECOMMENDATION_BY_MARKET: Record<MarketType, BotTemplate['id']> = {
  volatility100: 'accumulators-pro',
  boom500: 'over-under-pro',
  jump75: 'rise-fall-pro',
  volatility50: 'only-ups-down-pro',
};

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
  duration: number;
  ticksElapsed?: number;
  lastDigit?: number;
  createdAt?: number;
  contractValue?: number;
  payout?: number;
  profit?: number;
  status: 'Pending' | 'Open' | 'Settled';
  result?: 'won' | 'lost';
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
const DERIV_DEPOSIT_URL = 'https://home.deriv.com/dashboard/deposit?from=home&depositSheet=1&returnTo=%2Fhome&currency=USD';
const DERIV_WITHDRAW_URL = 'https://home.deriv.com/dashboard/withdraw/verify?currency=USD&from=more';

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

function marketSymbolToMarketType(symbol: string): MarketType {
  const normalized = symbol.toUpperCase();
  if (normalized.includes('1HZ100V') || normalized.includes('R_100')) return 'volatility100';
  if (normalized.includes('BOOM500') || normalized.includes('BOOM')) return 'boom500';
  if (normalized.includes('JD75') || normalized.includes('JUMP75') || normalized.includes('JD')) return 'jump75';
  if (normalized.includes('1HZ50V') || normalized.includes('R_50') || normalized.includes('VOL50')) return 'volatility50';
  return 'volatility100';
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
    prompt: 'login',
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

function playTradeSound(result: 'won' | 'lost') {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  const start = context.currentTime;
  oscillator.frequency.setValueAtTime(result === 'won' ? 520 : 180, start);
  oscillator.frequency.linearRampToValueAtTime(result === 'won' ? 880 : 110, start + 0.22);
  gain.gain.setValueAtTime(0.045, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.24);
}

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [appMode, setAppMode] = useState<'client' | 'admin'>('client');
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => sessionStorage.getItem('smart-trades-admin-unlocked') === 'true');
  const [currentTab, setCurrentTab] = useState<'manual-trading' | 'positions' | 'analysis' | 'signal' | 'dashboard' | 'bot-builder' | 'bots' | 'copy-trading'>('manual-trading');
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [cashierTab, setCashierTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [availableAccounts, setAvailableAccounts] = useState<DerivOptionsAccount[]>([]);
  const [account, setAccount] = useState<DerivAccount | null>(() => {
    const savedAccount = sessionStorage.getItem('smart-trades-account');
    return savedAccount ? JSON.parse(savedAccount) as DerivAccount : null;
  });
  const [accountBalances, setAccountBalances] = useState<AccountBalances>({ real: null, demo: null, currency: 'USD' });
  const [authStatus, setAuthStatus] = useState<'idle' | 'authorizing' | 'failed'>('idle');
  const [authError, setAuthError] = useState('');
  const announcedSettlements = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => setIsBooting(false), 1700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  // Restore the authenticated socket after a page refresh. The account is persisted
  // locally, but the OTP-bearing WebSocket URL must be minted again for each session.
  useEffect(() => {
    if (!account) return;

    let isMounted = true;
    fetchOptionsAccounts(account.token, DERIV_CLIENT_ID)
      .then((accounts) => {
        if (!isMounted) return;
        setAvailableAccounts(accounts);
        return requestAccountWebSocketUrl(account.token, DERIV_CLIENT_ID, account.loginid);
      })
      .then((wsUrl) => {
        if (isMounted && wsUrl) derivService.connectToUrl(wsUrl);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        sessionStorage.removeItem('smart-trades-account');
        setAccount(null);
        setAuthError(error instanceof Error ? error.message : 'Saved Deriv session expired');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Deriv's current Options API: an OIDC access token doesn't authenticate a WebSocket
  // connection directly. Instead we list the user's accounts, mint a one-time-password
  // WebSocket URL for the chosen account, and connect straight to that (no `authorize`
  // message needed â€” the OTP in the URL does it).
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
    const accountStatus = nextAccount.status.toLowerCase();
    const unavailableStatuses = ['closed', 'disabled', 'suspended', 'inactive'];
    if (!account || nextAccount.account_id === account.loginid || unavailableStatuses.includes(accountStatus)) return;
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

  function handleLogout() {
    sessionStorage.removeItem('smart-trades-account');
    sessionStorage.removeItem('deriv_pkce_verifier');
    sessionStorage.removeItem('deriv_oauth_state');
    derivService.connectPublic();
    setAccount(null);
    setAvailableAccounts([]);
    setAccountBalances({ real: null, demo: null, currency: 'USD' });
    setAuthStatus('idle');
    setAuthError('');
    setIsAccountMenuOpen(false);
    setIsCashierOpen(false);
  }

  useEffect(() => {
    if (!account) return;

    const unsubscribeBalance = derivService.subscribe('balance', (data: { balance?: { balance?: number; loginid?: string; currency?: string } }) => {
      const balance = normalizeBalance(data.balance?.balance);
      if (balance === null) return;
      if (data.balance?.loginid && data.balance.loginid !== account.loginid) return;
      const isDemo = account.accountType === 'demo' || account.loginid.startsWith('VR');
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
    { id: 'copy-trading' as const, label: 'Copy trading' },
    { id: 'bots' as const, label: 'Bots' },
  ] as const;

  const handleNavigation = (id: (typeof navigationItems)[number]['id']) => {
    if (id === 'manual-trading' || id === 'positions' || id === 'signal' || id === 'dashboard' || id === 'bot-builder' || id === 'copy-trading' || id === 'bots') {
      setCurrentTab(id);
      return;
    }
  };

  const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'ben2026').trim();

  function requestAdminAccess() {
    if (adminUnlocked) {
      setAppMode('admin');
      return;
    }

    const password = window.prompt('Enter admin password');
    if (!password) return;

    if (password === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      sessionStorage.setItem('smart-trades-admin-unlocked', 'true');
      setAppMode('admin');
      return;
    }

    window.alert('Incorrect admin password');
  }

  function toggleBrianAdmin() {
    if (appMode === 'admin') {
      lockAdminAccess();
      return;
    }

    requestAdminAccess();
  }

  function lockAdminAccess() {
    setAdminUnlocked(false);
    sessionStorage.removeItem('smart-trades-admin-unlocked');
    setAppMode('client');
  }

  // Trading state
  const [selectedSymbol, setSelectedSymbol] = useState('1HZ100V');
  const [liveMarkets, setLiveMarkets] = useState(VOLATILITY_MARKETS);
  const [selectedDigit, setSelectedDigit] = useState<number>(3);
  const [tradeMode, setTradeMode] = useState<TradeMode>('MATCHES_DIFFERS');
  const [stake, setStake] = useState(10);
  const [executionMode, setExecutionMode] = useState<'single' | 'multiple'>('single');
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(true);
  const [stopLossEnabled, setStopLossEnabled] = useState(true);
  const [takeProfitTarget, setTakeProfitTarget] = useState(30);
  const [stopLossLimit, setStopLossLimit] = useState(-20);
  const [maxTradesPerCycle, setMaxTradesPerCycle] = useState(4);
  const [proposalPayouts, setProposalPayouts] = useState<Record<string, number | null>>({});
  const [ticksCount, setTicksCount] = useState(1);
  const [positions, setPositions] = useState<Position[]>(() => {
    const savedPositions = sessionStorage.getItem('smart-trades-positions');
    return savedPositions ? JSON.parse(savedPositions) as Position[] : [];
  });
  const [positionsPanelTab, setPositionsPanelTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
  const [signalMarket, setSignalMarket] = useState('1HZ100V');
  const [signalDigitStats, setSignalDigitStats] = useState(digitStatsPlaceholder());
  const [isSearchingSignals, setIsSearchingSignals] = useState(false);
  const [aiScannerOpen, setAiScannerOpen] = useState(false);
  const [scannerProgress, setScannerProgress] = useState(0);
  const { currentTick, marketStatus, digitHistory } = useDerivSocket(selectedSymbol);

  const signalMarketType = marketSymbolToMarketType(signalMarket);
  const signalScan = scanMarket(signalMarketType);
  const recommendedTemplate = BOT_TEMPLATES.find((template) => template.id === TEMPLATE_RECOMMENDATION_BY_MARKET[signalMarketType]) ?? BOT_TEMPLATES[0];
  const recommendedBot = recommendBot(signalMarketType);

  function handleAiScan() {
    setAiScannerOpen(true);
    setScannerProgress(0);
    const timer = window.setInterval(() => {
      setScannerProgress((current) => Math.min(current + 12, 96));
    }, 180);
    window.setTimeout(() => {
      window.clearInterval(timer);
      setScannerProgress(100);
    }, 950);
  }

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
  const [dashboardBots, setDashboardBots] = useState<BotItem[]>([]);
  const [selectedBotTemplate, setSelectedBotTemplate] = useState<BotTemplate | null>(null);
  const [botBuilderLoading, setBotBuilderLoading] = useState(false);
  const [botBuilderProgress, setBotBuilderProgress] = useState(0);
  const [botBuilderLastEvent, setBotBuilderLastEvent] = useState('Ready');
  const [isBotBuilderRunning, setIsBotBuilderRunning] = useState(false);

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

  const [journalPeriod, setJournalPeriod] = useState<'today' | 'yesterday' | 'all'>('today');

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
    openBotBuilder({ name: selectedStrategy, id: selectedStrategy, file: `${selectedStrategy.toLowerCase().replace(/\s+/g, '-')}.xml`, description: `${selectedStrategy} strategy`, accent: 'from-emerald-500 to-cyan-500' });
  };

  function openBotBuilder(template?: BotTemplate) {
    if (template) {
      setSelectedBotTemplate(template);
      setBotBuilderLastEvent(`Loading ${template.name}`);
    } else {
      setBotBuilderLastEvent('Loading workspace');
    }

    setBotBuilderLoading(true);
    setBotBuilderProgress(8);
    setCurrentTab('bot-builder');

    const timer = window.setInterval(() => {
      setBotBuilderProgress((current) => Math.min(current + 12, 92));
    }, 180);

    window.setTimeout(() => {
      window.clearInterval(timer);
      setBotBuilderProgress(100);
      setBotBuilderLoading(false);
      setBotBuilderLastEvent(template?.name ?? selectedStrategy ?? 'Strategy loaded');
    }, 900);
  }

  function loadBotTemplate(template: BotTemplate) {
    openBotBuilder(template);
  }

  function launchFloatingAiScan() {
    setCurrentTab('signal');
    setAiScannerOpen(true);
    setScannerProgress(0);
    const timer = window.setInterval(() => {
      setScannerProgress((current) => Math.min(current + 12, 96));
    }, 160);
    window.setTimeout(() => {
      window.clearInterval(timer);
      setScannerProgress(100);
    }, 950);
  }

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

  function resolvePositionProfit(rawProfit: number | null | undefined, payout: number, buyPrice: number): number {
    const fallback = payout > 0 ? payout - buyPrice : 0;
    const safeProfit = rawProfit ?? fallback;
    if (safeProfit === 0) return 0;
    return safeProfit < 0 ? -Math.abs(safeProfit) : Math.abs(safeProfit);
  }

  const handlePurchase = async (contractType: string) => {
    const cycleTrades = executionMode === 'multiple' ? Math.max(1, maxTradesPerCycle) : 1;

    try {
      for (let tradeIndex = 0; tradeIndex < cycleTrades; tradeIndex += 1) {
        const tradeStake = Math.max(0.35, stake);
        const needsBarrier = ['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER', 'ONETOUCH', 'NOTOUCH'].includes(contractType);
        const proposalRes = await derivService.send({
          proposal: 1,
          amount: tradeStake,
          basis: 'stake',
          currency: 'USD',
          underlying_symbol: selectedSymbol,
          contract_type: contractType,
          duration: ticksCount,
          duration_unit: 't',
          ...(needsBarrier ? { barrier: selectedDigit.toString() } : {}),
        });

        if (!proposalRes.proposal) break;

        const buyRes = await derivService.buyContract(proposalRes.proposal.id, proposalRes.proposal.ask_price);
        const recordedPosition: Position = {
          id: String(buyRes.buy.contract_id),
          symbol: selectedSymbol,
          contract: contractType,
          stake: tradeStake,
          duration: ticksCount,
          createdAt: Date.now(),
          status: 'Open',
        };
        setPositions((current) => {
          const updatedPositions = [recordedPosition, ...current];
          sessionStorage.setItem('smart-trades-positions', JSON.stringify(updatedPositions));
          return updatedPositions;
        });
        setCurrentTab('positions');
        await derivService.subscribeToContract(String(buyRes.buy.contract_id));
        await derivService.refreshBalance();

        if (takeProfitEnabled && totalProfitLoss >= takeProfitTarget) break;
        if (stopLossEnabled && totalProfitLoss <= stopLossLimit) break;
      }
      setCurrentTab('positions');
    } catch (error: any) {
      alert(`Trade failed: ${error.message || 'Unknown error'}`);
    }
  };

  const runLoadedBot = async () => {
    if (!account) {
      setAuthError('Log in to Deriv before running a bot.');
      setAuthStatus('failed');
      return;
    }

    setIsBotBuilderRunning(true);
    setBotBuilderLastEvent(`Running ${selectedBotTemplate?.name ?? activeStrategyConfig?.strategyName ?? 'strategy'}...`);

    try {
      await handlePurchase(selectedBotTemplate ? 'DIGITMATCH' : 'CALL');
      setBotBuilderLastEvent(`${selectedBotTemplate?.name ?? activeStrategyConfig?.strategyName ?? 'Strategy'} is live and executing.`);
    } catch (error) {
      setBotBuilderLastEvent(error instanceof Error ? error.message : 'Bot runtime failed');
    } finally {
      setIsBotBuilderRunning(false);
    }
  };

  useEffect(() => {
    if (!account) return;

    const unsubscribeContract = derivService.subscribe('proposal_open_contract', (data: {
      proposal_open_contract?: {
        contract_id?: number | string;
        is_sold?: number;
        status?: string;
        tick_count?: number | string;
        current_spot?: number | string;
        bid_price?: number | string;
        payout?: number | string;
        buy_price?: number | string;
        profit?: number | string;
      };
    }) => {
      const contract = data.proposal_open_contract;
      if (!contract?.contract_id) return;

      const contractId = String(contract.contract_id);
      const ticksElapsed = normalizeBalance(contract.tick_count);
      const currentSpot = normalizeBalance(contract.current_spot);
      const lastDigit = currentSpot === null ? undefined : Number(currentSpot.toFixed(2).slice(-1));
      const contractValue = normalizeBalance(contract.bid_price);
      const payout = normalizeBalance(contract.payout) ?? 0;
      const buyPrice = normalizeBalance(contract.buy_price) ?? 0;
      const rawProfit = normalizeBalance(contract.profit);
      const adjustedProfit = resolvePositionProfit(rawProfit, payout, buyPrice);
      const settled = Boolean(contract.is_sold) || contract.status === 'sold';
      const result: 'won' | 'lost' = adjustedProfit >= 0 ? 'won' : 'lost';

      setPositions((current) => {
        const updatedPositions = current.map((position) => position.id === contractId
          ? {
              ...position,
              ...(ticksElapsed === null ? {} : { ticksElapsed }),
              ...(lastDigit === undefined ? {} : { lastDigit }),
              ...(contractValue === null ? {} : { contractValue }),
              payout,
              profit: adjustedProfit,
              ...(settled ? { status: 'Settled' as const, result } : {}),
            }
          : position);
        sessionStorage.setItem('smart-trades-positions', JSON.stringify(updatedPositions));
        return updatedPositions;
      });

      if (settled) {
        if (!announcedSettlements.current.has(contractId)) {
          announcedSettlements.current.add(contractId);
          playTradeSound(result);
        }
        derivService.refreshBalance().catch(() => {});
      }
    });

    return unsubscribeContract;
  }, [account?.loginid]);

  const isDigitMode = ['MATCHES_DIFFERS', 'EVEN_ODD', 'OVER_UNDER'].includes(tradeMode);
  const tradeButtons = {
    MATCHES_DIFFERS: [{ label: 'Matches', type: 'DIGITMATCH' }, { label: 'Differs', type: 'DIGITDIFF' }],
    EVEN_ODD: [{ label: 'Even', type: 'DIGITEVEN' }, { label: 'Odd', type: 'DIGITODD' }],
    OVER_UNDER: [{ label: 'Over', type: 'DIGITOVER' }, { label: 'Under', type: 'DIGITUNDER' }],
    RISE_FALL: [{ label: 'Rise', type: 'CALL' }, { label: 'Fall', type: 'PUT' }],
    HIGHER_LOWER: [{ label: 'Higher', type: 'CALL' }, { label: 'Lower', type: 'PUT' }],
    TOUCH_NO_TOUCH: [{ label: 'Touch', type: 'ONETOUCH' }, { label: 'No Touch', type: 'NOTOUCH' }],
  }[tradeMode];

  useEffect(() => {
    if (!account || stake < 0.35) {
      setProposalPayouts({});
      return;
    }

    let isMounted = true;
    const quoteStake = Math.max(0.35, stake);
    const needsBarrier = ['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER', 'ONETOUCH', 'NOTOUCH'];

    Promise.all(tradeButtons.map(async (button) => {
      const response = await derivService.send({
        proposal: 1,
        amount: quoteStake,
        basis: 'stake',
        currency: 'USD',
        underlying_symbol: selectedSymbol,
        contract_type: button.type,
        duration: ticksCount,
        duration_unit: 't',
        ...(needsBarrier.includes(button.type) ? { barrier: selectedDigit.toString() } : {}),
      }).catch(() => null);
      return [button.type, normalizeBalance(response?.proposal?.payout)] as const;
    })).then((quotes) => {
      if (isMounted) setProposalPayouts(Object.fromEntries(quotes));
    });

    return () => {
      isMounted = false;
    };
  }, [account?.loginid, selectedSymbol, tradeMode, selectedDigit, ticksCount, stake]);

  const activeAccountType = account ? getAccountType(account) : null;
  const activeBalance = account ? account.balance ?? accountBalances[activeAccountType || 'real'] : null;
  const settledPositions = positions.filter((position) => position.status === 'Settled');
  const totalStake = positions.reduce((total, position) => total + position.stake, 0);
  const totalPayout = settledPositions.reduce((total, position) => total + (position.payout ?? 0), 0);
  const totalProfitLoss = settledPositions.reduce((total, position) => total + (position.profit ?? 0), 0);
  const autoStopStatus = (() => {
    const localProfit = totalProfitLoss;
    if (takeProfitEnabled && localProfit >= takeProfitTarget) return `TP reached: ${takeProfitTarget} USD`;
    if (stopLossEnabled && localProfit <= stopLossLimit) return `SL reached: ${stopLossLimit} USD`;
    if (executionMode === 'multiple') return `Cycle active: up to ${maxTradesPerCycle} trades`;
    return 'Single-trade mode';
  })();
  const contractsLost = settledPositions.filter((position) => position.result === 'lost').length;
  const contractsWon = settledPositions.filter((position) => position.result === 'won').length;
  const journalDay = new Date();
  if (journalPeriod === 'yesterday') journalDay.setDate(journalDay.getDate() - 1);
  const journalPositions = journalPeriod === 'all' ? settledPositions : settledPositions.filter((position) => {
    if (!position.createdAt) return journalPeriod === 'today';
    const date = new Date(position.createdAt);
    return date.toDateString() === journalDay.toDateString();
  });
  const journalProfit = journalPositions.reduce((total, position) => total + (position.profit ?? 0), 0);
  const journalStake = journalPositions.reduce((total, position) => total + position.stake, 0);
  const journalWon = journalPositions.filter((position) => position.result === 'won').length;
  const journalLost = journalPositions.filter((position) => position.result === 'lost').length;

  function addSimulatedTrade(mode: 'win' | 'loss' | 'profit') {
    const amountMap = {
      win: { stake: 10, payout: 32, profit: 30, label: 'Win' },
      loss: { stake: 10, payout: 0, profit: -20, label: 'Loss' },
      profit: { stake: 10, payout: 42, profit: 44, label: 'Profit' },
    } as const;

    const selected = amountMap[mode];
    const simulated: Position = {
      id: `sim-${Date.now()}`,
      symbol: selectedSymbol,
      contract: tradeMode,
      stake: selected.stake,
      duration: ticksCount,
      contractValue: selected.stake,
      payout: selected.payout,
      profit: selected.profit,
      createdAt: Date.now(),
      status: 'Settled',
      result: mode === 'loss' ? 'lost' : 'won',
      lastDigit: selectedDigit,
    };

    setPositions((current) => {
      const next = [simulated, ...current];
      sessionStorage.setItem('smart-trades-positions', JSON.stringify(next));
      return next;
    });
    setPositionsPanelTab('summary');
    setCurrentTab('positions');
  }

  return (
    <div className={`${isLightTheme ? 'theme-light' : ''} flex flex-col h-screen w-screen overflow-hidden bg-[#16161c] text-white font-sans relative`}>
      {isBooting && <div className="platform-boot" role="status" aria-live="polite"><div className="platform-boot__scan" /><div className="platform-boot__logo"><img src="/favicon.svg" alt="" /><span>Smartest Trades</span></div><div className="platform-boot__network" aria-hidden="true"><i /><i /><i /><i /><i /><b /></div><p className="platform-boot__name">Smart trades</p><p className="platform-boot__status">AI powered bots</p><div className="platform-boot__line"><span /></div><p className="platform-boot__readout">Optimizing execution logic...</p></div>}
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
          <button onClick={() => setIsLightTheme((theme) => !theme)} className="rounded-xl border border-slate-700 px-2.5 py-2 text-[10px] font-bold text-gray-200 transition hover:border-teal-400 hover:text-white sm:px-3 sm:text-xs">{isLightTheme ? '🌙' : '☀️'} <span className="hidden sm:inline">{isLightTheme ? 'Dark' : 'Light'}</span></button>
          {account && (
            <button
              type="button"
              onClick={() => setIsCashierOpen(true)}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 sm:px-3 sm:text-xs"
            >
              Cashier
            </button>
          )}
          {account ? <div className="relative"><button title={`${activeAccountType === 'real' ? 'Real' : 'Demo'} account ${account.loginid}`} onClick={() => setIsAccountMenuOpen((open) => !open)} className="max-w-[126px] truncate rounded-xl border border-emerald-500/30 px-2 py-2 text-[10px] font-bold text-emerald-300 sm:max-w-none sm:px-3 sm:text-xs">{activeAccountType === 'real' ? 'Real' : 'Demo'} | {activeBalance === null ? '--' : activeBalance.toFixed(2)} {account.currency}</button>{isAccountMenuOpen && <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-slate-700 bg-[#17171f] p-3 text-left shadow-2xl"><p className="px-2 text-[10px] uppercase tracking-wider text-gray-500">Switch account</p>{availableAccounts.map((option) => { const optionType = option.account_type === 'real' ? 'real' : 'demo'; const isActive = option.account_id === account.loginid; const optionStatus = option.status.toLowerCase(); const unavailable = ['closed', 'disabled', 'suspended', 'inactive'].includes(optionStatus); return <button key={option.account_id} disabled={isActive || unavailable} onClick={() => void switchAccount(option)} className={`mt-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs ${isActive || unavailable ? 'cursor-default bg-white/5 text-gray-500' : 'text-gray-200 hover:bg-white/10'}`}><span><span className="mr-2 font-bold">{optionType === 'real' ? 'Real' : 'Demo'}</span>{option.account_id}</span><span>{normalizeBalance(option.balance)?.toFixed(2) ?? '--'} {option.currency}</span></button>; })}<button onClick={handleLogout} className="mt-3 w-full rounded-lg border border-rose-500/40 px-2 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10">Log out</button></div>}</div> : <button onClick={async () => { try { window.location.href = await derivOAuthUrl(); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Deriv authorization failed'); setAuthStatus('failed'); } }} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20">Connect Deriv</button>}
        </div>
      </header>

      {appMode === 'admin' && (
        <div className="shrink-0 border-b border-[#22222c] bg-[#0f1722] px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Admin controls</p>
              <p className="mt-1 text-sm font-semibold text-white">Simulate trading outcomes for demos and review flows</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addSimulatedTrade('win')} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#061713] hover:bg-emerald-400">Fake win +$30</button>
              <button onClick={() => addSimulatedTrade('loss')} className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-rose-400">Fake loss -$20</button>
              <button onClick={() => addSimulatedTrade('profit')} className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#071217] hover:bg-cyan-400">Fake profit +$44</button>
              <button onClick={() => { setPositions([]); sessionStorage.removeItem('smart-trades-positions'); }} className="rounded-xl border border-slate-700 bg-[#17171f] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-gray-200 hover:border-slate-500">Reset demo</button>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden border-b border-[#2a2a36] bg-[#121217]/95 px-2 py-2">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`min-w-[92px] rounded-xl px-2 py-2 text-[9px] font-bold leading-tight transition-all cursor-pointer whitespace-nowrap ${
                currentTab === item.id ? 'bg-teal-400 text-[#071217]' : 'text-gray-400 hover:bg-[#1a1a24] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Manual Trading View */}
      {currentTab === 'manual-trading' && (
        <div className="flex flex-1 flex-col overflow-hidden pb-16 md:flex-row md:overflow-hidden md:pb-0">
          <main className="flex-none min-w-0 flex flex-col bg-[#16161c] md:flex-1 md:overflow-y-auto p-2 pb-24 sm:p-6 sm:pb-6 space-y-2 sm:space-y-4">
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

            <div className="flex-none min-h-[160px] items-center justify-start bg-[#1b1b24]/40 border border-[#262633] rounded-2xl p-2 pt-3 sm:p-8 md:flex md:flex-1 md:min-h-0 md:justify-center md:pt-8 relative shadow-inner">
              <div className="grid grid-cols-5 gap-1 sm:gap-2 md:gap-6 max-w-2xl w-full justify-items-center">
                {digitStats.map((item) => {
                  const isSelected = selectedDigit === item.digit;
                  const isCurrent = lastDigit === item.digit;
                  const isLowest = item.pct === minPct && totalTicks > 5;

                  const radius = 30;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (item.pct / 100) * circumference;
                  const ringColor = isLowest ? '#ef4444' : (isSelected ? '#2dd4bf' : '#38bdf8');

                  return (
                    <button
                      key={item.digit}
                      onClick={() => setSelectedDigit(item.digit)}
                      className={`relative w-[clamp(2.2rem,12vw,4.5rem)] h-[clamp(2.2rem,12vw,4.5rem)] rounded-full flex flex-col items-center justify-center transition-all cursor-pointer border ${
                        isSelected ? 'border-2 border-teal-300 bg-[#1d1d2b] shadow-[0_0_0_3px_rgba(45,212,191,0.42)]' : 'border border-[#2a2a36] bg-[#1b1b24] hover:border-gray-500'
                      }`}
                    >
                      {isSelected && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] z-20" />}
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r={radius} stroke="#262633" strokeWidth="3" fill="transparent" />
                        <circle
                          cx="40" cy="40" r={radius} stroke={ringColor} strokeWidth="3"
                          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round" fill="transparent" className="transition-all duration-500"
                        />
                      </svg>
                      <span className="text-base font-bold font-mono text-white z-10 sm:text-xl">{item.digit}</span>
                      <span className={`text-[8px] font-semibold mt-0.5 z-10 ${isLowest ? 'text-rose-400' : 'text-gray-400'}`}>
                        {item.pct}%
                      </span>
                      {isCurrent && (
                        <span className="absolute -bottom-1.5 w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)] z-20"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </main>

          <aside className="w-full sm:w-80 bg-[#121217] border-t sm:border-t-0 sm:border-l border-[#22222c] flex flex-col h-auto text-white p-2.5 pb-24 sm:h-full sm:p-5 sm:pb-5 justify-between shrink-0 gap-2 sm:gap-0">
            <div className="space-y-2 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-[#22222c] pb-1.5 text-[10px] font-bold uppercase text-gray-400 sm:pb-2 sm:text-xs">
                <select value={tradeMode} onChange={(event) => setTradeMode(event.target.value as TradeMode)} className="max-w-[70%] bg-transparent text-[10px] font-bold uppercase text-gray-300 outline-none sm:text-xs">
                  {TRADE_MODES.map((mode) => <option key={mode.id} value={mode.id} className="bg-[#17171f]">{mode.label}</option>)}
                </select>
                {isDigitMode && <span className="text-teal-400 font-mono">Barrier: {selectedDigit}</span>}
              </div>

              <div className="rounded-xl border border-[#262633] bg-[#1b1b24] p-2 sm:p-2.5">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-gray-400 sm:text-[10px]">
                  <span>Execution</span>
                  <span className="font-bold text-teal-300">{executionMode === 'single' ? 'Single' : 'Cycle'}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] font-bold sm:text-[10px]">
                  <button type="button" onClick={() => setExecutionMode('single')} className={`rounded-lg px-2 py-1.5 sm:py-2 ${executionMode === 'single' ? 'bg-teal-500 text-black' : 'bg-[#252533] text-gray-300'}`}>One at a time</button>
                  <button type="button" onClick={() => setExecutionMode('multiple')} className={`rounded-lg px-2 py-1.5 sm:py-2 ${executionMode === 'multiple' ? 'bg-cyan-500 text-black' : 'bg-[#252533] text-gray-300'}`}>Multi trade</button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-gray-300 sm:text-[10px]">
                  <label className="rounded-lg border border-[#30313d] bg-[#151821] p-2">
                    <span className="flex items-center justify-between">
                      <span>TP</span>
                      <input type="checkbox" checked={takeProfitEnabled} onChange={(event) => setTakeProfitEnabled(event.target.checked)} className="accent-teal-400" />
                    </span>
                    <input type="number" value={takeProfitTarget} onChange={(event) => setTakeProfitTarget(Number(event.target.value) || 0)} className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none" />
                  </label>
                  <label className="rounded-lg border border-[#30313d] bg-[#151821] p-2">
                    <span className="flex items-center justify-between">
                      <span>SL</span>
                      <input type="checkbox" checked={stopLossEnabled} onChange={(event) => setStopLossEnabled(event.target.checked)} className="accent-rose-400" />
                    </span>
                    <input type="number" value={Math.abs(stopLossLimit)} onChange={(event) => setStopLossLimit(-(Number(event.target.value) || 0))} className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none" />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#30313d] bg-[#151821] p-2 text-[9px] text-gray-400 sm:text-[10px]">
                  <span>Cycle max</span>
                  <input type="number" min="1" max="10" value={maxTradesPerCycle} onChange={(event) => setMaxTradesPerCycle(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} className="w-10 bg-transparent text-right text-sm font-bold text-white outline-none sm:w-12" />
                </div>
              </div>

              {isDigitMode ? (
                <div className="grid grid-cols-5 gap-1 bg-[#1b1b24] p-2 rounded-xl border border-[#262633]">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDigit(d)}
                      className={`py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${selectedDigit === d ? 'bg-white text-black font-extrabold ring-2 ring-teal-400 ring-offset-1 ring-offset-[#1b1b24]' : 'text-gray-400 hover:text-white hover:bg-[#252533]'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#262633] bg-[#1b1b24] p-2 text-center text-[9px] text-gray-400 sm:p-3 sm:text-[10px]">Choose a direction below to place this contract.</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl border border-[#262633] bg-[#1b1b24] p-2 text-center text-[9px] uppercase text-gray-500 sm:text-[10px]">Ticks
                  <span className="mt-1 flex items-center justify-between text-sm font-bold text-white"><button type="button" onClick={() => setTicksCount((value) => Math.max(1, value - 1))} className="rounded-lg bg-[#252533] px-2 py-1 text-gray-300">-</button><span>{ticksCount}</span><button type="button" onClick={() => setTicksCount((value) => value + 1)} className="rounded-lg bg-[#252533] px-2 py-1 text-gray-300">+</button></span>
                </label>
                <label className="rounded-xl border border-[#262633] bg-[#1b1b24] p-2 text-center text-[9px] uppercase text-gray-500 sm:text-[10px]">Stake
                  <input type="number" min="0.35" step="0.01" value={stake} onChange={(event) => setStake(Number(event.target.value))} className="mt-1 w-full bg-transparent text-center text-sm font-bold text-white outline-none" />
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-[#22222c] bg-[#17171f] px-3 py-2 text-[9px] font-bold text-gray-300 sm:text-[10px]">
              <span className="text-gray-500">Auto-stop:</span> {autoStopStatus}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:gap-3 sm:pt-4 border-t border-[#22222c]">
              {tradeButtons.map((button, index) => <button key={button.type} onClick={() => handlePurchase(button.type)} className={`py-2 px-2 rounded-xl text-center font-bold cursor-pointer ${index === 0 ? 'bg-teal-500 text-black' : 'bg-rose-600 text-white'}`}><span className="block text-[10px] sm:text-xs">{button.label}</span><span className="mt-1 block text-[9px] font-semibold opacity-80 sm:text-[10px]">Payout: {proposalPayouts[button.type] === null || proposalPayouts[button.type] === undefined ? '--' : `${proposalPayouts[button.type]?.toFixed(2)} USD`}</span></button>)}
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
              {positions.length === 0 ? <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center px-6 text-center"><div className="grid h-12 w-12 place-items-center rounded-xl border border-[#30313c] bg-[#1b1c25] text-lg">▾</div><p className="mt-4 text-sm font-bold text-gray-200">No positions yet</p><p className="mt-1 text-[10px] text-gray-500">Completed or open trades will appear here.</p></div> : <div className="space-y-2 p-4 sm:p-6">{positions.map((position) => { const profit = position.profit ?? 0; const isSettled = position.status === 'Settled'; return <div key={position.id} className="rounded-xl border border-[#262633] bg-[#1b1b24] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{position.symbol}</p><p className="text-xs text-gray-400">{position.contract} · Contract #{position.id}</p></div><p className={`text-xs font-bold ${isSettled ? (position.result === 'won' ? 'text-emerald-400' : 'text-rose-400') : 'text-amber-300'}`}>{position.status}</p></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><p className="text-[9px] uppercase text-gray-500">Ticks</p><p className="font-bold">{position.ticksElapsed ?? 0}/{position.duration}</p></div><div><p className="text-[9px] uppercase text-gray-500">P/L</p><p className={`font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{profit.toFixed(2)} USD</p></div><div><p className="text-[9px] uppercase text-gray-500">Contract value</p><p className="font-bold">{(position.contractValue ?? position.stake).toFixed(2)} USD</p></div><div><p className="text-[9px] uppercase text-gray-500">Potential payout</p><p className="font-bold">{(position.payout ?? 0).toFixed(2)} USD</p></div></div></div>; })}</div>}
              <div className="border-t border-[#252630] px-4 py-5 sm:px-6"><div className="grid grid-cols-3 gap-y-5 text-center"><div><p className="text-[9px] uppercase text-gray-500">Total stake</p><p className="text-xs font-bold">{totalStake.toFixed(2)} USD</p></div><div><p className="text-[9px] uppercase text-gray-500">Total payout</p><p className="text-xs font-bold">{totalPayout.toFixed(2)} USD</p></div><div><p className="text-[9px] uppercase text-gray-500">No. of runs</p><p className="text-xs font-bold">{positions.length}</p></div><div><p className="text-[9px] uppercase text-gray-500">Contracts lost</p><p className="text-xs font-bold">{contractsLost}</p></div><div><p className="text-[9px] uppercase text-gray-500">Contracts won</p><p className="text-xs font-bold">{contractsWon}</p></div><div><p className="text-[9px] uppercase text-gray-500">Total profit/loss</p><p className={`text-xs font-bold ${totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalProfitLoss.toFixed(2)} USD</p></div></div><button onClick={() => { setPositions([]); sessionStorage.removeItem('smart-trades-positions'); }} className="mt-5 w-full rounded-xl border border-[#363744] bg-[#1d1e27] py-2.5 text-xs font-bold text-gray-200 transition hover:border-rose-400 hover:text-white">Reset</button></div>
            </>}
            {positionsPanelTab === 'transactions' && (positions.length === 0 ? <div className="flex min-h-[340px] flex-1 items-center justify-center p-6 text-xs text-gray-500">No transactions yet.</div> : <div className="space-y-2 p-4 sm:p-6">{positions.map((position) => <div key={position.id} className="rounded-xl border border-[#262633] bg-[#1b1b24] p-4 text-xs"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-white">#{position.id}</p><p className="mt-1 text-gray-400">{position.symbol} · {position.contract}</p></div><span className={position.status === 'Settled' ? (position.result === 'won' ? 'text-emerald-400' : 'text-rose-400') : 'text-amber-300'}>{position.status}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-gray-400 sm:grid-cols-4"><span>Stake <b className="block text-white">{position.stake.toFixed(2)} USD</b></span><span>Value <b className="block text-white">{(position.contractValue ?? position.stake).toFixed(2)} USD</b></span><span>Payout <b className="block text-white">{(position.payout ?? 0).toFixed(2)} USD</b></span><span>P/L <b className={`block ${position.profit && position.profit < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{(position.profit ?? 0).toFixed(2)} USD</b></span></div></div>)}</div>)}
            {positionsPanelTab === 'journal' && <div className="p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-gray-500">Performance report</p><p className={`mt-1 text-2xl font-extrabold ${journalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{journalProfit >= 0 ? '+' : ''}{journalProfit.toFixed(2)} USD</p><p className="text-xs text-gray-500">{journalWon} won · {journalLost} lost · {journalStake.toFixed(2)} USD staked</p></div><select value={journalPeriod} onChange={(event) => setJournalPeriod(event.target.value as typeof journalPeriod)} className="rounded-lg border border-[#30313d] bg-[#17171f] px-3 py-2 text-xs font-bold text-white"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="all">All time</option></select></div>
              <div className="mt-5 overflow-hidden rounded-xl border border-[#262633] bg-[#1b1b24] p-4">
                <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-gray-500">
                  <span>Profit/loss</span>
                  <span>{journalPositions.length} trades</span>
                </div>
                <svg viewBox="0 0 320 120" className="h-28 w-full overflow-visible">
                  <defs>
                    <linearGradient id="profitLineFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(16,185,129,0.5)" />
                      <stop offset="100%" stopColor="rgba(16,185,129,0.02)" />
                    </linearGradient>
                  </defs>
                  {[0, 25, 50, 75, 100].map((line) => (
                    <line key={line} x1="0" x2="320" y1={120 - (line / 100) * 90} y2={120 - (line / 100) * 90} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />
                  ))}
                  {journalPositions.length > 0 ? (() => {
                    const values = journalPositions.map((position) => position.profit ?? 0);
                    const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
                    const points = values.map((value, index) => {
                      const x = (index / Math.max(values.length - 1, 1)) * 300 + 10;
                      const y = 100 - (value / maxAbs) * 70 + 10;
                      return `${x},${y}`;
                    }).join(' ');
                    const areaPoints = `${points} 310,110 10,110`;
                    return <>
                      <polygon points={areaPoints} fill="url(#profitLineFill)" opacity={0.9} />
                      <polyline points={points} fill="none" stroke={journalProfit >= 0 ? '#34d399' : '#f87171'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {values.map((value, index) => {
                        const x = (index / Math.max(values.length - 1, 1)) * 300 + 10;
                        const y = 100 - (value / maxAbs) * 70 + 10;
                        return <circle key={`${value}-${index}`} cx={x} cy={y} r="4" fill={value >= 0 ? '#34d399' : '#f87171'} stroke="#0f172a" strokeWidth="2" />;
                      })}
                    </>;
                  })() : <>
                    <line x1="10" x2="310" y1="90" y2="90" stroke="rgba(148,163,184,0.3)" strokeWidth="2" strokeLinecap="round" />
                  </>}
                </svg>
              </div>
              <div className="mt-4 space-y-2">{journalPositions.length === 0 ? <p className="py-5 text-center text-xs text-gray-500">No settled trades for this period.</p> : journalPositions.map((position) => <div key={position.id} className="flex items-center justify-between rounded-xl border border-[#262633] bg-[#1b1b24] p-3 text-xs"><span className="text-gray-400">{position.symbol} · #{position.id}</span><span className={position.profit && position.profit < 0 ? 'text-rose-400' : 'text-emerald-400'}>{(position.profit ?? 0).toFixed(2)} USD</span></div>)}</div></div>}
          </div>
          </section>
        </main>
      )}

      {currentTab === 'signal' && (
        <main className="relative flex-1 overflow-y-auto bg-[#16161c] p-4 text-white sm:p-8">
          {isSearchingSignals && <div className="signal-cinema" role="status" aria-live="polite"><div className="signal-cinema__scanline" /><div className="signal-cinema__radar" aria-hidden="true"><span /><i /><b /></div><p className="signal-cinema__eyebrow">SIGNAL ENGINE // LIVE SCAN</p><h2>Reading market behavior</h2><p className="signal-cinema__message">Sampling recent ticks, digit frequency, and contract patterns for {signalMarket}.</p><div className="signal-cinema__steps"><span className="signal-cinema__step signal-cinema__step--active">01 HISTORY</span><span className="signal-cinema__step">02 FREQUENCY</span><span className="signal-cinema__step">03 CONTEXT</span></div><div className="signal-cinema__bar"><span /></div></div>}
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-400">Digit signal</p><h1 className="mt-1 text-2xl font-extrabold">Hourly signal</h1><p className="mt-2 text-sm text-gray-400">Choose a market to scan the next hour.</p></div><div className="flex items-center gap-2"><button onClick={handleAiScan} className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.2)] transition hover:bg-cyan-300">AI Scanner</button><select value={signalMarket} onChange={(event) => { setSignalMarket(event.target.value); playSignalBeep(); }} className="rounded-xl border border-[#30303d] bg-[#1b1b24] px-3 py-2 text-sm font-bold text-white outline-none">{liveMarkets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}</select></div></div>
            {aiScannerOpen && <section className="rounded-2xl border border-cyan-400/40 bg-[#071a1f] p-4 shadow-[0_0_14px_rgba(45,212,191,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">AI market scan</p>
                  <p className="mt-1 text-sm font-bold text-white">{signalScan.marketLabel}</p>
                </div>
                <div className="w-40 overflow-hidden rounded-full bg-slate-900">
                  <div className="h-2 rounded-full bg-cyan-400 transition-all duration-300" style={{ width: `${scannerProgress}%` }} />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#24313c] bg-[#112530] p-3"><p className="text-[10px] uppercase text-slate-400">AI Confidence</p><p className="mt-1 text-lg font-black text-cyan-300">{signalScan.aiScore.toFixed(2)}%</p></div>
                <div className="rounded-xl border border-[#24313c] bg-[#112530] p-3"><p className="text-[10px] uppercase text-slate-400">Win Rate</p><p className="mt-1 text-lg font-black text-emerald-300">{signalScan.winRate.toFixed(2)}%</p></div>
                <div className="rounded-xl border border-[#24313c] bg-[#112530] p-3"><p className="text-[10px] uppercase text-slate-400">Samples</p><p className="mt-1 text-lg font-black text-white">{signalScan.samples}</p></div>
                <div className="rounded-xl border border-[#24313c] bg-[#112530] p-3"><p className="text-[10px] uppercase text-slate-400">Recommended Bot</p><p className="mt-1 text-sm font-black text-amber-300">{recommendedBot.name}</p></div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">status: {scannerProgress >= 100 ? 'complete' : 'scanning'}</span>
                <button onClick={() => { setSelectedBotTemplate(recommendedTemplate); setCurrentTab('bot-builder'); setAiScannerOpen(false); loadBotTemplate(recommendedTemplate); }} className="rounded-xl bg-teal-400 px-4 py-2 text-[11px] font-black uppercase text-[#071217] hover:bg-teal-300">Load Bot</button>
              </div>
            </section>}
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
        <main className="flex-1 overflow-y-auto bg-[#16161c] p-6 text-white sm:p-10">
          <div className="mx-auto max-w-5xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Smart Trades</p><h1 className="mt-2 text-3xl font-black">Trading dashboard</h1><p className="mt-3 max-w-2xl text-sm text-gray-400">Monitor your Deriv connection, open positions, and automated bot workspace from one place.</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><button onClick={() => setCurrentTab('manual-trading')} className="rounded-2xl border border-[#30303d] bg-[#1b1b24] p-5 text-left hover:border-cyan-400"><span className="text-2xl">▣</span><strong className="mt-4 block text-sm">Manual trading</strong><span className="mt-1 block text-xs text-gray-500">Open the live trading workspace</span></button><button onClick={() => setCurrentTab('bots')} className="rounded-2xl border border-[#30303d] bg-[#1b1b24] p-5 text-left hover:border-cyan-400"><span className="text-2xl">🤖</span><strong className="mt-4 block text-sm">Bots</strong><span className="mt-1 block text-xs text-gray-500">Browse pre-built XML strategies</span></button><button onClick={() => setCurrentTab('positions')} className="rounded-2xl border border-[#30303d] bg-[#1b1b24] p-5 text-left hover:border-cyan-400"><span className="text-2xl">◫</span><strong className="mt-4 block text-sm">Positions</strong><span className="mt-1 block text-xs text-gray-500">Review active and settled trades</span></button></div></div>
        </main>
      )}

      {/* Bots View */}
      {currentTab === 'bots' && (
        <main className="flex-1 overflow-y-auto bg-[#edf1f3] p-6 text-white sm:p-8">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-6 rounded-b-3xl bg-gradient-to-r from-[#111827] via-[#172338] to-[#0b3438] p-7 shadow-xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Bots</p><h1 className="mt-2 text-3xl font-black">Pre-built strategies</h1><div className="mt-6 flex gap-3"><div className="rounded-xl bg-black/20 px-4 py-3"><strong className="block text-xl text-cyan-300">{BOT_TEMPLATES.length}</strong><span className="text-[10px] text-slate-300">AI Bots</span></div><div className="rounded-xl bg-black/20 px-4 py-3"><strong className="block text-xl text-cyan-300">24/7</strong><span className="text-[10px] text-slate-300">Automation</span></div><div className="rounded-xl bg-black/20 px-4 py-3"><strong className="block text-xl text-cyan-300">LIVE</strong><span className="text-[10px] text-slate-300">Execution</span></div></div></div>
            <div className="mb-6 flex flex-wrap gap-3"><label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm"><span>Upload XML</span><input type="file" accept=".xml,.json" onChange={handleFileUpload} className="hidden" /></label><button onClick={handleGoogleSignIn} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm">Import from Drive</button><button onClick={() => setCurrentTab('bot-builder')} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm">Open Bot Builder</button></div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{BOT_TEMPLATES.map((template) => <article key={template.id} className={`rounded-2xl bg-gradient-to-br ${template.accent} p-4 shadow-lg`}><div className="flex items-start justify-between"><div className="grid h-14 w-14 place-items-center rounded-xl bg-[#071b2c] text-2xl shadow-inner">🤖</div><span className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black text-emerald-950">FREE</span></div><h2 className="mt-4 text-base font-black">{template.name}</h2><p className="mt-1 text-xs text-white/80">{template.description}</p><p className="mt-4 text-[10px] text-white/80">Deriv Blockly XML · Auto Trade</p><button onClick={() => loadBotTemplate(template)} className="mt-3 w-full rounded-xl bg-blue-500 px-4 py-3 text-xs font-black text-white shadow-lg hover:bg-blue-400">Load Bot</button></article>)}</div>
            {dashboardBots.length > 0 && <section className="mt-8 rounded-2xl bg-[#111827] p-5"><h2 className="text-sm font-black">Imported bots</h2><div className="mt-3 space-y-2">{dashboardBots.map((bot) => <div key={bot.id} className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-xs"><span>{bot.name}</span><span className="flex gap-3"><button onClick={() => handleDuplicateBot(bot)} className="text-cyan-300">Duplicate</button><button onClick={() => handleDeleteBot(bot.id)} className="text-rose-300">Delete</button></span></div>)}</div></section>}
          </div>
        </main>
      )}

      {currentTab === 'bot-builder' && (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0b1020]">
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#111827] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff444f] text-sm font-black text-white">D</span>
              <div>
                <p className="text-sm font-extrabold">{selectedBotTemplate?.name ?? activeStrategyConfig?.strategyName ?? 'Deriv Bot Builder'}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">official embedded build · {botBuilderLastEvent}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeStrategyConfig && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                  {activeStrategyConfig.strategyName} · {activeStrategyConfig.initialStake} USD
                </div>
              )}
              <button
                onClick={() => void runLoadedBot()}
                disabled={isBotBuilderRunning || !selectedBotTemplate && !activeStrategyConfig}
                className="rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBotBuilderRunning ? 'Running...' : 'Run Bot'}
              </button>
              <button
                onClick={() => setCurrentTab('dashboard')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Back to dashboard
              </button>
            </div>
          </div>
          {botBuilderLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05131a]/80 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-[28px] border border-cyan-300/40 bg-[#071a1f]/95 p-6 shadow-[0_0_36px_rgba(45,212,191,0.35)] text-cyan-100">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-900 shadow-lg">ST</div>
                <p className="mt-5 text-center text-2xl font-black tracking-[0.08em] text-white">Smart trades</p>
                <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-cyan-300">AI powered bots</p>
                <div className="mt-6 flex justify-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)] [animation-delay:200ms]" />
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)] [animation-delay:400ms]" />
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300 transition-all duration-300" style={{ width: `${botBuilderProgress}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-300">
                  <span>Preparing workspace</span>
                  <span>{botBuilderProgress}%</span>
                </div>
              </div>
            </div>
          )}
          <iframe
            title="Deriv Bot Builder"
            src={`/bot-builder/index.html?template=${encodeURIComponent(selectedBotTemplate?.file ?? 'deriv-default.xml')}`}
            className="h-full w-full border-0 bg-white"
            allow="clipboard-write"
            onLoad={() => {
              setBotBuilderLoading(false);
              setBotBuilderProgress(100);
              setBotBuilderLastEvent(selectedBotTemplate?.name ?? activeStrategyConfig?.strategyName ?? 'Builder ready');
            }}
          />
        </div>
      )}

      {currentTab === 'copy-trading' && (
        <main className="flex-1 overflow-y-auto bg-[#16161c] p-4 text-white sm:p-8">
          <div className="mx-auto max-w-5xl space-y-5">
            <div className="flex items-end justify-between gap-3 border-b border-[#262633] pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">Copy trading</p>
                <h1 className="mt-1 text-2xl font-extrabold">Follow proven trading profiles</h1>
              </div>
              <button onClick={() => setCurrentTab('dashboard')} className="rounded-xl border border-[#30303d] bg-[#1b1b24] px-3 py-2 text-[10px] font-bold uppercase text-gray-200">Back to dashboard</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                { name: 'Smartest Trades Alpha', winRate: '91.4%', profit: '+18.4%', risk: 'Medium', description: 'Volatility 100 / fast recovery strategy' },
                { name: 'Recovery Pulse', winRate: '87.9%', profit: '+12.7%', risk: 'Low', description: 'Balanced daily execution with low drawdown' },
                { name: 'Momentum Burst', winRate: '84.6%', profit: '+14.1%', risk: 'High', description: 'High-conviction jump and burst trades' },
              ].map((profile) => (
                <div key={profile.name} className="rounded-2xl border border-[#262633] bg-[#1b1b24] p-5 shadow-lg shadow-black/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-extrabold text-white">{profile.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-cyan-300">{profile.risk} risk</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-300">{profile.profit}</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-400">{profile.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-300">
                    <div className="rounded-xl border border-[#30303d] bg-[#17171f] p-2"><span className="block text-[9px] uppercase text-gray-500">Win rate</span><strong className="mt-1 block text-sm text-white">{profile.winRate}</strong></div>
                    <div className="rounded-xl border border-[#30303d] bg-[#17171f] p-2"><span className="block text-[9px] uppercase text-gray-500">Theme</span><strong className="mt-1 block text-sm text-white">AI scan</strong></div>
                  </div>
                  <button onClick={() => { setCurrentTab('manual-trading'); setSelectedSymbol('1HZ100V'); }} className="mt-4 w-full rounded-xl bg-teal-500 px-3 py-2 text-xs font-black uppercase text-[#071217] hover:bg-teal-400">Copy this setup</button>
                </div>
              ))}
            </div>
          </div>
        </main>
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
      <button
        type="button"
        className="floating-ai-scan fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300 bg-[#071a1f] text-cyan-100 shadow-[0_0_30px_rgba(45,212,191,0.45)] transition hover:scale-105 hover:bg-cyan-400 hover:text-slate-950"
        onClick={launchFloatingAiScan}
        aria-label="Launch AI scanner"
      >
        <span className="floating-ai-scan__halo" />
        <span className="floating-ai-scan__icon">✦</span>
      </button>

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
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[#121217] p-1">{(['deposit', 'withdraw'] as const).map((tab) => <button key={tab} onClick={() => setCashierTab(tab)} className={`rounded-lg px-2 py-2 text-xs font-bold capitalize ${cashierTab === tab ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-500 hover:text-gray-200'}`}>{tab}</button>)}</div>
            <div className="mt-4 rounded-xl border border-[#30303d] bg-[#121217] p-4">
              <div className="flex items-center justify-between gap-3 border-b border-[#30303d] pb-3">
                <div>
                  <p className="text-sm font-bold text-gray-200">{cashierTab === 'deposit' ? 'Deriv cashier: Deposit' : 'Deriv cashier: Withdraw'}</p>
                  <p className="mt-1 text-[10px] text-gray-500">Dusupay funding for USD account</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300">Deriv</span>
              </div>
              <ol className="mt-4 space-y-3 text-xs text-gray-300">
                <li><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">1</span>Open the Deriv cashier page from the button below.</li>
                <li><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">2</span>For deposit, scroll down and select <span className="font-bold text-white">Mobile Money / Dusupay</span>.</li>
                <li><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">3</span>Choose the amount, confirm the payment, and your USD balance updates on Deriv.</li>
                <li><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">4</span>For withdrawal, use the secure Deriv withdraw flow and select the relevant withdrawal method.</li>
              </ol>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <a href={cashierTab === 'deposit' ? DERIV_DEPOSIT_URL : DERIV_WITHDRAW_URL} target="_blank" rel="noreferrer" className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-bold text-[#071217] transition hover:bg-emerald-400">
                  {cashierTab === 'deposit' ? 'Open Deriv deposit page' : 'Open Deriv withdraw page'}
                </a>
                <button onClick={() => setCashierTab(cashierTab === 'deposit' ? 'withdraw' : 'deposit')} className="w-full rounded-xl border border-[#30303d] bg-[#17171f] px-4 py-3 text-sm font-bold text-gray-200 transition hover:border-emerald-500 hover:text-white">
                  Switch to {cashierTab === 'deposit' ? 'withdraw' : 'deposit'}
                </button>
              </div>
              <p className="mt-4 text-center text-[10px] text-gray-600">Powered by Deriv Cashier • Dusupay</p>
            </div>
          </section>
        </div>
      )}

      <footer className="fixed inset-x-0 bottom-[3.75rem] z-20 border-t border-[#22222c] bg-[#0f1016]/95 px-2 py-1.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-gray-400 backdrop-blur-sm md:static md:bottom-auto md:z-auto md:border-t md:bg-[#0f1016] md:px-4 md:py-3 md:text-[10px]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-1 sm:gap-3 md:gap-3">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] sm:h-2 sm:w-2 md:h-2.5 md:w-2.5" />
            <span className="truncate">{currentDateTime.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <span aria-hidden="true">•</span>
            <span className="truncate">{currentDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <button
            type="button"
            onClick={toggleBrianAdmin}
            className="shrink-0 cursor-pointer truncate text-teal-300 transition hover:text-teal-200"
            aria-label={appMode === 'admin' ? 'Return to client mode' : 'Open admin mode'}
          >
            {appMode === 'admin' ? 'Back to client' : 'Developed by Brian'}
          </button>
        </div>
      </footer>
    </div>
  );
}


