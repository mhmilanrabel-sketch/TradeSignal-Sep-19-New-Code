// src/utils/alertService.ts
// ============================================================================
// Telegram alert service — plain-text, URL-safe, with full diagnostics.
// ============================================================================

// ⚠️ Replace with your NEW token after revoking the one you posted publicly.
const TELEGRAM_BOT_TOKEN = 'PASTE_YOUR_NEW_TOKEN_HERE';

// ⚠️ Get this from https://api.telegram.org/bot<TOKEN>/getUpdates
//    after sending /start to your own bot. It's a NUMBER, not a username.
const TELEGRAM_CHAT_ID = 'PASTE_YOUR_NUMERIC_CHAT_ID_HERE';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ────────────────────────────────────────────────────────────────────────────
// Low-level sender — plain text only, no parse_mode, always URL-encoded.
// ────────────────────────────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'PASTE_YOUR_NEW_TOKEN_HERE') {
    console.warn('[telegram] Bot token not configured — skipping alert.');
    return false;
  }
  if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'PASTE_YOUR_NUMERIC_CHAT_ID_HERE') {
    console.warn('[telegram] chat_id not configured — send /start to your bot, then read getUpdates.');
    return false;
  }

  // Truncate to Telegram's 4096-char limit for sendMessage
  const safeText = text.length > 4000 ? text.slice(0, 3990) + '…[truncated]' : text;

  const url = `${TELEGRAM_API}/sendMessage?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}&text=${encodeURIComponent(safeText)}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const body = await res.text();

    if (!res.ok) {
      // Log the actual Telegram error so you can see the reason
      console.error(`[telegram] HTTP ${res.status} body: ${body.slice(0, 400)}`);
      return false;
    }
    // Even on HTTP 200, Telegram can return {"ok":false, ...}
    try {
      const j = JSON.parse(body);
      if (!j.ok) {
        console.error(`[telegram] API rejected: ${j.description ?? 'unknown reason'}`);
        return false;
      }
      return true;
    } catch {
      return true; // no parse but 200 → assume OK
    }
  } catch (err: any) {
    console.error(`[telegram] network error: ${err.message}`);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API — matches the functions imported in App.tsx
// ────────────────────────────────────────────────────────────────────────────
export async function alertTest(): Promise<boolean> {
  return sendTelegram(
    `✅ TradeSignal Bot Test\n` +
    `Your alerts are working.\n` +
    `Time: ${new Date().toUTCString()}`,
  );
}

export async function alertTradeOpened(info: {
  symbol: string; direction: string; entryPrice: number;
  stopLoss: number; takeProfit1: number; takeProfit2?: number;
  confidenceScore: number; riskRewardRatio: number;
  reasoning: string; binanceOrderId?: string;
  environment: string; usdtBalance?: number | null;
}): Promise<boolean> {
  return sendTelegram(
    `🟢 TRADE OPENED\n` +
    `Symbol: ${info.symbol}\n` +
    `Side: ${info.direction}\n` +
    `Entry: $${info.entryPrice}\n` +
    `SL: $${info.stopLoss}\n` +
    `TP1: $${info.takeProfit1}\n` +
    (info.takeProfit2 ? `TP2: $${info.takeProfit2}\n` : '') +
    `R:R 1:${info.riskRewardRatio}\n` +
    `Score: ${info.confidenceScore}/100\n` +
    `Order ID: ${info.binanceOrderId ?? 'n/a'}\n` +
    `Env: ${info.environment}\n` +
    (info.usdtBalance != null ? `Free margin: $${info.usdtBalance.toFixed(2)}\n` : '') +
    `Reason: ${info.reasoning}`,
  );
}

export async function alertTradeClosed(info: {
  symbol: string; direction: string; entryPrice: number; exitPrice: number;
  pnlPercentage: number; outcome: 'SL' | 'TP1' | 'TP2' | 'MANUAL' | string;
  duration: string; environment: string;
}): Promise<boolean> {
  const emoji = info.outcome === 'SL' ? '🔴' : info.outcome === 'MANUAL' ? '⚪' : '🟢';
  return sendTelegram(
    `${emoji} TRADE CLOSED — ${info.outcome}\n` +
    `Symbol: ${info.symbol}\n` +
    `Side: ${info.direction}\n` +
    `Entry: $${info.entryPrice}\n` +
    `Exit: $${info.exitPrice}\n` +
    `PnL: ${info.pnlPercentage >= 0 ? '+' : ''}${info.pnlPercentage}%\n` +
    `Duration: ${info.duration}\n` +
    `Env: ${info.environment}`,
  );
}

export async function alertDailyDrawdownHit(pnlPct: number, environment: string): Promise<boolean> {
  return sendTelegram(
    `🛑 DAILY DRAWDOWN LIMIT HIT\n` +
    `Daily P&L: ${pnlPct.toFixed(2)}%\n` +
    `Trading paused for today.\n` +
    `Env: ${environment}`,
  );
}

export async function alertGeoBlock(reason: string, environment: string): Promise<boolean> {
  return sendTelegram(
    `🚫 GEO BLOCK DETECTED\n` +
    `Reason: ${reason}\n` +
    `Env: ${environment}`,
  );
}

export async function alertBotStarted(environment: string, pairs: number, minScore: number): Promise<boolean> {
  return sendTelegram(
    `🤖 BOT STARTED\n` +
    `Env: ${environment}\n` +
    `Pairs: ${pairs}\n` +
    `Min confluence: ${minScore}\n` +
    `Time: ${new Date().toUTCString()}`,
  );
}

export async function alertBotStopped(environment: string): Promise<boolean> {
  return sendTelegram(
    `⏸️ BOT STOPPED\n` +
    `Env: ${environment}\n` +
    `Time: ${new Date().toUTCString()}`,
  );
}