export type AssetClass = 'all' | 'crypto' | 'forex' | 'commodities' | 'stocks' | 'Crypto' | string;

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type SignalDirection = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL' | 'BUY (LONG)' | 'SELL (SHORT)';

export type SignalStatus = 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | 'PENDING' | 'CLOSED';

export interface ConfluenceIndicator {
  name: string;
  value: string;
  status: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

export interface TradeSignal {
  id: string;
  symbol: string;
  name: string;
  assetClass: 'crypto' | 'forex' | 'commodities' | 'stocks' | 'Crypto' | string;
  direction: SignalDirection;
  status: SignalStatus;
  timeframe: Timeframe;
  createdAt?: number; // timestamp
  timestamp?: string;
  expiresAt?: number;
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  targetPrice?: number;
  riskRewardRatio: number;
  confidenceScore: number; // 0 - 100
  pnlPercentage: number;
  confluences?: ConfluenceIndicator[];
  reasoning: string;
  chartPattern?: string;
  volume24h?: string;
  startTime?: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
}

export interface MarketAsset {
  symbol: string;
  name: string;
  assetClass: 'crypto' | 'forex' | 'commodities' | 'stocks' | 'Crypto' | string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  digits?: number; // decimal precision
  sparkline?: number[];
}

export interface RiskCalculationResult {
  accountSize: number;
  riskPercentage: number;
  dollarRisk: number;
  entryPrice: number;
  stopLoss: number;
  slPercentage: number;
  positionSizeUnits: number;
  positionSizeUsd: number;
  target1ProfitUsd: number;
  target1ProfitPercent: number;
  target2ProfitUsd: number;
  target2ProfitPercent: number;
  target3ProfitUsd: number;
  target3ProfitPercent: number;
  riskReward1: number;
  riskReward2: number;
  riskReward3: number;
  recommendedLeverage: number;
}

export interface PerformanceStats {
  winRate: number;
  totalSignals: number;
  winningSignals: number;
  losingSignals: number;
  profitFactor: number;
  averageRiskReward: string;
  netProfitPercentage: number;
  bestTradePercentage: number;
  maxDrawdownPercentage: number;
  averageDuration: string;
}

export interface ClosedSignal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  timeframe: Timeframe;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  pnlPercentage: number;
  pnlPipsOrPoints: number;
  outcome: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL' | string;
  closedAt: string;
  holdingTime: string;
  timeStart?: string;
  duration?: string;
  timestamp?: number;
}
