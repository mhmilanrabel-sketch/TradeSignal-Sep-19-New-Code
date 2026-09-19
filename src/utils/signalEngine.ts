import { CandleData } from '../types';
import botConfig from '../config/botConfig.json';

// ----------------------------------------------------------------------------
// Indicators (Wilder smoothing — matches TradingView)
// ----------------------------------------------------------------------------

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  values.forEach((v, i) => {
    if (i === 0) { out.push(v); return; }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { out.push(50); continue; }
    const diff = closes[i] - closes[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    if (i <= period) {
      avgGain = (avgGain * (i - 1) + gain) / i;
      avgLoss = (avgLoss * (i - 1) + loss) / i;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

export function atr(candles: CandleData[], period = 14): number[] {
  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  const out: number[] = [];
  let prev = trs[0];
  trs.forEach((tr, i) => {
    prev = i === 0 ? tr : (prev * (period - 1) + tr) / period;
    out.push(prev);
  });
  return out;
}

// ----------------------------------------------------------------------------
// Confluence scoring — deterministic, no randomness
// ----------------------------------------------------------------------------

export interface ConfluenceScore {
  total: number;
  direction: 'LONG' | 'SHORT' | 'NONE';
  reasons: string[];
  indicators: {
    emaFast: number;
    emaSlow: number;
    emaTrend: number;
    rsi: number;
    atr: number;
    volumeRatio: number;
  };
}

export function scoreConfluence(candles: CandleData[]): ConfluenceScore {
  if (candles.length < 30) {
    return {
      total: 0,
      direction: 'NONE',
      reasons: ['Not enough candles'],
      indicators: { emaFast: 0, emaSlow: 0, emaTrend: 0, rsi: 50, atr: 0, volumeRatio: 1 },
    };
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const e20Arr = ema(closes, 20);
  const e50Arr = ema(closes, 50);
  const e200Arr = ema(closes, Math.min(200, closes.length));
  const rArr = rsi(closes, 14);
  const aArr = atr(candles, 14);

  const e20 = e20Arr[e20Arr.length - 1] ?? 0;
  const e50 = e50Arr[e50Arr.length - 1] ?? 0;
  const e200 = e200Arr[e200Arr.length - 1] ?? 0;
  const r = rArr[rArr.length - 1] ?? 50;
  const a = aArr[aArr.length - 1] ?? 0;

  const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const baseVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const volRatio = baseVol > 0 ? recentVol / baseVol : 1;

  const price = closes[closes.length - 1] ?? 0;
  const reasons: string[] = [];
  let longScore = 0;
  let shortScore = 0;

  // 1) EMA stack alignment (max 25)
  if (e20 > e50 && e50 > e200) { longScore += 25; reasons.push('EMA stack bullish'); }
  if (e20 < e50 && e50 < e200) { shortScore += 25; reasons.push('EMA stack bearish'); }

  // 2) Price vs EMA50 (max 15)
  if (price > e50) { longScore += 15; reasons.push('Price > EMA50'); }
  else { shortScore += 15; reasons.push('Price < EMA50'); }

  // 3) RSI momentum regime (max 20)
  if (r >= 55 && r <= 70) { longScore += 20; reasons.push(`RSI ${r.toFixed(1)} bullish`); }
  if (r <= 45 && r >= 30) { shortScore += 20; reasons.push(`RSI ${r.toFixed(1)} bearish`); }
  if (r > 75) { shortScore += 10; reasons.push('RSI overbought'); }
  if (r < 25) { longScore += 10; reasons.push('RSI oversold'); }

  // 4) Volume surge confirmation (max 20)
  if (volRatio > 1.3) {
    if (longScore > shortScore) { longScore += 20; reasons.push(`Vol x${volRatio.toFixed(2)} bull`); }
    if (shortScore > longScore) { shortScore += 20; reasons.push(`Vol x${volRatio.toFixed(2)} bear`); }
  } else if (volRatio > 1.1) {
    if (longScore > shortScore) longScore += 10;
    if (shortScore > longScore) shortScore += 10;
  }

  // 5) ATR volatility check (max 20)
  const atrPct = a / price;
  const healthy = atrPct > 0.0015 && atrPct < 0.02;
  if (healthy) {
    if (longScore > shortScore) longScore += 20;
    if (shortScore > longScore) shortScore += 20;
    reasons.push(`ATR ${(atrPct * 100).toFixed(2)}% ok`);
  } else if (atrPct > 0.02) {
    reasons.push('ATR too volatile');
    longScore = shortScore = 0;
  } else {
    reasons.push('ATR too quiet — chop');
  }

  const winner = longScore > shortScore ? 'LONG' : shortScore > longScore ? 'SHORT' : 'NONE';
  const total = Math.max(longScore, shortScore);

  return {
    total,
    direction: total >= 60 ? (winner as 'LONG' | 'SHORT') : 'NONE',
    reasons,
    indicators: { emaFast: e20, emaSlow: e50, emaTrend: e200, rsi: r, atr: a, volumeRatio: volRatio },
  };
}

// ----------------------------------------------------------------------------
// Kill-zone check
// ----------------------------------------------------------------------------

export function isInKillZone(): { ok: boolean; name: string; weight: number } {
  const now = new Date();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const zones = botConfig.kill_zones_utc as Record<string, { start: string; end: string; weight: number }>;
  for (const [name, z] of Object.entries(zones)) {
    const [sh, sm] = z.start.split(':').map(Number);
    const [eh, em] = z.end.split(':').map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    const inZone = s <= e ? mins >= s && mins < e : mins >= s || mins < e;
    if (inZone) return { ok: true, name, weight: z.weight };
  }
  return { ok: false, name: 'off-zone', weight: 0.5 };
}

// ----------------------------------------------------------------------------
// ATR-scaled TP / SL
// ----------------------------------------------------------------------------

export function buildRiskLevels(
  direction: 'LONG' | 'SHORT',
  entry: number,
  atrValue: number,
  cfg = botConfig.risk_engine,
) {
  const slDist = atrValue * 1.2;
  const tp1Dist = slDist * cfg.min_reward_risk_ratio;
  const tp2Dist = tp1Dist * 1.6;
  const isLong = direction === 'LONG';
  return {
    stopLoss: isLong ? entry - slDist : entry + slDist,
    takeProfit1: isLong ? entry + tp1Dist : entry - tp1Dist,
    takeProfit2: isLong ? entry + tp2Dist : entry - tp2Dist,
    slDist,
    tp1Dist,
    tp2Dist,
  };
}

// ----------------------------------------------------------------------------
// Position sizing
// ----------------------------------------------------------------------------

const STEP_MAP: Record<string, number> = {
  'BTC/USDT': 0.001,
  'ETH/USDT': 0.001,
  'SOL/USDT': 0.01,
  'BNB/USDT': 0.01,
  'XRP/USDT': 1,
  'ADA/USDT': 1,
  'DOGE/USDT': 1,
  'AVAX/USDT': 0.01,
  'LINK/USDT': 0.01,
  'DOT/USDT': 0.01,
};

export function positionSize(
  symbol: string,
  entry: number,
  slDist: number,
  accountBalance: number,
  riskPct = botConfig.risk_engine.max_account_risk_percent,
): number {
  if (slDist <= 0 || accountBalance <= 0) return 0;
  const riskUsd = accountBalance * (riskPct / 100);
  const rawQty = riskUsd / slDist;
  const step = STEP_MAP[symbol] ?? 0.01;
  const qty = Math.floor(rawQty / step) * step;
  return Math.max(Number(qty.toFixed(8)), step);
}