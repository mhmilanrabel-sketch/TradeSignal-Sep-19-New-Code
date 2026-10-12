// src/utils/aiTradeValidator.ts
import { getRiskStatus, getRiskState } from './riskEngine';
import { RISK_CONFIG } from '../config/riskConfig';

export type TradeDirection = 'LONG' | 'SHORT';
export type GeminiVerdict = 'APPROVE' | 'CAUTION' | 'REJECT';

export interface AiRecentTrade {
  symbol: string;
  direction: string;
  outcome: string;
  pnlPct: number;
}

export interface AiTradeContext {
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  score5m: number;
  score15m: number;
  score1h: number;
  direction5m: string;
  direction15m: string;
  direction1h: string;
  reasons5m: string[];
  reasons15m: string[];
  reasons1h: string[];
  atrPct: number;
  dailyPnlPct: number;
  recentTrades: AiRecentTrade[];
  killZoneName: string;
  killZoneWeight: number;
  recentWinRatePct: number;
  recentLossStreak: number;
  fundingRate: number;
}

export interface AiTradeResult {
  verdict: GeminiVerdict;
  confidence: number;
  reason: string;
  positionSizeMultiplier: number;
  rawResponse?: string;
}

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

let __cachedKey: string | null = null;

function readGeminiKeyFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash || '';
  const parts = hash.replace(/^#/, '').split('&');
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k === 'gk' && v) return decodeURIComponent(v);
  }
  return '';
}

export function isAiValidatorConfigured(): boolean {
  if (__cachedKey) return true;
  const k = readGeminiKeyFromUrl();
  if (k) { __cachedKey = k; return true; }
  const envKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) || '';
  if (envKey) { __cachedKey = envKey; return true; }
  return false;
}

if (typeof window !== 'undefined') {
  (window as any).setGeminiKey = (key: string) => {
    __cachedKey = key;
    console.log('[AI] Gemini key set manually');
  };
  (window as any).clearGeminiKey = () => {
    __cachedKey = null;
    console.log('[AI] Gemini key cleared');
  };
}

export function buildTradeContext(
  symbol: string, direction: TradeDirection, entryPrice: number,
  stopLoss: number, takeProfit: number, score5m: number, score15m: number,
  score1h: number, direction5m: string, direction15m: string, direction1h: string,
  reasons5m: string[], reasons15m: string[], reasons1h: string[],
  atrPct: number, killZoneName: string, killZoneWeight: number, fundingRate: number,
): AiTradeContext {
  const risk = getRiskStatus();
  const state = getRiskState();
  const recent = state.tradeLog.slice(-20);
  const wins = recent.filter((t) => t.pnlUsdt > 0).length;
  const recentWinRatePct = recent.length > 0 ? (wins / recent.length) * 100 : 50;
  let recentLossStreak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].pnlUsdt <= 0) recentLossStreak++;
    else break;
  }
  const recentTrades: AiRecentTrade[] = recent.slice(-10).map((t) => ({
    symbol: t.symbol,
    direction: t.side === 'LONG' ? 'BUY (LONG)' : 'SELL (SHORT)',
    outcome: t.pnlUsdt > 0 ? 'TP1' : t.pnlUsdt < 0 ? 'SL' : 'MANUAL',
    pnlPct: t.pnlPct,
  }));
  return {
    symbol, direction, entryPrice, stopLoss, takeProfit,
    score5m, score15m, score1h,
    direction5m, direction15m, direction1h,
    reasons5m, reasons15m, reasons1h,
    atrPct, fundingRate, killZoneName, killZoneWeight,
    dailyPnlPct: risk.dailyPnlPct,
    recentTrades, recentWinRatePct, recentLossStreak,
  };
}

export function buildPrompt(ctx: AiTradeContext): string {
  return `You are a cautious risk manager reviewing a proposed trade for an automated crypto bot.

ACCOUNT LIMITS:
  • Daily loss limit: -${RISK_CONFIG.dailyLossLimitPct}%
  • Max trades/day: ${RISK_CONFIG.maxTradesPerDay}
  • Max consecutive losses: ${RISK_CONFIG.maxConsecutiveLosses}
  • Risk per trade: ${RISK_CONFIG.riskPerTradePct}%

CURRENT STATE:
  • Daily P&L: ${ctx.dailyPnlPct.toFixed(2)}%
  • Recent win rate: ${ctx.recentWinRatePct.toFixed(1)}%
  • Loss streak: ${ctx.recentLossStreak}

TRADE PROPOSAL:
  Symbol: ${ctx.symbol} · Direction: ${ctx.direction}
  Entry: ${ctx.entryPrice} · SL: ${ctx.stopLoss} · TP: ${ctx.takeProfit}
  ATR%: ${ctx.atrPct.toFixed(4)} · Funding: ${ctx.fundingRate.toFixed(6)}

SIGNALS:
  5m: ${ctx.score5m} ${ctx.direction5m}
  15m: ${ctx.score15m} ${ctx.direction15m}
  1h: ${ctx.score1h} ${ctx.direction1h}

Reply ONLY with JSON:
{ "verdict": "APPROVE" | "CAUTION" | "REJECT", "confidence": 0-100, "reason": "..." }

Rules:
  • REJECT if |dailyPnlPct| within 1% of limit.
  • REJECT if loss streak >= ${RISK_CONFIG.maxConsecutiveLosses}.
  • REJECT if 5m/15m/1h conflict.
  • CAUTION if weak.
  • APPROVE only when aligned.`;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function callGemini(prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 160)}`);
    }
    const data = (await res.json()) as GeminiResponse;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function validateTradeWithAi(
  ctx: AiTradeContext,
  timeoutMs: number = 8000,
): Promise<AiTradeResult | null> {
  if (!isAiValidatorConfigured()) {
    console.log('[AI] Validator not configured — skipping');
    return null;
  }
  try {
    const risk = getRiskState();
    if (risk.tradingHalted) {
      return {
        verdict: 'REJECT', confidence: 100,
        reason: 'Risk engine halted: daily loss limit reached.',
        positionSizeMultiplier: 0,
      };
    }
  } catch { /* ignore */ }

  const prompt = buildPrompt(ctx);
  try {
    const raw = await callGemini(prompt, __cachedKey!, timeoutMs);
    if (!raw) return null;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { return null; }
    const verdict: GeminiVerdict =
      parsed.verdict === 'APPROVE' || parsed.verdict === 'REJECT' ? parsed.verdict : 'CAUTION';
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    const reason = String(parsed.reason ?? parsed.rationale ?? '');
    let positionSizeMultiplier = 1.0;
    if (verdict === 'REJECT') positionSizeMultiplier = 0;
    else if (verdict === 'CAUTION') positionSizeMultiplier = 0.5;
    return { verdict, confidence, reason, positionSizeMultiplier, rawResponse: raw };
  } catch (err: any) {
    console.warn('[AI] Gemini call failed:', String(err?.message ?? err));
    return null;
  }
}

export async function validateTradeWithGemini(ctx: AiTradeContext): Promise<AiTradeResult> {
  const r = await validateTradeWithAi(ctx, 8000);
  return r ?? {
    verdict: 'CAUTION', confidence: 0,
    reason: 'AI unavailable.', positionSizeMultiplier: 1.0,
  };
}

export function isVerdictSafe(result: AiTradeResult | null, minConfidence = 60): boolean {
  if (!result) return true;
  if (result.verdict === 'REJECT') return false;
  if (result.verdict === 'CAUTION' && result.confidence < minConfidence) return false;
  return true;
}