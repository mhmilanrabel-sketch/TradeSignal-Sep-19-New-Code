// src/utils/alertService.ts
// ═══════════════════════════════════════════════════════════════════════════
// SECURITY FIX:
//   The hardcoded token in the original file was compromised (posted in chat).
//   This version reads from Vite env vars, with a localStorage fallback so
//   the app still works in the browser without a rebuild.
//
//   Add to your .env file:
//     VITE_TELEGRAM_BOT_TOKEN=your_new_token_here
//     VITE_TELEGRAM_CHAT_ID=your_chat_id_here
// ═══════════════════════════════════════════════════════════════════════════

function getToken(): string {
  try {
    const env: any = (import.meta as any)?.env ?? {};
    const fromEnv = env.VITE_TELEGRAM_BOT_TOKEN || '';
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();
  } catch { /* ignore */ }

  try {
    const ls = localStorage.getItem('tradesignal_tg_token');
    if (ls && ls.trim().length > 0) return ls.trim();
  } catch { /* ignore */ }

  return '';
}

function getChatId(): string {
  try {
    const env: any = (import.meta as any)?.env ?? {};
    const fromEnv = env.VITE_TELEGRAM_CHAT_ID || '';
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();
  } catch { /* ignore */ }

  try {
    const ls = localStorage.getItem('tradesignal_tg_chat_id');
    if (ls && ls.trim().length > 0) return ls.trim();
  } catch { /* ignore */ }

  return '';
}

if (typeof window !== 'undefined') {
  (window as any).setTelegramCreds = (token: string, chatId: string) => {
    try { localStorage.setItem('tradesignal_tg_token', token); } catch { /* ignore */ }
    try { localStorage.setItem('tradesignal_tg_chat_id', chatId); } catch { /* ignore */ }
    console.log('%c✅ Telegram credentials saved. Reloading…', 'color:#00E676;font-weight:bold');
    setTimeout(() => window.location.reload(), 800);
  };
}

async function sendTelegram(text: string): Promise<boolean> {
  const TOKEN = getToken();
  const CHAT_ID = getChatId();

  if (!TOKEN || !CHAT_ID) {
    console.warn('[telegram] Not configured. Run: setTelegramCreds("token", "chatid")');
    return false;
  }

  const safeText = text.length > 4000 ? text.slice(0, 3990) + '…' : text;
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage?chat_id=${encodeURIComponent(CHAT_ID)}&text=${encodeURIComponent(safeText)}`;

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

// ─── Public API (unchanged signatures — drop-in replacement) ───

export async function alertTest(): Promise<boolean> {
  return sendTelegram(`✅ TradeSignal Bot Test\nYour alerts are working.\nTime: ${new Date().toUTCString()}`);
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
  pnlPercentage: number; outcome: string;
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
  return sendTelegram(`🛑 DAILY DRAWDOWN LIMIT HIT\nDaily P&L: ${pnlPct.toFixed(2)}%\nTrading paused for today.\nEnv: ${environment}`);
}

export async function alertGeoBlock(reason: string, environment: string): Promise<boolean> {
  return sendTelegram(`🚫 GEO BLOCK DETECTED\nReason: ${reason}\nEnv: ${environment}`);
}

export async function alertBotStarted(environment: string, pairs: number, minScore: number): Promise<boolean> {
  return sendTelegram(`🤖 BOT STARTED\nEnv: ${environment}\nPairs: ${pairs}\nMin confluence: ${minScore}\nTime: ${new Date().toUTCString()}`);
}

export async function alertBotStopped(environment: string): Promise<boolean> {
  return sendTelegram(`⏸️ BOT STOPPED\nEnv: ${environment}\nTime: ${new Date().toUTCString()}`);
}

export async function alertKillZoneChange(
  event: 'ENTER' | 'EXIT',
  zoneName: string,
  zoneRange: string,
  weight: number,
  env: string,
): Promise<boolean> {
  const emoji = event === 'ENTER' ? '🟢' : '🔴';
  const verb = event === 'ENTER' ? 'ENTERED' : 'EXITED';
  return sendTelegram(
    `${emoji} KILLZONE ${verb}\n` +
    `Zone: ${zoneName}\n` +
    (zoneRange ? `Range: ${zoneRange}\n` : '') +
    `Weight: ${weight}\n` +
    `Env: ${env.toUpperCase()}\n` +
    `Time: ${new Date().toUTCString()}`,
  );
}