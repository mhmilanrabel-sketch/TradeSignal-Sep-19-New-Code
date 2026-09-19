import React, { useState } from 'react';
import { TradeSignal } from '../types';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Target, 
  ShieldAlert, 
  LineChart, 
  Calculator, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Percent, 
  Layers
} from 'lucide-react';

interface SignalCardProps {
  signal: TradeSignal;
  onInspectChart: (symbol: string) => void;
  onOpenCalculator: (signal: TradeSignal) => void;
  isBookmarked: boolean;
  onToggleBookmark: (signalId: string) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  onInspectChart,
  onOpenCalculator,
  isBookmarked: _isBookmarked,
  onToggleBookmark: _onToggleBookmark,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isBuy = signal.direction.includes('BUY');
  const isStrong = signal.direction.startsWith('STRONG');

  // Format currency with appropriate precision
  const formatPrice = (val: number) => {
    if (val < 2) return `$${val.toFixed(5)}`;
    if (val < 500) return `$${val.toFixed(2)}`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCopySignal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `🎯 TRADESIGNAL ALERT: ${signal.symbol} (${signal.timeframe.toUpperCase()})
Direction: ${signal.direction}
Confidence: ${signal.confidenceScore}% (R:R 1:${signal.riskRewardRatio})

Entry: ${formatPrice(signal.entryPrice)}
Stop Loss: ${formatPrice(signal.stopLoss)}
Target 1 (TP1): ${formatPrice(signal.takeProfit1)}
Target 2 (TP2): ${formatPrice(signal.takeProfit2)}
Target 3 (TP3): ${signal.takeProfit3 ? formatPrice(signal.takeProfit3) : 'Open Run'}

Technical Rationale: ${signal.reasoning}
Generated via TradeSignal Pro Platform`;

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={`signal-card-${signal.id}`}
      className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl transition-all shadow-sm overflow-hidden flex flex-col"
    >
      {/* Top Banner: Symbol + Direction + Confidence */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-base sm:text-lg text-white font-mono">
                {signal.symbol}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {signal.timeframe.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400 font-medium truncate max-w-[120px] sm:max-w-none">
                {signal.name}
              </span>
            </div>
            {signal.chartPattern && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Layers className="w-3 h-3 text-slate-500 inline" />
                {signal.chartPattern}
              </span>
            )}
          </div>

          {/* Action Badge */}
          <div className="flex flex-col items-end gap-1">
            <span
              className={`px-3 py-1 rounded-md text-xs font-extrabold tracking-wide flex items-center gap-1 whitespace-nowrap shadow-sm ${
                isBuy
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              {isBuy ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {isStrong ? 'STRONG ' : ''}
              {isBuy ? 'BUY' : 'SELL'}
            </span>

            {/* Status Tag */}
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                signal.status === 'ACTIVE'
                  ? 'text-emerald-400'
                  : signal.status.includes('TP')
                  ? 'text-blue-400'
                  : 'text-amber-400'
              }`}
            >
              ● {signal.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Confidence & Risk-Reward Bar */}
        <div className="mt-3 flex items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Win Probability:</span>
            <span className="font-bold text-emerald-400 font-mono flex items-center gap-0.5">
              <Percent className="w-3 h-3 text-emerald-500" />
              {signal.confidenceScore}%
            </span>
          </div>
          <div className="h-3 w-px bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Risk / Reward:</span>
            <span className="font-bold text-white font-mono">1:{signal.riskRewardRatio}</span>
          </div>
          <div className="h-3 w-px bg-slate-800"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Live PnL:</span>
            <span
              className={`font-mono font-bold ${
                (signal.pnlPercentage ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {(signal.pnlPercentage ?? 0) >= 0 ? '+' : ''}
              {(signal.pnlPercentage ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Target & Stop Loss Levels Matrix */}
      <div className="p-4 sm:p-5 space-y-2.5 flex-1">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Entry Price */}
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Recommended Entry
            </div>
            <div className="font-mono text-sm font-semibold text-slate-100 mt-1">
              {formatPrice(signal.entryPrice)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-rose-950/40">
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              Stop Loss (SL)
            </div>
            <div className="font-mono text-sm font-semibold text-rose-300 mt-1">
              {formatPrice(signal.stopLoss)}
            </div>
          </div>
        </div>

        {/* Take Profit Levels */}
        <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
          <div className="text-[11px] text-slate-400 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1 text-emerald-400">
              <Target className="w-3 h-3" /> Take Profit Targets
            </span>
            <span className="text-[10px] text-slate-400">Current: {formatPrice(signal.currentPrice)}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div className="bg-slate-900 p-1.5 rounded text-center border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">TP 1</div>
              <div className="font-mono text-xs font-semibold text-emerald-400">{formatPrice(signal.takeProfit1)}</div>
            </div>
            <div className="bg-slate-900 p-1.5 rounded text-center border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">TP 2</div>
              <div className="font-mono text-xs font-semibold text-emerald-400">{formatPrice(signal.takeProfit2)}</div>
            </div>
            <div className="bg-slate-900 p-1.5 rounded text-center border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">TP 3</div>
              <div className="font-mono text-xs font-semibold text-emerald-400">{formatPrice(signal.takeProfit3 ?? signal.takeProfit2)}</div>
            </div>
          </div>
        </div>

        {/* Confluences Accordion toggle */}
        <div className="pt-1">
          <button
            id={`toggle-confluence-${signal.id}`}
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1"
          >
            <span>{(signal.confluences?.length ?? 0)} Technical Confluences & Setup Notes</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="mt-2 space-y-2 text-xs bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              <p className="text-slate-300 text-xs leading-relaxed italic border-b border-slate-800 pb-2">
                &ldquo;{signal.reasoning}&rdquo;
              </p>
              <div className="space-y-1.5 pt-1">
                {(signal.confluences ?? []).map((c, i) => (
                  <div key={i} className="flex items-start justify-between text-[11px] gap-2">
                    <span className="font-medium text-slate-300">{c.name}:</span>
                    <span className="text-slate-400 text-right font-mono">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          id={`inspect-chart-btn-${signal.id}`}
          type="button"
          onClick={() => onInspectChart(signal.symbol)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <LineChart className="w-3.5 h-3.5 text-blue-400" />
          <span>Chart View</span>
        </button>

        <button
          id={`calc-risk-btn-${signal.id}`}
          type="button"
          onClick={() => onOpenCalculator(signal)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <Calculator className="w-3.5 h-3.5 text-amber-400" />
          <span>Position Sizing</span>
        </button>

        <button
          id={`copy-signal-btn-${signal.id}`}
          type="button"
          onClick={handleCopySignal}
          title="Copy formatted signal alert"
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
