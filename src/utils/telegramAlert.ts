// src/utils/telegramAlert.ts
// ═══════════════════════════════════════════════════════════════════════════
// Optional Telegram alerts for entries, exits, and kill-switch events.
// ═══════════════════════════════════════════════════════════════════════════
import { RISK_CONFIG } from '../config/riskConfig';

async function send(text: string): Promise<void> {
  if (!RISK_CONFIG.telegram.enabled) return;
  const { botToken, chatId } = RISK_CONFIG.telegram;
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch {
    /* silent — alerts are best-effort */
  }
}

export const telegram = {
  entry: (symbol: string, side: string, qty: number, price: number, stop: number, target: number) =>
    send(`✅ <b>ENTRY</b>\n${side} ${qty} ${symbol}\nEntry: ${price.toFixed(2)}\nSL: ${stop.toFixed(2)}\nTP: ${target.toFixed(2)}`),

  exit: (symbol: string, pnlPct: number, pnlUsdt: number) =>
    send(`${pnlPct >= 0 ? '🟢' : '🔴'} <b>EXIT</b>\n${symbol}\nPnL: ${pnlPct.toFixed(2)}% (${pnlUsdt.toFixed(2)} USDT)`),

  killSwitch: (dailyPnlPct: number) =>
    send(`🛑 <b>KILL SWITCH</b>\nDaily loss ${dailyPnlPct.toFixed(2)}% hit limit. Trading halted.`),

  sessionBlocked: (reason: string) =>
    send(`⏸️ <b>SESSION BLOCKED</b>\n${reason}`),
};