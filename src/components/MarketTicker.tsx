import React from 'react';
import { MarketAsset } from '../types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MarketTickerProps {
  assets: MarketAsset[];
  selectedSymbol: string;
  onSelectAsset: (symbol: string) => void;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({
  assets,
  selectedSymbol,
  onSelectAsset,
}) => {
  return (
    <div id="market-ticker-container" className="bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto scrollbar-none py-2 select-none">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3 whitespace-nowrap">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1 pr-2 flex items-center gap-1.5 border-r border-slate-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Markets
        </span>

        {assets.map((asset) => {
          const isSelected = selectedSymbol === asset.symbol;
          const isPositive = asset.change24h >= 0;

          return (
            <button
              key={asset.symbol}
              id={`ticker-item-${asset.symbol.replace('/', '-').toLowerCase()}`}
              type="button"
              onClick={() => onSelectAsset(asset.symbol)}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-all border ${
                isSelected
                  ? 'bg-slate-800 border-slate-700 text-white shadow-sm ring-1 ring-emerald-500/40'
                  : 'bg-slate-950/50 border-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <span className="font-semibold">{asset.symbol}</span>
              <span className="font-mono text-slate-200">
                ${asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.digits, maximumFractionDigits: asset.digits })}
              </span>
              <span
                className={`flex items-center text-[11px] font-mono font-medium ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5 inline" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />
                )}
                {isPositive ? '+' : ''}
                {(asset.change24h ?? 0).toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
