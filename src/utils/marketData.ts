// ============================================================================
// Real Market Data — fetches live candles from Binance klines endpoint
// ----------------------------------------------------------------------------
// Replaces the synthetic random-walk candles from utils/indicators.ts
// Uses an in-memory cache (30s TTL) to avoid hammering Binance rate limits.
// ============================================================================

import { CandleData } from '../types';

interface CacheEntry {
  candles: CandleData[];
  timestamp: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const candleCache = new Map<string, CacheEntry>();

/**
 * Fetch real Binance klines via the proxied URL. The proxied URL must
 * already include the ?target=<encoded-binance-url> wrapper.
 * Returns an array of CandleData.
 */
export async function fetchKlinesViaProxy(proxiedUrl: string): Promise<CandleData[]> {
  const res = await fetch(proxiedUrl, { method: 'GET' });

  const text = await res.text();

  // Detect HTML (geo-block, Caddy error, proxy misconfig)
  if (text.trim().startsWith('<')) {
    throw new Error('Proxy returned HTML (geo-block or proxy error)');
  }

  if (!res.ok) {
    throw new Error(`Klines HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`Proxy returned non-JSON: ${text.slice(0, 120)}`);
  }

  // Binance returns an array of arrays
  // [openTime, open, high, low, close, volume, closeTime, ...]
  if (!Array.isArray(raw)) {
    throw new Error(`Klines: expected array, got ${typeof raw}`);
  }

  const candles: CandleData[] = raw
    .filter((k: any) => Array.isArray(k) && k.length >= 6)
    .map((k: any[]) => ({
      time: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
    .filter((c) => Number.isFinite(c.close) && c.close > 0);

  return candles;
}

/**
 * Fetch candles with caching. Cache key is symbol + interval + limit.
 * On fetch failure, returns the last cached value (if any) so the bot
 * doesn't stall on a single bad request.
 */
export async function getCachedCandles(
  cacheKey: string,
  proxiedUrl: string,
): Promise<{ candles: CandleData[]; fromCache: boolean; error?: string }> {
  const now = Date.now();
  const cached = candleCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { candles: cached.candles, fromCache: true };
  }

  try {
    const candles = await fetchKlinesViaProxy(proxiedUrl);
    if (candles.length === 0) {
      throw new Error('Klines empty');
    }
    candleCache.set(cacheKey, { candles, timestamp: now });
    return { candles, fromCache: false };
  } catch (err: any) {
    console.warn(`[marketData] fetch failed for ${cacheKey}:`, err.message);
    if (cached) {
      return { candles: cached.candles, fromCache: true, error: err.message };
    }
    return { candles: [], fromCache: false, error: err.message };
  }
}

/**
 * Manually clear the cache (useful for debugging).
 */
export function clearCandleCache() {
  candleCache.clear();
}