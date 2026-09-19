import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MarketAsset, TradeSignal, CandleData, Timeframe } from '../types';
import { generateCandleHistory } from '../utils/indicators';
import { 
  TrendingUp, 
  Layers, 
  Maximize2, 
  RefreshCw, 
  Activity,
  Eye,
  EyeOff
} from 'lucide-react';

interface CandleChartProps {
  assets: MarketAsset[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  activeSignal?: TradeSignal;
  onOpenCalculator: (signal: TradeSignal) => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  assets,
  selectedSymbol,
  onSelectSymbol,
  activeSignal,
  onOpenCalculator,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [subIndicator, setSubIndicator] = useState<'rsi' | 'macd' | 'none'>('rsi');
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);
  const chartHeight = 360;
  const subChartHeight = subIndicator !== 'none' ? 100 : 0;

  // Selected asset
  const currentAsset = useMemo(() => {
    return assets.find((a) => a.symbol === selectedSymbol) || assets[0] || {
      symbol: selectedSymbol || 'BTC/USDT',
      name: selectedSymbol || 'BTC/USDT',
      price: 60000,
      change24h: 0,
      high24h: 61000,
      low24h: 59000,
      volume24h: '0',
      assetClass: 'Crypto'
    };
  }, [assets, selectedSymbol]);

  // Generate or regenerate candles whenever symbol or timeframe changes
  const [candles, setCandles] = useState<CandleData[]>([]);

  useEffect(() => {
    if (!currentAsset || currentAsset.price <= 0) return;
    const minutes = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : 1440;
    const data = generateCandleHistory(currentAsset.price, 50, minutes);
    setCandles(data);
  }, [currentAsset.symbol, currentAsset.price, timeframe]);

  // Handle ResizeObserver to keep SVG responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setChartWidth(Math.max(400, Math.floor(entries[0].contentRect.width)));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute price bounds for SVG projection
  const { minPrice, maxPrice, minTime: _minTime, maxTime: _maxTime } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 1, minTime: 0, maxTime: 1 };
    let min = Infinity;
    let max = -Infinity;

    candles.forEach((c) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    });

    // Also include signal levels if active
    if (activeSignal && activeSignal.symbol === currentAsset.symbol) {
      min = Math.min(min, activeSignal.stopLoss, activeSignal.takeProfit1);
      max = Math.max(max, activeSignal.takeProfit3 ?? activeSignal.takeProfit2 ?? activeSignal.takeProfit1, activeSignal.takeProfit1);
    }

    const padding = (max - min) * 0.08 || 1;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      minTime: candles[0].time,
      maxTime: candles[candles.length - 1].time,
    };
  }, [candles, activeSignal, currentAsset]);

  // Transform functions for main chart
  const paddingRight = 75; // for price axis
  const paddingBottom = 24; // for time axis
  const innerWidth = Math.max(100, chartWidth - paddingRight);
  const innerHeight = Math.max(100, chartHeight - paddingBottom);

  const getY = (price: number) => {
    if (maxPrice === minPrice) return innerHeight / 2;
    return innerHeight - ((price - minPrice) / (maxPrice - minPrice)) * innerHeight;
  };

  const getX = (index: number) => {
    if (candles.length <= 1) return innerWidth / 2;
    return (index / (candles.length - 1)) * innerWidth;
  };

  // Max volume for scaling volume bars
  const maxVolume = useMemo(() => {
    return Math.max(...candles.map((c) => c.volume), 1000);
  }, [candles]);

  // Price grid lines
  const gridPriceTicks = useMemo(() => {
    const ticksCount = 6;
    const ticks: number[] = [];
    const step = (maxPrice - minPrice) / (ticksCount - 1);
    for (let i = 0; i < ticksCount; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  // Candle width
  const candleWidth = Math.max(3, Math.min(18, (innerWidth / candles.length) * 0.65));

  // Build SVG paths for EMAs
  const buildEmaPath = (key: 'ema20' | 'ema50' | 'ema200') => {
    let path = '';
    candles.forEach((c, i) => {
      const val = c[key];
      if (val !== undefined && val !== null) {
        const x = getX(i);
        const y = getY(val);
        path += path === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
    });
    return path;
  };

  // Handle Mouse move for Crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x <= innerWidth && y <= innerHeight) {
      setCrosshairPos({ x, y });
      // Find closest candle by index
      const ratio = Math.max(0, Math.min(1, x / innerWidth));
      const index = Math.round(ratio * (candles.length - 1));
      if (candles[index]) {
        setHoveredCandle(candles[index]);
      }
    }
  };

  const handleMouseLeave = () => {
    setCrosshairPos(null);
    setHoveredCandle(null);
  };

  // Active display candle: either hovered or latest
  const activeCandle = hoveredCandle || candles[candles.length - 1];

  const formatTickPrice = (p: number) => {
    if (p < 2) return p.toFixed(5);
    if (p < 500) return p.toFixed(2);
    return p.toLocaleString(undefined, { minimumFractionDigits: currentAsset.digits, maximumFractionDigits: currentAsset.digits });
  };

  return (
    <div id="candle-chart-studio" className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Chart Studio Header */}
      <div className="p-3 sm:p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
        {/* Symbol Selector & Price */}
        <div className="flex items-center gap-3">
          <select
            id="chart-symbol-select"
            value={selectedSymbol}
            onChange={(e) => onSelectSymbol(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} ({a.name})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-white">
              ${formatTickPrice(currentAsset.price)}
            </span>
            <span
              className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${
                (currentAsset.change24h ?? 0) >= 0 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
              }`}
            >
              {(currentAsset.change24h ?? 0) >= 0 ? '+' : ''}
              {(currentAsset.change24h ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              id={`chart-timeframe-${tf}`}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs">
            <button
              id="toggle-ema20-btn"
              type="button"
              onClick={() => setShowEma20(!showEma20)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                showEma20
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-400 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              EMA 20
            </button>
            <button
              id="toggle-ema50-btn"
              type="button"
              onClick={() => setShowEma50(!showEma50)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                showEma50
                  ? 'bg-cyan-950/40 border-cyan-600/50 text-cyan-400 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              EMA 50
            </button>
            <button
              id="toggle-ema200-btn"
              type="button"
              onClick={() => setShowEma200(!showEma200)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                showEma200
                  ? 'bg-purple-950/40 border-purple-600/50 text-purple-400 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              EMA 200
            </button>
          </div>

          {/* Sub-indicator Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 text-[10px]">Sub:</span>
            <button
              id="sub-rsi-btn"
              type="button"
              onClick={() => setSubIndicator(subIndicator === 'rsi' ? 'none' : 'rsi')}
              className={`px-1.5 py-0.5 rounded font-mono ${
                subIndicator === 'rsi' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400'
              }`}
            >
              RSI
            </button>
            <button
              id="sub-macd-btn"
              type="button"
              onClick={() => setSubIndicator(subIndicator === 'macd' ? 'none' : 'macd')}
              className={`px-1.5 py-0.5 rounded font-mono ${
                subIndicator === 'macd' ? 'bg-slate-800 text-blue-400 font-bold' : 'text-slate-400'
              }`}
            >
              MACD
            </button>
          </div>

          <button
            id="refresh-chart-data-btn"
            type="button"
            onClick={() => {
              const minutes = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : 1440;
              setCandles(generateCandleHistory(currentAsset.price, 50, minutes));
            }}
            title="Refresh candle data"
            className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Candlestick Crosshair / Stats Ribbon */}
      <div className="bg-slate-950 px-4 py-1.5 border-b border-slate-800/80 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {activeCandle && (
            <>
              <span>
                O: <strong className="text-slate-200">${formatTickPrice(activeCandle.open)}</strong>
              </span>
              <span>
                H: <strong className="text-emerald-400">${formatTickPrice(activeCandle.high)}</strong>
              </span>
              <span>
                L: <strong className="text-rose-400">${formatTickPrice(activeCandle.low)}</strong>
              </span>
              <span>
                C: <strong className="text-slate-200">${formatTickPrice(activeCandle.close)}</strong>
              </span>
              <span className="hidden sm:inline">
                Vol: <strong className="text-slate-300">{activeCandle.volume.toLocaleString()}</strong>
              </span>
            </>
          )}
        </div>

        {activeSignal && activeSignal.symbol === currentAsset.symbol && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" />
              Active Signal: {activeSignal.direction}
            </span>
            <button
              id="chart-quick-calc-btn"
              type="button"
              onClick={() => onOpenCalculator(activeSignal)}
              className="px-2 py-0.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded text-[10px] font-sans font-medium"
            >
              Risk Calc
            </button>
          </div>
        )}
      </div>

      {/* Main SVG Chart Area */}
      <div ref={containerRef} className="w-full relative select-none bg-slate-950/70">
        <svg
          id="candlestick-svg-stage"
          width={chartWidth}
          height={chartHeight}
          className="cursor-crosshair overflow-visible block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal Gridlines & Price Ticks */}
          {gridPriceTicks.map((p, i) => {
            const y = getY(p);
            return (
              <g key={i}>
                <line
                  x1={0}
                  y1={y}
                  x2={innerWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={innerWidth + 8}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {formatTickPrice(p)}
                </text>
              </g>
            );
          })}

          {/* Volume Bars */}
          {showVolume &&
            candles.map((c, i) => {
              const x = getX(i);
              const isUp = c.close >= c.open;
              const barHeight = (c.volume / maxVolume) * (innerHeight * 0.22);
              const y = innerHeight - barHeight;
              return (
                <rect
                  key={`vol-${i}`}
                  x={x - candleWidth / 2}
                  y={y}
                  width={candleWidth}
                  height={barHeight}
                  fill={isUp ? '#10b981' : '#f43f5e'}
                  opacity={0.18}
                />
              );
            })}

          {/* EMAs Curves */}
          {showEma20 && (
            <path
              d={buildEmaPath('ema20')}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
          {showEma50 && (
            <path
              d={buildEmaPath('ema50')}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
          {showEma200 && (
            <path
              d={buildEmaPath('ema200')}
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}

          {/* Candlesticks (Wicks and Bodies) */}
          {candles.map((c, i) => {
            const x = getX(i);
            const isUp = c.close >= c.open;
            const color = isUp ? '#10b981' : '#f43f5e';
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);
            const bodyY = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));

            return (
              <g key={`candle-${i}`}>
                {/* Wick */}
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Active Signal Visual Overlays (Entry, Stop Loss, Take Profits) */}
          {activeSignal && activeSignal.symbol === currentAsset.symbol && (
            <g id="chart-signal-overlays">
              {/* Entry Level */}
              {(() => {
                const y = getY(activeSignal.entryPrice);
                return (
                  <g>
                    <line
                      x1={0}
                      y1={y}
                      x2={innerWidth}
                      y2={y}
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="6 3"
                    />
                    <rect
                      x={innerWidth + 2}
                      y={y - 8}
                      width={68}
                      height={16}
                      fill="#0284c7"
                      rx="3"
                    />
                    <text
                      x={innerWidth + 5}
                      y={y + 4}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      ENTRY
                    </text>
                  </g>
                );
              })()}

              {/* Stop Loss Level */}
              {(() => {
                const y = getY(activeSignal.stopLoss);
                return (
                  <g>
                    <line
                      x1={0}
                      y1={y}
                      x2={innerWidth}
                      y2={y}
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={innerWidth + 2}
                      y={y - 8}
                      width={68}
                      height={16}
                      fill="#e11d48"
                      rx="3"
                    />
                    <text
                      x={innerWidth + 5}
                      y={y + 4}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      STOP LOSS
                    </text>
                  </g>
                );
              })()}

              {/* Take Profit 1 Level */}
              {(() => {
                const y = getY(activeSignal.takeProfit1);
                return (
                  <g>
                    <line
                      x1={0}
                      y1={y}
                      x2={innerWidth}
                      y2={y}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={innerWidth + 2}
                      y={y - 8}
                      width={68}
                      height={16}
                      fill="#059669"
                      rx="3"
                    />
                    <text
                      x={innerWidth + 5}
                      y={y + 4}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      TP1
                    </text>
                  </g>
                );
              })()}

              {/* Take Profit 2 Level */}
              {(() => {
                const y = getY(activeSignal.takeProfit2);
                return (
                  <g>
                    <line
                      x1={0}
                      y1={y}
                      x2={innerWidth}
                      y2={y}
                      stroke="#10b981"
                      strokeWidth="1.2"
                      strokeDasharray="2 4"
                    />
                    <rect
                      x={innerWidth + 2}
                      y={y - 8}
                      width={68}
                      height={16}
                      fill="#047857"
                      rx="3"
                    />
                    <text
                      x={innerWidth + 5}
                      y={y + 4}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      TP2
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Interactive Crosshair */}
          {crosshairPos && (
            <g id="chart-crosshair">
              {/* Vertical line */}
              <line
                x1={crosshairPos.x}
                y1={0}
                x2={crosshairPos.x}
                y2={innerHeight}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity={0.6}
              />
              {/* Horizontal line */}
              <line
                x1={0}
                y1={crosshairPos.y}
                x2={innerWidth}
                y2={crosshairPos.y}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity={0.6}
              />
            </g>
          )}

          {/* Time axis labels */}
          <line
            x1={0}
            y1={innerHeight}
            x2={innerWidth}
            y2={innerHeight}
            stroke="#334155"
            strokeWidth="1"
          />
          {candles.filter((_, i) => i % 10 === 0).map((c, i) => {
            const origIndex = i * 10;
            const x = getX(origIndex);
            const date = new Date(c.time);
            const timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            return (
              <text
                key={`time-${i}`}
                x={x}
                y={chartHeight - 6}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {timeLabel}
              </text>
            );
          })}
        </svg>

        {/* Sub-indicator SVG (RSI or MACD) */}
        {subIndicator !== 'none' && (
          <div className="border-t border-slate-800 bg-slate-950/90 pt-1">
            <div className="px-4 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>
                {subIndicator === 'rsi' ? (
                  <>RSI (14): <strong className="text-emerald-400 font-bold">{activeCandle?.rsi?.toFixed(1) || '50.0'}</strong></>
                ) : (
                  <>MACD (12, 26, 9): <strong className="text-blue-400">{activeCandle?.macd?.macd != null ? activeCandle.macd.macd.toFixed(2) : '0.00'}</strong></>
                )}
              </span>
              <span className="text-slate-500">Sub-Oscillator Panel</span>
            </div>

            <svg width={chartWidth} height={subChartHeight} className="block">
              {/* RSI visualization */}
              {subIndicator === 'rsi' && (
                <g>
                  {/* Overbought line at 70 */}
                  <line
                    x1={0}
                    y1={subChartHeight * 0.3}
                    x2={innerWidth}
                    y2={subChartHeight * 0.3}
                    stroke="#e11d48"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <text x={innerWidth + 6} y={subChartHeight * 0.3 + 3} fill="#e11d48" fontSize="8" fontFamily="monospace">
                    70 OB
                  </text>

                  {/* Oversold line at 30 */}
                  <line
                    x1={0}
                    y1={subChartHeight * 0.7}
                    x2={innerWidth}
                    y2={subChartHeight * 0.7}
                    stroke="#10b981"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <text x={innerWidth + 6} y={subChartHeight * 0.7 + 3} fill="#10b981" fontSize="8" fontFamily="monospace">
                    30 OS
                  </text>

                  {/* Midline at 50 */}
                  <line
                    x1={0}
                    y1={subChartHeight * 0.5}
                    x2={innerWidth}
                    y2={subChartHeight * 0.5}
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />

                  {/* RSI Curve */}
                  {(() => {
                    let path = '';
                    candles.forEach((c, i) => {
                      const rsi = c.rsi || 50;
                      const x = getX(i);
                      // Invert: 100 -> 0, 0 -> subChartHeight
                      const y = subChartHeight - (rsi / 100) * subChartHeight;
                      path += path === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
                    });
                    return <path d={path} fill="none" stroke="#34d399" strokeWidth="1.5" />;
                  })()}
                </g>
              )}

              {/* MACD visualization */}
              {subIndicator === 'macd' && (
                <g>
                  {/* Zero line */}
                  <line
                    x1={0}
                    y1={subChartHeight / 2}
                    x2={innerWidth}
                    y2={subChartHeight / 2}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  {/* Histogram bars */}
                  {candles.map((c, i) => {
                    const hist = c.macd?.histogram || 0;
                    const x = getX(i);
                    const isPositive = hist >= 0;
                    const h = Math.min(subChartHeight / 2, Math.abs(hist) * 2);
                    const y = isPositive ? subChartHeight / 2 - h : subChartHeight / 2;
                    return (
                      <rect
                        key={`macd-bar-${i}`}
                        x={x - 2}
                        y={y}
                        width={4}
                        height={Math.max(1, h)}
                        fill={isPositive ? '#10b981' : '#f43f5e'}
                        opacity={0.7}
                      />
                    );
                  })}
                </g>
              )}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
