export type MarketType = 'volatility100' | 'boom500' | 'jump75' | 'volatility50'

export type BotMode = 'safe' | 'recovery' | 'burst' | 'auto'

export type BotProfile = {
  id: string
  name: string
  market: MarketType
  mode: BotMode
  tradeType: string
  aiScore: number
  winRate: number
  recent: number
  samples: number
  risk: 'low' | 'medium' | 'high'
  enabled: boolean
  status: 'ready' | 'paused' | 'configuring'
}

export const botRegistry: BotProfile[] = [
  {
    id: 'safe-recovery-under8',
    name: 'Safe Recovery Bot',
    market: 'volatility100',
    mode: 'recovery',
    tradeType: 'Under 8 Recovery Under 5',
    aiScore: 98.63,
    winRate: 91.4,
    recent: 92.5,
    samples: 1499,
    risk: 'low',
    enabled: true,
    status: 'ready',
  },
  {
    id: 'digital-over-under-bot',
    name: 'Digital Over/Under Bot',
    market: 'volatility100',
    mode: 'auto',
    tradeType: 'Over 1 / Under 8',
    aiScore: 96.18,
    winRate: 88.9,
    recent: 89.4,
    samples: 1320,
    risk: 'medium',
    enabled: true,
    status: 'ready',
  },
  {
    id: 'jump-burst-bot',
    name: 'Jump Burst Bot',
    market: 'jump75',
    mode: 'burst',
    tradeType: 'High momentum',
    aiScore: 94.21,
    winRate: 80.2,
    recent: 84.3,
    samples: 1100,
    risk: 'high',
    enabled: true,
    status: 'ready',
  },
  {
    id: 'cooldown-bot',
    name: 'Cooldown Reset Bot',
    market: 'volatility50',
    mode: 'safe',
    tradeType: 'Low volatility cycle',
    aiScore: 90.7,
    winRate: 82.1,
    recent: 83.2,
    samples: 980,
    risk: 'low',
    enabled: false,
    status: 'paused',
  },
]

export type ScanResult = {
  market: MarketType
  marketLabel: string
  aiScore: number
  winRate: number
  recent: number
  samples: number
  recommendedBotId: string
}

export function scanMarket(market: MarketType = 'volatility100'): ScanResult {
  const weights: Record<MarketType, ScanResult> = {
    volatility100: {
      market: 'volatility100',
      marketLabel: 'Volatility 100 (1s) Index',
      aiScore: 98.63,
      winRate: 91.4,
      recent: 92.5,
      samples: 1499,
      recommendedBotId: 'safe-recovery-under8',
    },
    boom500: {
      market: 'boom500',
      marketLabel: 'Boom 500 Index',
      aiScore: 95.1,
      winRate: 86.7,
      recent: 87.9,
      samples: 980,
      recommendedBotId: 'jump-burst-bot',
    },
    jump75: {
      market: 'jump75',
      marketLabel: 'Jump 75 Index',
      aiScore: 93.4,
      winRate: 84.2,
      recent: 86.1,
      samples: 870,
      recommendedBotId: 'jump-burst-bot',
    },
    volatility50: {
      market: 'volatility50',
      marketLabel: 'Volatility 50 Index',
      aiScore: 91.2,
      winRate: 78.9,
      recent: 80.0,
      samples: 702,
      recommendedBotId: 'cooldown-bot',
    },
  }

  return weights[market]
}

export function recommendBot(market: MarketType = 'volatility100') {
  const scan = scanMarket(market)
  return botRegistry.find((bot) => bot.id === scan.recommendedBotId) ?? botRegistry[0]
}
