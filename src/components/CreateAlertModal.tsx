import React, { useState } from 'react';
import { MarketAsset, Timeframe, TradeSignal } from '../types';
import { playSignalAlert } from '../utils/audio';
import { 
  X, 
  BellRing, 
  Volume2, 
  Check, 
  Zap, 
  CheckSquare, 
  Square 
} from 'lucide-react';

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: MarketAsset[];
  onAddNewSignal: (newSignal: TradeSignal) => void;
  audioEnabled: boolean;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  isOpen,
  onClose,
  assets,
  onAddNewSignal,
  audioEnabled,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [direction, setDirection] = useState<'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL'>('STRONG_BUY');
  const [triggers, setTriggers] = useState<string[]>([
    'RSI Oversold / Momentum Reset',
    '20/50 EMA Ribbon Separation',
    'Fair Value Gap (FVG) Retest',
  ]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentAsset = assets.find((a) => a.symbol === selectedSymbol) || assets[0];

  const availableTriggers = [
    'RSI Oversold / Momentum Reset',
    '20/50 EMA Ribbon Separation',
    'Fair Value Gap (FVG) Retest',
    'Institutional Order Block Mitigation',
    'Volume Profile Point of Control Breakout',
    'Liquidity Sweep & Wick Rejection',
  ];

  const toggleTrigger = (item: string) => {
    if (triggers.includes(item)) {
      setTriggers(triggers.filter((t) => t !== item));
    } else {
      setTriggers([...triggers, item]);
    }
  };

  const handleCreateAndSimulate = (triggerInstantSignal = false) => {
    if (audioEnabled) {
      playSignalAlert(direction.includes('BUY'));
    }

    if (triggerInstantSignal) {
      const price = currentAsset.price;
      const isBuy = direction.includes('BUY');
      const slDist = price * 0.008;
      const tp1Dist = price * 0.012;
      const tp2Dist = price * 0.024;
      const tp3Dist = price * 0.038;

      const createdSignal: TradeSignal = {
        id: `sig-custom-${Date.now()}`,
        symbol: currentAsset.symbol,
        name: currentAsset.name,
        assetClass: currentAsset.assetClass,
        direction,
        status: 'ACTIVE',
        timeframe,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
        currentPrice: price,
        entryPrice: price,
        stopLoss: isBuy ? price - slDist : price + slDist,
        takeProfit1: isBuy ? price + tp1Dist : price - tp1Dist,
        takeProfit2: isBuy ? price + tp2Dist : price - tp2Dist,
        takeProfit3: isBuy ? price + tp3Dist : price - tp3Dist,
        riskRewardRatio: 3.0,
        confidenceScore: 91,
        pnlPercentage: 0.05,
        reasoning: `Custom Alert Triggered: ${triggers.join(' + ')} with confirmed 15m volume expansion.`,
        chartPattern: 'Algorithmic Custom Breakout',
        confluences: triggers.map((t) => ({
          name: t.slice(0, 16),
          value: 'Confirmed Alert',
          status: isBuy ? 'bullish' : 'bearish',
          description: `Custom condition rule verified on ${timeframe} timeframe`,
        })),
      };

      onAddNewSignal(createdSignal);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div 
        id="create-alert-modal"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Create Custom Signal Alert Rule</h3>
              <p className="text-xs text-slate-400">Set indicator confluences and receive instant trade alerts</p>
            </div>
          </div>
          <button
            id="close-create-alert-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Asset Symbol */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Target Asset
            </label>
            <select
              id="alert-symbol-select"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} - {a.name} (${a.price.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe & Direction Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Timeframe
              </label>
              <select
                id="alert-timeframe-select"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="1m">1m (Ultra Scalp)</option>
                <option value="5m">5m (Micro Scalp)</option>
                <option value="15m">15m (Standard Scalp)</option>
                <option value="1h">1h (Intraday)</option>
                <option value="4h">4h (Swing)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Trigger Bias
              </label>
              <select
                id="alert-direction-select"
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="STRONG_BUY">Strong Buy / Long</option>
                <option value="BUY">Buy / Long</option>
                <option value="SELL">Sell / Short</option>
                <option value="STRONG_SELL">Strong Sell / Short</option>
              </select>
            </div>
          </div>

          {/* Confluence Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Confluence Conditions (Select Required Triggers)
            </label>
            <div className="space-y-2">
              {availableTriggers.map((item) => {
                const checked = triggers.includes(item);
                return (
                  <div
                    key={item}
                    onClick={() => toggleTrigger(item)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                      checked
                        ? 'bg-slate-950 border-emerald-500/40 text-slate-100'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    )}
                    <span>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            id="test-chime-btn"
            type="button"
            onClick={() => playSignalAlert(direction.includes('BUY'))}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-medium"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Sound</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="simulate-signal-now-btn"
              type="button"
              onClick={() => handleCreateAndSimulate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Trigger Live Signal Now</span>
            </button>

            <button
              id="save-alert-rule-btn"
              type="button"
              onClick={() => handleCreateAndSimulate(false)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              {savedSuccess ? <Check className="w-4 h-4" /> : null}
              <span>{savedSuccess ? 'Rule Active!' : 'Activate Alert'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
