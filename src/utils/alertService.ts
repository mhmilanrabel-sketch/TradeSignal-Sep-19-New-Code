// src/utils/alertService.ts
// ============================================================================
// Telegram alert service — plain text, URL-encoded, with diagnostics.
// ============================================================================

// ⚠️ This token has been posted publicly in chat. It is compromised.
//     Revoke it in @BotFather and replace this line before going live.
const TELEGRAM_BOT_TOKEN = '8935995466:AAG7YU-j4SeoDj5oanSDEQ2nDKbnsS8NpfM';

// Your numeric chat_id, taken from your /getUpdates response.
const TELEGRAM_CHAT_ID = '1034087034';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ────────────────────────────────────────────────────────────────────────────
// Low-level sender — plain text only, no parse_mode, always URL-encoded.
// ────────────────────────────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<boolean> {
  // Guard: both values must be non-empty strings with no leftover placeholders.
  // We do NOT compare against the literal 'PASTE_...' strings, because TS
  // flags those comparisons as impossible once a real value is hard-coded.
  const tokenOk = typeof TELEGRAM_BOT_TOKEN === 'string' && TELEGRAM_BOT_TOKEN.trim().length > 0;
  const chatOk  = typeof TELEGRAM_CHAT_ID   === 'string' && TELEGRAM_CHAT_ID.trim().length   > 0;

  if (!tokenOk) {
    console.warn('[telegram] Bot token not configured.');
    return false;
  }
  if (!chatOk) {
    console.warn('[telegram] chat_id not configured.');
    return false;
  }

  const safeText = text.length > 4000 ? text.slice(0, 3990) + '…' : text;
  const url = `${TELEGRAM_API}/sendMessage?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}&text=${encodeURIComponent(safeText)}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const body = await res.text();

    if (!res.ok) {
      console.error(`[telegram] HTTP ${res.status} body: ${body.slice(0, 400)}`);
      return false;
    }
    try {
      const j = JSON.parse(body);
      if (!j.ok) {
        console.error(`[telegram] API rejected: ${j.description ?? 'unknown reason'}`);
        return false;
      }
      return true;
    } catch {
      return true;
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