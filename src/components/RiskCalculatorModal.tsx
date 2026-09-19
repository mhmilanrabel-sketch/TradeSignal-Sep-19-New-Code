import React, { useState, useMemo } from 'react';
import { TradeSignal } from '../types';
import { 
  X, 
  Calculator, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  Copy, 
  ArrowUpRight, 
  ArrowDownRight,
  HelpCircle
} from 'lucide-react';

interface RiskCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSignal?: TradeSignal | null;
}

export const RiskCalculatorModal: React.FC<RiskCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialSignal,
}) => {
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [entryPrice, setEntryPrice] = useState<number>(initialSignal?.entryPrice || 64150);
  const [stopLoss, setStopLoss] = useState<number>(initialSignal?.stopLoss || 63650);
  const [takeProfit1, setTakeProfit1] = useState<number>(initialSignal?.takeProfit1 || 64850);
  const [takeProfit2, setTakeProfit2] = useState<number>(initialSignal?.takeProfit2 || 65400);
  const [leverage, setLeverage] = useState<number>(5);
  const [copied, setCopied] = useState(false);

  // Sync state if initialSignal changes
  React.useEffect(() => {
    if (initialSignal) {
      setEntryPrice(initialSignal.entryPrice);
      setStopLoss(initialSignal.stopLoss);
      setTakeProfit1(initialSignal.takeProfit1);
      setTakeProfit2(initialSignal.takeProfit2);
    }
  }, [initialSignal]);

  const isLong = entryPrice >= stopLoss;

  // Perform accurate risk & position calculations
  const calc = useMemo(() => {
    const dollarRisk = (accountBalance * riskPercent) / 100;
    const priceRiskDistance = Math.abs(entryPrice - stopLoss);
    const slPercent = entryPrice > 0 ? (priceRiskDistance / entryPrice) * 100 : 0;

    let units = 0;
    let totalPositionUsd = 0;
    if (priceRiskDistance > 0) {
      units = dollarRisk / priceRiskDistance;
      totalPositionUsd = units * entryPrice;
    }

    const marginRequired = leverage > 0 ? totalPositionUsd / leverage : totalPositionUsd;

    // TP1 Profit
    const tp1Distance = Math.abs(takeProfit1 - entryPrice);
    const tp1ProfitUsd = units * tp1Distance;
    const tp1ProfitPercent = accountBalance > 0 ? (tp1ProfitUsd / accountBalance) * 100 : 0;
    const rr1 = priceRiskDistance > 0 ? tp1Distance / priceRiskDistance : 0;

    // TP2 Profit
    const tp2Distance = Math.abs(takeProfit2 - entryPrice);
    const tp2ProfitUsd = units * tp2Distance;
    const tp2ProfitPercent = accountBalance > 0 ? (tp2ProfitUsd / accountBalance) * 100 : 0;
    const rr2 = priceRiskDistance > 0 ? tp2Distance / priceRiskDistance : 0;

    // Liquidation price estimate (approximate for cross margin / isolated)
    let estLiquidation = 0;
    if (leverage > 1) {
      const maxAdverse = entryPrice / leverage;
      estLiquidation = isLong ? entryPrice - maxAdverse : entryPrice + maxAdverse;
    }

    return {
      dollarRisk,
      priceRiskDistance,
      slPercent,
      units,
      totalPositionUsd,
      marginRequired,
      tp1ProfitUsd,
      tp1ProfitPercent,
      rr1,
      tp2ProfitUsd,
      tp2ProfitPercent,
      rr2,
      estLiquidation,
    };
  }, [accountBalance, riskPercent, entryPrice, stopLoss, takeProfit1, takeProfit2, leverage, isLong]);

  if (!isOpen) return null;

  const handleCopyPlan = () => {
    const text = `📋 POSITION SIZING & RISK PLAN
Asset: ${initialSignal ? initialSignal.symbol : 'Custom Trade'}
Account Balance: $${accountBalance.toLocaleString()} | Risk: ${riskPercent}% ($${calc.dollarRisk.toFixed(2)})
Direction: ${isLong ? 'LONG / BUY' : 'SHORT / SELL'} | Leverage: ${leverage}x
Entry: $${entryPrice.toLocaleString()}
Stop Loss: $${stopLoss.toLocaleString()} (${calc.slPercent.toFixed(2)}% distance)
Target 1 (TP1): $${takeProfit1.toLocaleString()} (R:R 1:${calc.rr1.toFixed(2)} | +$${calc.tp1ProfitUsd.toFixed(2)})
Target 2 (TP2): $${takeProfit2.toLocaleString()} (R:R 1:${calc.rr2.toFixed(2)} | +$${calc.tp2ProfitUsd.toFixed(2)})
Optimal Units: ${calc.units.toFixed(4)} ($${calc.totalPositionUsd.toFixed(2)} Notional)
Required Margin: $${calc.marginRequired.toFixed(2)}`;

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div 
        id="risk-calculator-modal"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Position Sizing & Risk Management
                {initialSignal && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {initialSignal.symbol}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Calculate exact units, dollar risk, and margin allocation</p>
            </div>
          </div>
          <button
            id="close-risk-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Inputs Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account Balance */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Account Balance ($)</span>
                <span className="text-[10px] text-slate-500 font-mono">USD</span>
              </label>
              <input
                id="calc-account-balance"
                type="number"
                min={100}
                step={100}
                value={accountBalance}
                onChange={(e) => setAccountBalance(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Risk Percentage */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Risk Per Trade (%)</span>
                <span className="text-[10px] font-mono text-amber-400 font-bold">${calc.dollarRisk.toFixed(2)} at risk</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="calc-risk-percent"
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                  className="w-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-1 flex-1">
                  {[0.5, 1.0, 2.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRiskPercent(preset)}
                      className={`flex-1 py-2 text-xs rounded-lg font-mono font-medium border transition-colors ${
                        riskPercent === preset
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Entry Price */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Entry Price ($)
              </label>
              <input
                id="calc-entry-price"
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Stop Loss */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Stop Loss ($)</span>
                <span className="text-[10px] text-rose-400 font-mono">Distance: {calc.slPercent.toFixed(2)}%</span>
              </label>
              <input
                id="calc-stop-loss"
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-rose-300 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Take Profit 1 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Take Profit 1 ($)</span>
                <span className="text-[10px] text-emerald-400 font-mono">R:R 1:{calc.rr1.toFixed(2)}</span>
              </label>
              <input
                id="calc-take-profit-1"
                type="number"
                step="any"
                value={takeProfit1}
                onChange={(e) => setTakeProfit1(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-emerald-300 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Leverage Multiplier */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Leverage / Margin</span>
                <span className="text-[10px] text-slate-400">{leverage}x multiplier</span>
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 5, 10, 20].map((lev) => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => setLeverage(lev)}
                    className={`flex-1 py-2 text-xs rounded-lg font-mono font-medium border transition-colors ${
                      leverage === lev
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Warning banner if risk > 2.5% */}
          {riskPercent > 2.5 && (
            <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-600/50 rounded-lg text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Caution: Risking more than 2.5% per trade increases probability of severe drawdown. Professional traders recommend 1-2%.
              </span>
            </div>
          )}

          {/* Results Summary Grid */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Calculated Order Parameters
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Max Dollar Risk */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">Max Dollar Risk</div>
                <div className="font-mono text-base font-bold text-rose-400 mt-0.5">
                  -${calc.dollarRisk.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Exactly {riskPercent}% of equity</div>
              </div>

              {/* Optimal Position Size */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">Optimal Position Size</div>
                <div className="font-mono text-base font-bold text-white mt-0.5">
                  {calc.units < 1 ? calc.units.toFixed(4) : calc.units.toFixed(2)} Units
                </div>
                <div className="text-[10px] text-slate-400 font-mono">${calc.totalPositionUsd.toFixed(2)} Notional</div>
              </div>

              {/* Required Margin */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">Required Margin ({leverage}x)</div>
                <div className="font-mono text-base font-bold text-blue-400 mt-0.5">
                  ${calc.marginRequired.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{((calc.marginRequired / accountBalance) * 100).toFixed(1)}% of account</div>
              </div>

              {/* TP1 Return */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-emerald-950/60">
                <div className="text-[11px] text-emerald-400">Target 1 (TP1) Gain</div>
                <div className="font-mono text-base font-bold text-emerald-400 mt-0.5">
                  +${calc.tp1ProfitUsd.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-500 font-mono">+{calc.tp1ProfitPercent.toFixed(2)}% account | 1:{calc.rr1.toFixed(2)}</div>
              </div>

              {/* TP2 Return */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-emerald-950/60">
                <div className="text-[11px] text-emerald-400">Target 2 (TP2) Gain</div>
                <div className="font-mono text-base font-bold text-emerald-400 mt-0.5">
                  +${calc.tp2ProfitUsd.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-500 font-mono">+{calc.tp2ProfitPercent.toFixed(2)}% account | 1:{calc.rr2.toFixed(2)}</div>
              </div>

              {/* Estimated Liquidation */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">Est. Liquidation Price</div>
                <div className="font-mono text-base font-bold text-slate-300 mt-0.5">
                  {calc.estLiquidation > 0 ? `$${calc.estLiquidation.toFixed(2)}` : 'N/A (1x Spot)'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Beyond Stop Loss</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Never risk more than planned. Set hard stop losses in your exchange.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="copy-risk-plan-btn"
              type="button"
              onClick={handleCopyPlan}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Plan!' : 'Copy Plan'}</span>
            </button>

            <button
              id="close-calculator-done-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
