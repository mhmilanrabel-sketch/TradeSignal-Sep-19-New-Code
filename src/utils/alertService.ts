// ============================================================================
// Telegram Alert Service — TradeSignal
// ============================================================================
// Sends phone notifications when trading events occur.
// Setup: create a bot with @BotFather, get the token and chat ID,
// then paste them into the constants below.
// ============================================================================

const TELEGRAM_BOT_TOKEN = '8935995466:AAG7YU-j4SeoDj5oanSDEQ2nDKbnsS8NpfM';
const TELEGRAM_CHAT_ID = '1034087034';

let alertsEnabled = true;

export function setAlertsEnabled(v: boolean) {
  alertsEnabled = v;
}

export function isAlertsConfigured(): boolean {
  return TELEGRAM_BOT_TOKEN.length > 20 && TELEGRAM_CHAT_ID.length > 4;
}

async function sendTelegram(message: string): Promise<boolean> {
  if (!alertsEnabled || !isAlertsConfigured()) return false;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[alerts] Telegram send failed:', err);
    return false;
  }
}

// ============================================================================
// Event-specific alert helpers
// ============================================================================

export interface TradeAlertPayload {
  symbol: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidenceScore: number;
  riskRewardRatio: number;
  reasoning: string;
  binanceOrderId?: string;
  environment: string;
  usdtBalance?: number | null;
}

export async function alertTradeOpened(p: TradeAlertPayload) {
  const arrow = p.direction.includes('BUY') ? '🟢' : '🔴';
  const envLabel = p.environment.toUpperCase();
  const msg = `${arrow} <b>TRADE OPENED [${envLabel}]</b> ${arrow}

<b>${p.symbol}</b> · ${p.direction}
Environment: <code>${envLabel}</code>

Entry: <code>$${fmt(p.entryPrice)}</code>
SL: <code>$${fmt(p.stopLoss)}</code>
TP1: <code>$${fmt(p.takeProfit1)}</code>
TP2: <code>$${fmt(p.takeProfit2)}</code>

Confidence: ${p.confidenceScore}/100
R:R 1:${p.riskRewardRatio}
${p.binanceOrderId ? `Order ID: <code>${p.binanceOrderId}</code>` : '⚠️ No Binance OrderId'}
${p.usdtBalance != null ? `Balance: <code>$${p.usdtBalance.toFixed(2)}</code>` : ''}

<i>${p.reasoning.slice(0, 200)}</i>

⏰ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  await sendTelegram(msg);
}

export interface TradeClosedPayload {
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnlPercentage: number;
  outcome: string;
  duration: string;
  environment: string;
}

export async function alertTradeClosed(p: TradeClosedPayload) {
  const win = p.pnlPercentage >= 0;
  const emoji = win ? '✅' : '❌';
  const envLabel = p.environment.toUpperCase();
  const msg = `${emoji} <b>TRADE CLOSED [${envLabel}]</b> ${emoji}

<b>${p.symbol}</b> · ${p.direction}
Outcome: <b>${p.outcome}</b>
Environment: <code>${envLabel}</code>

Entry: <code>$${fmt(p.entryPrice)}</code>
Exit: <code>$${fmt(p.exitPrice)}</code>
PnL: <b>${win ? '+' : ''}${p.pnlPercentage.toFixed(2)}%</b>
Duration: ${p.duration}

⏰ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  await sendTelegram(msg);
}

export async function alertDailyDrawdownHit(pnlPct: number, env: string) {
  const envLabel = env.toUpperCase();
  const msg = `🛑 <b>DAILY DRAWDOWN LIMIT [${envLabel}]</b> 🛑

Cumulative P&L: <b>${pnlPct.toFixed(2)}%</b>
Environment: <code>${envLabel}</code>

Bot has paused all new trades until tomorrow.
⏰ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  await sendTelegram(msg);
}

export async function alertGeoBlock(details: string, env: string) {
  const envLabel = env.toUpperCase();
  const msg = `🚫 <b>GEO-BLOCK DETECTED [${envLabel}]</b> 🚫

Environment: <code>${envLabel}</code>
Reason: ${details.slice(0, 200)}

The bot cannot place orders.
⏰ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  await sendTelegram(msg);
}

export async function alertBotStarted(env: string, symbolsCount: number, minConfluence: number) {
  const envLabel = env.toUpperCase();
  const msg = `🤖 <b>TradeSignal Bot Started [${envLabel}]</b>

Environment: <code>${envLabel}</code>
Whitelisted pairs: ${symbolsCount}
Min confluence: ${minConfluence}

⏰ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  await sendTelegram(msg);
}

export async function alertBotStopped(env: string) {
  const envLabel = env.toUpperCase();
  const msg = `⏸ <b>TradeSignal Bot Paused [${envLabel}]</b>

Environment: <code>${envLabel}</code>
Time: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  await sendTelegram(msg);
}

export async function alertTest() {
  const msg = `🧪 <b>TradeSignal Test Alert</b>

If you're seeing this on your phone, alerts are working correctly.

Bot: @milan_tradesignal_bot
⏰ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} SLST`;

  return sendTelegram(msg);
}

// ---------------------------------------------------------------------------
function fmt(p: number): string {
  if (!p && p !== 0) return '0';
  if (p < 2) return p.toFixed(4);
  if (p < 500) return p.toFixed(2);
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}