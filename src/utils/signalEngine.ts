// src/utils/signalEngine.ts
// ═══════════════════════════════════════════════════════════════════════════
// FIXED VERSION — addresses:
//   BUG #1: scores capped below MIN_CONFLUENCE_SCORE=70
//           → rebalanced weights so realistic max = 100, min passing = 70
//   BUG #2: MIN_ATR_PCT_BY_SYMBOL was defined in TWO places with different
//           units (decimal 0.0018 vs percent 0.18). Single source of truth
//           is now here, ALWAYS as decimals. App.tsx imports it.
//   BUG #5: every rejection path now returns a structured `reasons[]` array
//           so the caller can log WHY each symbol was skipped.
// ═══════════════════════════════════════════════════════════════════════════

import { CandleData } from '../types';
import botConfig from '../config/botConfig.json';

// ─────────────────────────────────────────────────────────────────────────
// Indicators (Wilder smoothing — matches TradingView)
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// Per-symbol ATR thresholds — SINGLE SOURCE OF TRUTH
//
// ⚠️  All values are DECIMALS (0.0018 = 0.18%).
//     App.tsx MUST import this map instead of redefining it.
// ─────────────────────────────────────────────────────────────────────────

export const MIN_ATR_PCT_BY_SYMBOL: Record<string, number> = {
  'BTC/USDT':  0.0018,
  'ETH/USDT':  0.0020,
  'SOL/USDT':  0.0028,
  'BNB/USDT':  0.0022,
  'XRP/USDT':  0.0035,
  'ADA/USDT':  0.0030,
  'DOGE/USDT': 0.0040,
  'AVAX/USDT': 0.0035,
  'LINK/USDT': 0.0030,
  'DOT/USDT':  0.0030,
};

export const DEFAULT_MIN_ATR_PCT = 0.0030;
export const MAX_ATR_PCT = 0.02;

// ─────────────────────────────────────────────────────────────────────────
// Confluence scoring — REBALANCED so max reachable = 100
//
//   Weight breakdown (max points per side):
//     EMA stack aligned ................ 25
//     Price vs EMA50 ................... 15
//     RSI in sweet spot ................ 20
//     Volume confirmation .............. 15
//     ATR healthy (0.3%–1.2%) .......... 15
//     MACD histogram agrees ............ 10
//     ────────────────────────────────────
//     TOTAL ............................ 100
//
//   Passing threshold is 70. Previously the 5-weight system capped at 100
//   only if volume surged AND ATR was perfect AND RSI was perfect — which
//   almost never happened simultaneously, so nothing ever scored ≥ 70.
// ─────────────────────────────────────────────────────────────────────────

export interface ConfluenceScore {
  total: number;
  direction: 'LONG' | 'SHORT' | 'NONE';
  reasons: string[];
  /** Structured reasons for rejection — used by caller for logging */
  rejections: string[];
  indicators: {
    emaFast: number;
    emaSlow: number;
    emaTrend: number;
    rsi: number;
    atr: number;
    atrPct: number;
    volumeRatio: number;
    macdHistogram: number;
  };
}

export function scoreConfluence(
  candles: CandleData[],
  symbol?: string,
): ConfluenceScore {
  const emptyResult = (reasons: string[], rejections: string[] = []): ConfluenceScore => ({
    total: 0,
    direction: 'NONE',
    reasons,
    rejections,
    indicators: { emaFast: 0, emaSlow: 0, emaTrend: 0, rsi: 50, atr: 0, atrPct: 0, volumeRatio: 1, macdHistogram: 0 },
  });

  if (candles.length < 30) {
    return emptyResult(['Not enough candles'], ['insufficient-candles']);
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
  const atrPct = price > 0 ? a / price : 0;

  // MACD histogram (12-26-9)
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - (ema26[i] ?? 0));
  const signalLine = ema(macdLine, 9);
  const macdHistogram = (macdLine[macdLine.length - 1] ?? 0) - (signalLine[signalLine.length - 1] ?? 0);

  const reasons: string[] = [];
  const rejections: string[] = [];

  const minAtrPct =
    symbol && MIN_ATR_PCT_BY_SYMBOL[symbol] !== undefined
      ? MIN_ATR_PCT_BY_SYMBOL[symbol]
      : DEFAULT_MIN_ATR_PCT;

  // ─── HARD REJECT: ATR regime ───
  if (atrPct > 0) {
    if (atrPct < minAtrPct) {
      const msg = `ATR too quiet (${(atrPct * 100).toFixed(3)}% < ${(minAtrPct * 100).toFixed(2)}%${symbol ? ` [${symbol}]` : ''})`;
      return emptyResult([msg], ['atr-too-quiet']);
    }
    if (atrPct > MAX_ATR_PCT) {
      const msg = `ATR too volatile (${(atrPct * 100).toFixed(2)}% > ${(MAX_ATR_PCT * 100).toFixed(2)}%)`;
      return emptyResult([msg], ['atr-too-volatile']);
    }
  }

  let longScore = 0;
  let shortScore = 0;

  // ─── 1) EMA stack alignment (max 25) ───
  if (e20 > e50 && e50 > e200) {
    longScore += 25;
    reasons.push('EMA stack bullish');
  } else if (e20 < e50 && e50 < e200) {
    shortScore += 25;
    reasons.push('EMA stack bearish');
  } else {
    rejections.push('ema-stack-mixed');
  }

  // ─── 2) Price vs EMA50 (max 15) ───
  if (price > e50) {
    longScore += 15;
    reasons.push('Price > EMA50');
  } else {
    shortScore += 15;
    reasons.push('Price < EMA50');
  }

  // ─── 3) RSI momentum regime (max 20) ───
  if (r >= 55 && r <= 70) {
    longScore += 20;
    reasons.push(`RSI ${r.toFixed(1)} bullish`);
  } else if (r <= 45 && r >= 30) {
    shortScore += 20;
    reasons.push(`RSI ${r.toFixed(1)} bearish`);
  } else if (r > 75) {
    shortScore += 10;
    reasons.push('RSI overbought');
  } else if (r < 25) {
    longScore += 10;
    reasons.push('RSI oversold');
  } else {
    rejections.push(`rsi-neutral-${r.toFixed(0)}`);
  }

  // ─── 4) Volume confirmation (max 15) ───
  if (volRatio > 1.3) {
    if (longScore > shortScore) { longScore += 15; reasons.push(`Vol x${volRatio.toFixed(2)} bull`); }
    else if (shortScore > longScore) { shortScore += 15; reasons.push(`Vol x${volRatio.toFixed(2)} bear`); }
  } else if (volRatio > 1.1) {
    if (longScore > shortScore) { longScore += 8; }
    else if (shortScore > longScore) { shortScore += 8; }
  } else {
    rejections.push(`vol-flat-${volRatio.toFixed(2)}`);
  }

  // ─── 5) ATR healthy bonus (max 15) ───
  if (atrPct >= 0.003 && atrPct <= 0.012) {
    if (longScore > shortScore) longScore += 15;
    else if (shortScore > longScore) shortScore += 15;
    reasons.push(`ATR ${(atrPct * 100).toFixed(2)}% ideal`);
  } else {
    if (longScore > shortScore) longScore += 5;
    else if (shortScore > longScore) shortScore += 5;
    reasons.push(`ATR ${(atrPct * 100).toFixed(2)}% ok`);
  }

  // ─── 6) MACD histogram agrees (max 10) ───
  if (macdHistogram > 0 && longScore > shortScore) {
    longScore += 10;
    reasons.push('MACD+ agrees');
  } else if (macdHistogram < 0 && shortScore > longScore) {
    shortScore += 10;
    reasons.push('MACD- agrees');
  } else if (macdHistogram !== 0) {
    rejections.push(`macd-disagrees-${macdHistogram.toFixed(2)}`);
  }

  const winner: 'LONG' | 'SHORT' | 'NONE' =
    longScore > shortScore ? 'LONG' : shortScore > longScore ? 'SHORT' : 'NONE';
  const total = Math.max(longScore, shortScore);

  // Return raw score; caller decides the threshold (App.tsx uses MIN_CONFLUENCE_SCORE)
  return {
    total,
    direction: total >= 60 ? winner : 'NONE',
    reasons,
    rejections,
    indicators: {
      emaFast: e20,
      emaSlow: e50,
      emaTrend: e200,
      rsi: r,
      atr: a,
      atrPct,
      volumeRatio: volRatio,
      macdHistogram,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Kill zones
// ─────────────────────────────────────────────────────────────────────────

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
  return { ok: false, name: 'off-zone', weight: 0 };
}

// ─────────────────────────────────────────────────────────────────────────
// ATR-scaled TP / SL
// ─────────────────────────────────────────────────────────────────────────

export function buildRiskLevels(
  direction: 'LONG' | 'SHORT',
  entry: number,
  atrValue: number,
  cfg = botConfig.risk_engine,
) {
  const slDist = atrValue * 2.2;
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

// ─────────────────────────────────────────────────────────────────────────
// Position sizing — DYNAMIC step lookup
// ─────────────────────────────────────────────────────────────────────────

const STEP_MAP_FALLBACK: Record<string, number> = {
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

const DEFAULT_LEVERAGE = 10;
const MARGIN_SAFETY_FACTOR = 0.85;

export function positionSize(
  symbol: string,
  entry: number,
  slDist: number,
  accountBalance: number,
  riskPct = botConfig.risk_engine.max_account_risk_percent,
  leverage: number = DEFAULT_LEVERAGE,
  /** When caller has loaded exchangeInfo, pass the real step here */
  exchangeStepSize?: number,
): number {
  if (slDist <= 0 || accountBalance <= 0 || entry <= 0) return 0;

  const step = exchangeStepSize ?? STEP_MAP_FALLBACK[symbol] ?? 0.01;
  const riskUsd = accountBalance * (riskPct / 100);
  const riskQty = riskUsd / slDist;
  const maxNotionalUsd = accountBalance * leverage * MARGIN_SAFETY_FACTOR;
  const marginQty = maxNotionalUsd / entry;
  const rawQty = Math.min(riskQty, marginQty);
  const qty = Math.floor(rawQty / step) * step;
  return Math.max(Number(qty.toFixed(8)), 0);
}