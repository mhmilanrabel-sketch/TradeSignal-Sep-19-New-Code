// src/utils/aiTradeValidator.ts
// ============================================================================
// AI Trade Validator — Gemini REST API (no SDK dependency).
//
// ✅ Uses the NEW-format Gemini API keys (AQ.Ab8RN6...) which must be sent
//    in the "x-goog-api-key" HEADER, not as a "?key=" URL query parameter.
//
// Called ONLY for borderline setups (score 70–84).
// Returns null on any failure so the caller falls back to rules-only.
// ============================================================================

export type AiVerdict = 'APPROVE' | 'CAUTION' | 'REJECT';

export interface AiRecentTrade {
  symbol: string;
  direction: string;
  outcome: string;
  pnlPct: number;
}

export interface AiTradeContext {
  symbol: string;
  direction: 'LONG' | 'SHORT';
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
}

export interface AiValidationResult {
  verdict: AiVerdict;
  confidence: number;
  reason: string;
  positionSizeMultiplier: number;
}

const SYSTEM_PROMPT = `You are a crypto futures scalp trade VALIDATOR for a bot trading Binance USDT-M Futures.

The bot runs a 5-minute multi-indicator confluence strategy on this whitelist:
BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, DOT (all /USDT).

You are shown a CANDIDATE TRADE that already passed the bot's rules engine.
Your job is to catch setups the rules engine got WRONG.

Historical failure patterns you MUST guard against:
1. LONG entries during a 15m or 1h DOWNTREND — the rules engine's 5m EMAs lag by 10-20 minutes
2. SHORT entries during a 15m or 1h UPTREND — same lag problem
3. Entering after price has already extended >1.5% from recent swing — chasing
4. Entering during low ATR chop (ATR < 0.3% of price on 5m)
5. Entering when the daily P&L is already > -3% (bot is "tilted", should slow down)
6. Entering in off-killzone hours (Asian session low liquidity)

Decision rules:
- APPROVE: 5m, 15m, and (if directional) 1h all agree. Setup is clean.
- CAUTION: mixed signals — e.g. 5m and 15m agree but 1h is neutral or mildly opposed.
  Position size should be halved.
- REJECT: any hard failure pattern above is present, OR 15m direction contradicts 5m,
  OR daily P&L < -3% with recent consecutive losses.

You MUST respond with ONLY valid JSON in this exact shape:
{
  "verdict": "APPROVE" | "CAUTION" | "REJECT",
  "confidence": <number 0-100>,
  "reason": "<one sentence under 200 characters>"
}

Do not include markdown. Do not include explanations outside the JSON.`;

function getGeminiApiKey(): string {
  try {
    const env: any = (import.meta as any)?.env ?? {};
    const key = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    return typeof key === 'string' ? key.trim() : '';
  } catch {
    return '';
  }
}

export function isAiValidatorConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ────────────────────────────────────────────────────────────────────────────
// ✅ FIXED: uses x-goog-api-key header instead of ?key= URL param.
//    Works with BOTH new-format (AQ.Ab8RN6...) and legacy (AIzaSy...) keys.
// ────────────────────────────────────────────────────────────────────────────
async function callGeminiRest(
  apiKey: string,
  systemPrompt: string,
  userJson: string,
): Promise<string | null> {
  const url = `${GEMINI_ENDPOINT_BASE}/${GEMINI_MODEL}:generateContent`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userJson }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      maxOutputTokens: 400,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      console.warn(`[aiValidator] Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }

    let data: any;
    try { data = JSON.parse(text); }
    catch { console.warn('[aiValidator] Non-JSON response from Gemini'); return null; }

    const candidate = data?.candidates?.[0];
    const partText = candidate?.content?.parts?.[0]?.text;
    if (typeof partText === 'string' && partText.length > 0) return partText;

    console.warn('[aiValidator] Gemini returned no text part. Raw:', text.slice(0, 300));
    return null;
  } catch (err: any) {
    console.warn(`[aiValidator] Network error: ${err.message}`);
    return null;
  }
}

export async function validateTradeWithAi(
  ctx: AiTradeContext,
  timeoutMs: number = 6000,
): Promise<AiValidationResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const userPayload = {
    candidate: {
      symbol: ctx.symbol,
      direction: ctx.direction,
      entry: ctx.entryPrice,
      stopLoss: ctx.stopLoss,
      takeProfit: ctx.takeProfit,
      riskPct: Number(((Math.abs(ctx.entryPrice - ctx.stopLoss) / ctx.entryPrice) * 100).toFixed(3)),
      rewardPct: Number(((Math.abs(ctx.takeProfit - ctx.entryPrice) / ctx.entryPrice) * 100).toFixed(3)),
    },
    timeframeAlignment: {
      '5m':  { score: ctx.score5m,  direction: ctx.direction5m,  reasons: ctx.reasons5m },
      '15m': { score: ctx.score15m, direction: ctx.direction15m, reasons: ctx.reasons15m },
      '1h':  { score: ctx.score1h,  direction: ctx.direction1h,  reasons: ctx.reasons1h },
    },
    volatility: { atrPct: Number((ctx.atrPct * 100).toFixed(3)) },
    session: { killZone: ctx.killZoneName, killZoneWeight: ctx.killZoneWeight },
    botState: {
      dailyPnlPct: ctx.dailyPnlPct,
      recentTrades: ctx.recentTrades.slice(0, 8),
    },
  };

  const userJson = JSON.stringify(userPayload);

  const race = (async (): Promise<AiValidationResult | null> => {
    const rawText = await callGeminiRest(apiKey, SYSTEM_PROMPT, userJson);
    if (!rawText) return null;

    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn('[aiValidator] Non-JSON response:', cleaned.slice(0, 200));
        return null;
      }
      try { parsed = JSON.parse(match[0]); }
      catch { console.warn('[aiValidator] Salvage parse failed'); return null; }
    }

    const rawVerdict = String(parsed.verdict || '').toUpperCase();
    const verdict: AiVerdict =
      rawVerdict === 'APPROVE' || rawVerdict === 'REJECT' ? rawVerdict : 'CAUTION';

    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 50));
    const reason = String(parsed.reason || 'No reason provided').slice(0, 240);
    const multiplier = verdict === 'APPROVE' ? 1.0 : verdict === 'CAUTION' ? 0.5 : 0;

    return { verdict, confidence, reason, positionSizeMultiplier: multiplier };
  })();

  const timeout = new Promise<AiValidationResult | null>((resolve) =>
    setTimeout(() => {
      console.warn(`[aiValidator] Timeout after ${timeoutMs}ms — falling back to rules only`);
      resolve(null);
    }, timeoutMs),
  );

  return Promise.race([race, timeout]);
}