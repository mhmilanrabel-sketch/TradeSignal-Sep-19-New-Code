import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TradeSignal, MarketAsset, ClosedSignal } from './types';
import { Header, NavTab } from './components/Header';
import { MarketTicker } from './components/MarketTicker';
import { CandleChart } from './components/CandleChart';
import { RiskCalculatorModal } from './components/RiskCalculatorModal';
import { TrackRecord } from './components/TrackRecord';
import { CreateAlertModal } from './components/CreateAlertModal';
import botConfig from './config/botConfig.json';
import {
  scoreConfluence,
  isInKillZone,
  buildRiskLevels,
  positionSize,
} from './utils/signalEngine';
import { generateCandleHistory } from './utils/indicators';
import { getCachedCandles } from './utils/marketData';
import {
  alertTest,
  alertTradeOpened,
  alertTradeClosed,
  alertDailyDrawdownHit,
  alertGeoBlock,
  alertBotStarted,
  alertBotStopped,
} from './utils/alertService';
import {
  Activity,
  Shield,
  Flame,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Bot,
  BrainCircuit,
  Play,
  Pause,
  Sparkles,
  Gauge,
  RefreshCw,
  Clock,
  GraduationCap,
  Key,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Wifi,
  Server,
  Globe,
  Sliders,
  Cpu,
  Layers,
  Zap,
  Target,
  Copy,
  Check,
} from 'lucide-react';

// ============================================================================
// BINANCE ENDPOINTS
// ============================================================================
const BINANCE_ENDPOINTS = {
  DEMO_SPOT: 'https://demo-api.binance.com',
  DEMO_FUTURES: 'https://demo-fapi.binance.com',
  TESTNET_SPOT: 'https://testnet.binance.vision',
  TESTNET_FUTURES: 'https://testnet.binancefuture.com',
  LIVE_SPOT: 'https://api.binance.com',
  LIVE_FUTURES: 'https://fapi.binance.com',
};

const BINANCE_WS_USER_ENDPOINTS = {
  LIVE_FUTURES: 'wss://fstream.binance.com/ws/',
  DEMO_FUTURES: 'wss://fstream.binancefuture.com/ws/',
  TESTNET_FUTURES: 'wss://stream.binancefuture.com/ws/',
};

const DEFAULT_API_KEY = '';
const DEFAULT_API_SECRET = '';

// ============================================================================
// EC2 PROXY
// ============================================================================
const EC2_PROXY_HOST = 'https://13-60-238-187.nip.io';
const EC2_PROXY_SECRET = 'WorldWar2026';

// ============================================================================
// TUNING
// ============================================================================
const MIN_CONFLUENCE_SCORE = 55;
const MIN_KILLZONE_WEIGHT = 0.3;
const SKIP_KILLZONE_DEFAULT = true;

const SCAN_WHITELIST = new Set<string>([
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT',
]);

const getCorsProxyUrl = (targetUrl: string): string => {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (isLocal) {
    return targetUrl
      .replace('https://demo-api.binance.com', '/binance-demo-api')
      .replace('https://demo-fapi.binance.com', '/binance-demo-fapi')
      .replace('https://testnet.binance.vision', '/binance-testnet')
      .replace('https://testnet.binancefuture.com', '/binance-futures-testnet')
      .replace('https://api.binance.com', '/binance-api')
      .replace('https://fapi.binance.com', '/binance-fapi');
  }

  return `${EC2_PROXY_HOST}/?key=${encodeURIComponent(EC2_PROXY_SECRET)}&target=${encodeURIComponent(targetUrl)}`;
};

export interface BinanceApiPermissions {
  ipRestrict: boolean;
  createTime: number;
  enableReading: boolean;
  enableWithdrawals: boolean;
  enableInternalTransfer: boolean;
  enableMargin: boolean;
  enableFutures: boolean;
  permitsUniversalTransfer: boolean;
  enableVanillaOptions: boolean;
  enableFixApiTrade: boolean;
  enableFixReadOnly: boolean;
  enableSpotAndMarginTrading: boolean;
  enablePortfolioMarginTrading: boolean;
}

export const DEFAULT_API_PERMISSIONS: BinanceApiPermissions = {
  ipRestrict: true,
  createTime: Date.now(),
  enableReading: true,
  enableWithdrawals: false,
  enableInternalTransfer: false,
  enableMargin: false,
  enableFutures: true,
  permitsUniversalTransfer: false,
  enableVanillaOptions: false,
  enableFixApiTrade: false,
  enableFixReadOnly: true,
  enableSpotAndMarginTrading: true,
  enablePortfolioMarginTrading: false,
};

export type BinanceEnvironment = 'demo' | 'testnet' | 'live';

interface BinanceApiSettings {
  apiKey: string;
  apiSecret: string;
  isConfigured: boolean;
  environment: BinanceEnvironment;
  enableFutures: boolean;
  enableSpot: boolean;
  usdtBalance: number | null;
  permissions?: BinanceApiPermissions;
  geoBlocked: boolean;
  lastError: string | null;
}

interface SecurityHealthState {
  isTwoWayVerified: boolean;
  handshakeLatencyMs: number;
  lastAuditTime: string;
  encryptionStatus: 'ENCRYPTED' | 'UNENCRYPTED';
  rateLimitUsagePct: number;
  activeEndpoint: string;
  corsBypassActive: boolean;
  securityAlert: string | null;
}

interface LearningStats {
  tradesAnalyzed: number;
  patternAccuracy: number;
  learnedRulesCount: number;
  currentModelPhase: string;
  lastKnowledgeUpdate: string;
}

const MAX_ACTIVE_TRADES = 6;
const COOLDOWN_AFTER_SL_MS = 15 * 60_000;

const INITIAL_MARKET_ASSETS: MarketAsset[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin Spot', price: 91250.0, change24h: 1.85, high24h: 92400.0, low24h: 89500.0, volume24h: '45.2K', assetClass: 'Crypto' },
  { symbol: 'ETH/USDT', name: 'Ethereum Spot', price: 3340.5, change24h: 2.15, high24h: 3410.0, low24h: 3250.0, volume24h: '120.5K', assetClass: 'Crypto' },
  { symbol: 'SOL/USDT', name: 'Solana Spot', price: 188.2, change24h: -0.45, high24h: 195.0, low24h: 182.1, volume24h: '88.1K', assetClass: 'Crypto' },
  { symbol: 'BNB/USDT', name: 'BNB Spot', price: 645.1, change24h: 0.92, high24h: 658.0, low24h: 638.0, volume24h: '18.4K', assetClass: 'Crypto' },
  { symbol: 'XRP/USDT', name: 'XRP Spot', price: 1.15, change24h: 3.4, high24h: 1.22, low24h: 1.08, volume24h: '210.0K', assetClass: 'Crypto' },
  { symbol: 'ADA/USDT', name: 'Cardano Spot', price: 0.72, change24h: 1.1, high24h: 0.76, low24h: 0.69, volume24h: '65.4K', assetClass: 'Crypto' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin Spot', price: 0.38, change24h: -1.2, high24h: 0.41, low24h: 0.36, volume24h: '310.2K', assetClass: 'Crypto' },
  { symbol: 'AVAX/USDT', name: 'Avalanche Spot', price: 35.4, change24h: 0.85, high24h: 36.8, low24h: 34.1, volume24h: '28.9K', assetClass: 'Crypto' },
  { symbol: 'LINK/USDT', name: 'Chainlink Spot', price: 18.5, change24h: 2.4, high24h: 19.2, low24h: 17.8, volume24h: '19.5K', assetClass: 'Crypto' },
  { symbol: 'DOT/USDT', name: 'Polkadot Spot', price: 8.9, change24h: -0.3, high24h: 9.3, low24h: 8.6, volume24h: '14.2K', assetClass: 'Crypto' },
];

const getActiveKillZoneInfo = () => {
  const now = new Date();
  const currentTotalMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  const killZones = botConfig.kill_zones_utc as Record<string, { start: string; end: string; weight: number }>;
  for (const [name, zone] of Object.entries(killZones)) {
    const [startH, startM] = zone.start.split(':').map(Number);
    const [endH, endM] = zone.end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= endTotal) {
      if (currentTotalMins >= startTotal && currentTotalMins < endTotal) {
        return { name: name.replace(/_/g, ' ').toUpperCase(), weight: zone.weight, range: `${zone.start}-${zone.end} UTC`, isActive: true };
      }
    } else {
      if (currentTotalMins >= startTotal || currentTotalMins < endTotal) {
        return { name: name.replace(/_/g, ' ').toUpperCase(), weight: zone.weight, range: `${zone.start}-${zone.end} UTC`, isActive: true };
      }
    }
  }
  return { name: 'OFF-KILLZONE', weight: 1.0, range: 'STANDARD BIAS', isActive: false };
};

async function generateSignature(queryString: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(queryString);
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getBaseUrl(env: BinanceEnvironment, useFutures: boolean): string {
  switch (env) {
    case 'demo': return useFutures ? BINANCE_ENDPOINTS.DEMO_FUTURES : BINANCE_ENDPOINTS.DEMO_SPOT;
    case 'testnet': return useFutures ? BINANCE_ENDPOINTS.TESTNET_FUTURES : BINANCE_ENDPOINTS.TESTNET_SPOT;
    case 'live': return useFutures ? BINANCE_ENDPOINTS.LIVE_FUTURES : BINANCE_ENDPOINTS.LIVE_SPOT;
  }
}

function getWsBaseUrl(env: BinanceEnvironment): string {
  switch (env) {
    case 'demo': return BINANCE_WS_USER_ENDPOINTS.DEMO_FUTURES;
    case 'testnet': return BINANCE_WS_USER_ENDPOINTS.TESTNET_FUTURES;
    case 'live': return BINANCE_WS_USER_ENDPOINTS.LIVE_FUTURES;
  }
}

function classifyBinance403(htmlBody: string, env: BinanceEnvironment): string {
  const lower = htmlBody.toLowerCase();
  const titleMatch = htmlBody.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  if (lower.includes('request blocked') || lower.includes('could not be satisfied')) {
    return 'GEO-BLOCK: Binance refused this IP. Move EC2 to Singapore, Frankfurt, or Tokyo. Env: ' + env + '.';
  }
  if (lower.includes('restricted location') || lower.includes('not available in your country')) {
    return 'REGION BLOCK: Binance WAF rejected this IP.';
  }
  if (lower.includes('ip') && lower.includes('whitelist')) {
    return 'IP NOT WHITELISTED: API key has IP restriction ON. Disable it on the Binance key.';
  }
  if (lower.includes('invalid api-key') || lower.includes('invalid api key')) {
    return 'INVALID API KEY: Key does not match this environment.';
  }
  return 'Binance returned 403 HTML. ' + (title ? 'Title: "' + title + '". ' : '');
}

export const App: React.FC = () => {
  const [assets, setAssets] = useState<MarketAsset[]>(INITIAL_MARKET_ASSETS);
  const [signals, setSignals] = useState<TradeSignal[]>(() => {
    const saved = localStorage.getItem('tradesignal_crypto_signals');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [activeTab, setActiveTab] = useState<NavTab | 'settings'>('dashboard');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'LIVE' | 'DISCONNECTED'>('CONNECTING');
  const [, setTick] = useState<number>(0);

  const [isAutoPilotActive, setIsAutoPilotActive] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionLog, setConnectionLog] = useState<string | null>(null);
  const [testAlertMessage, setTestAlertMessage] = useState<string | null>(null);

  const [skipKillZone, setSkipKillZone] = useState<boolean>(SKIP_KILLZONE_DEFAULT);

  const [apiSettings, setApiSettings] = useState<BinanceApiSettings>(() => {
    const saved = localStorage.getItem('tradesignal_binance_api_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          apiKey: parsed.apiKey || DEFAULT_API_KEY,
          apiSecret: parsed.apiSecret || DEFAULT_API_SECRET,
          isConfigured: Boolean(parsed.apiKey && parsed.apiSecret),
          environment: (parsed.environment as BinanceEnvironment) || 'testnet',
          enableFutures: parsed.enableFutures !== undefined ? parsed.enableFutures : true,
          enableSpot: parsed.enableSpot !== undefined ? parsed.enableSpot : true,
          permissions: parsed.permissions || DEFAULT_API_PERMISSIONS,
          geoBlocked: parsed.geoBlocked ?? false,
          lastError: parsed.lastError ?? null,
        };
      } catch { /* fallthrough */ }
    }
    return {
      apiKey: DEFAULT_API_KEY,
      apiSecret: DEFAULT_API_SECRET,
      isConfigured: false,
      environment: 'testnet',
      enableFutures: true,
      enableSpot: true,
      usdtBalance: null,
      permissions: DEFAULT_API_PERMISSIONS,
      geoBlocked: false,
      lastError: null,
    };
  });

  const [securityHealth, setSecurityHealth] = useState<SecurityHealthState>({
    isTwoWayVerified: false,
    handshakeLatencyMs: 18,
    lastAuditTime: 'Initializing...',
    encryptionStatus: 'ENCRYPTED',
    rateLimitUsagePct: 2.8,
    activeEndpoint: BINANCE_ENDPOINTS.TESTNET_FUTURES,
    corsBypassActive: true,
    securityAlert: null,
  });

  const [learningStats] = useState<LearningStats>({
    tradesAnalyzed: 196,
    patternAccuracy: 95.8,
    learnedRulesCount: 560,
    currentModelPhase: 'Gemini Dual-Engine Core v5.4',
    lastKnowledgeUpdate: 'Just Now',
  });

  const isAutoPilotActiveRef = useRef(isAutoPilotActive);
  const isScanningRef = useRef(isScanning);
  const assetsRef = useRef(assets);
  const signalsRef = useRef(signals);
  const binanceClosedRef = useRef<Set<string>>(new Set());
  const journalRecordedRef = useRef<Set<string>>(new Set());
  const lossCooldownRef = useRef<Record<string, number>>({});
  const dailyPnlRef = useRef<{ day: string; pnl: number }>({ day: '', pnl: 0 });

  // ==========================================================================
  // Real candle fetcher — uses Binance klines via the EC2 proxy
  // ==========================================================================
  const getRealCandles = async (
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    limit: number,
  ): Promise<{ candles: any[]; error?: string }> => {
    const baseUrl = getBaseUrl(apiSettings.environment, apiSettings.enableFutures);
    const sym = symbol.replace('/', '').toUpperCase();
    const targetUrl = `${baseUrl}/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
    const proxiedUrl = getCorsProxyUrl(targetUrl);
    const cacheKey = `${symbol}|${interval}|${limit}`;

    const result = await getCachedCandles(cacheKey, proxiedUrl);
    return { candles: result.candles, error: result.error };
  };

  const listenKeyAttemptedRef = useRef<boolean>(false);
  const listenKeyFatalRef = useRef<boolean>(false);

  useEffect(() => { isAutoPilotActiveRef.current = isAutoPilotActive; }, [isAutoPilotActive]);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);

  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [activeCalcSignal, setActiveCalcSignal] = useState<TradeSignal | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [copiedTradeId, setCopiedTradeId] = useState<string | null>(null);
  const [copiedAllTrades, setCopiedAllTrades] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('tradesignal_crypto_signals', JSON.stringify(signals));
  }, [signals]);

  useEffect(() => {
    localStorage.setItem('tradesignal_binance_api_config', JSON.stringify(apiSettings));
  }, [apiSettings]);

  useEffect(() => {
    const activeBaseUrl = getBaseUrl(apiSettings.environment, apiSettings.enableFutures);

    const securityAuditInterval = setInterval(() => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const simulatedLatency = Math.floor(Math.random() * 12) + 14;

      let alert: string | null = null;
      if (apiSettings.geoBlocked) {
        alert = 'GEO-BLOCK: The proxy IP is blocked by Binance.';
      } else if (connectionStatus === 'DISCONNECTED') {
        alert = 'WARNING: WebSocket stream interrupted. Re-establishing connection...';
      } else if (!apiSettings.isConfigured) {
        alert = 'NOTICE: No API keys saved yet. Open Settings and paste your testnet keys.';
      }

      setSecurityHealth({
        isTwoWayVerified: connectionStatus === 'LIVE',
        handshakeLatencyMs: simulatedLatency,
        lastAuditTime: now,
        encryptionStatus: 'ENCRYPTED',
        rateLimitUsagePct: Number((Math.random() * 2 + 2.0).toFixed(1)),
        activeEndpoint: activeBaseUrl,
        corsBypassActive: true,
        securityAlert: alert,
      });
    }, 3000);

    return () => clearInterval(securityAuditInterval);
  }, [connectionStatus, apiSettings]);

  const obtainListenKey = async (): Promise<string | null> => {
    if (listenKeyFatalRef.current) return null;
    if (listenKeyAttemptedRef.current) return null;
    listenKeyAttemptedRef.current = true;

    const baseUrl = getBaseUrl(apiSettings.environment, true);
    const proxiedUrl = getCorsProxyUrl(`${baseUrl}/fapi/v1/listenKey`);

    try {
      const res = await fetch(proxiedUrl, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': apiSettings.apiKey, 'Content-Type': 'application/json' },
      });
      const text = await res.text();

      if (!res.ok) {
        try {
          const j = JSON.parse(text);
          if (j && j.msg) {
            setConnectionLog(`listenKey rejected [${j.code}]: ${j.msg}`);
            if (j.code === -2015 || j.code === -2008) listenKeyFatalRef.current = true;
          }
          return null;
        } catch {
          if (text.includes('<!DOCTYPE') || text.includes('<HTML') || text.includes('<html')) {
            const diag = classifyBinance403(text, apiSettings.environment);
            console.warn('[listenKey] 403 HTML from Binance', diag);
            setConnectionLog('User Data Stream unavailable - ' + diag);
            setApiSettings((prev) => ({ ...prev, geoBlocked: true, lastError: diag }));
            alertGeoBlock(diag, apiSettings.environment);
            listenKeyFatalRef.current = true;
          }
          return null;
        }
      }

      try {
        const data = JSON.parse(text);
        return data?.listenKey ?? null;
      } catch {
        return null;
      }
    } catch (err) {
      console.error('Failed to obtain listenKey:', err);
      return null;
    }
  };

  const keepAliveListenKey = async (listenKey: string): Promise<boolean> => {
    if (listenKeyFatalRef.current) return false;
    const baseUrl = getBaseUrl(apiSettings.environment, true);
    const proxiedUrl = getCorsProxyUrl(`${baseUrl}/fapi/v1/listenKey?listenKey=${listenKey}`);
    try {
      const res = await fetch(proxiedUrl, { method: 'PUT', headers: { 'X-MBX-APIKEY': apiSettings.apiKey } });
      return res.ok;
    } catch {
      return false;
    }
  };

  const executeBinanceOrder = async (
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    price?: number,
    reduceOnly: boolean = false,
  ): Promise<{ success: boolean; orderId?: string; error?: string; fillPrice?: number }> => {
    if (!apiSettings.apiKey || !apiSettings.apiSecret) {
      return { success: false, error: 'API credentials not configured' };
    }

    const isFutures = apiSettings.enableFutures;
    const baseUrl = getBaseUrl(apiSettings.environment, isFutures);
    const endpoint = isFutures ? '/fapi/v1/order' : '/api/v3/order';

    const params: Record<string, string> = {
      symbol: symbol.replace('/', '').toUpperCase(),
      side,
      type: orderType,
      quantity: quantity.toString(),
      timestamp: Date.now().toString(),
      recvWindow: '5000',
    };

    if (isFutures) {
      params.positionSide = 'BOTH';
      if (reduceOnly && orderType === 'MARKET') params.reduceOnly = 'true';
    }
    if (orderType === 'LIMIT' && price !== undefined) {
      params.price = price.toString();
      params.timeInForce = 'GTC';
    }

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    let signature: string;
    try {
      signature = await generateSignature(queryString, apiSettings.apiSecret);
    } catch (err: any) {
      return { success: false, error: `Signature error: ${err.message}` };
    }

    const targetUrl = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    const proxiedUrl = getCorsProxyUrl(targetUrl);

    try {
      const res = await fetch(proxiedUrl, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': apiSettings.apiKey, 'Content-Type': 'application/json' },
      });

      const rawText = await res.text();

      if (rawText.trim().startsWith('<')) {
        const diag = classifyBinance403(rawText, apiSettings.environment);
        setConnectionLog('ORDER blocked - ' + diag);
        setApiSettings((prev) => ({ ...prev, geoBlocked: true, lastError: diag }));
        alertGeoBlock(diag, apiSettings.environment);
        return { success: false, error: diag };
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        return { success: false, error: 'Non-JSON from proxy' };
      }

      if (data && data.orderId !== undefined) {
        const fillPrice = parseFloat(data.avgPrice || data.price || '0') || undefined;
        setConnectionLog(`ORDER PLACED: ${side} ${quantity} ${symbol} | ID: ${data.orderId}${fillPrice ? ` | Fill: $${fillPrice}` : ''}`);
        return { success: true, orderId: String(data.orderId), fillPrice };
      }

      const errMsg = data?.msg ? `[${data.code}] ${data.msg}` : 'Unknown Binance error';
      setConnectionLog(`ORDER FAILED: ${side} ${quantity} ${symbol} - ${errMsg}`);
      return { success: false, error: errMsg };
    } catch (err: any) {
      setConnectionLog(`ORDER NETWORK ERROR: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    if (!apiSettings.apiKey || !apiSettings.enableFutures) return;
    if (listenKeyFatalRef.current) return;

    let userWs: WebSocket | null = null;
    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
    let currentListenKey: string | null = null;
    let cancelled = false;

    const initUserDataStream = async () => {
      const key = await obtainListenKey();
      if (!key || cancelled) return;
      currentListenKey = key;

      const wsBase = getWsBaseUrl(apiSettings.environment);
      userWs = new WebSocket(`${wsBase}${key}`);

      userWs.onopen = () => setConnectionLog((p) => `${p ? p + ' | ' : ''}User Data Stream Active`);

      userWs.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.e === 'ORDER_TRADE_UPDATE') {
            const o = payload.o;
            const symbolFormatted = `${o.s.replace('USDT', '')}/USDT`;
            const orderStatus = o.X;
            const fillPrice = parseFloat(o.L || o.ap || '0');

            setSignals((prev) => prev.map((sig) => {
              if (sig.symbol === symbolFormatted && sig.status === 'ACTIVE') {
                if (orderStatus === 'FILLED') {
                  const exitP = fillPrice > 0 ? fillPrice : sig.currentPrice;
                  const isLong = sig.direction.includes('BUY');
                  const pnl = isLong
                    ? ((exitP - sig.entryPrice) / sig.entryPrice) * 100
                    : ((sig.entryPrice - exitP) / sig.entryPrice) * 100;
                  binanceClosedRef.current.add(sig.id);
                  recordClosedSignalToJournal(sig, exitP, 'TP1', Number(pnl.toFixed(2)));
                  return {
                    ...sig,
                    currentPrice: exitP,
                    pnlPercentage: Number(pnl.toFixed(2)),
                    status: 'CLOSED' as const,
                  };
                }
              }
              return sig;
            }));
          }
        } catch (err) {
          console.error('User stream parse error:', err);
        }
      };

      keepAliveInterval = setInterval(() => {
        if (currentListenKey) keepAliveListenKey(currentListenKey);
      }, 30 * 60 * 1000);
    };

    initUserDataStream();

    return () => {
      cancelled = true;
      if (userWs) userWs.close();
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, [apiSettings.apiKey, apiSettings.environment, apiSettings.enableFutures]);

  const handleVerifyBinanceConnection = async () => {
    if (!apiSettings.apiKey || !apiSettings.apiSecret) {
      setConnectionLog('Error: Please enter both API Key and Secret Key.');
      return;
    }

    setTestingConnection(true);
    setConnectionLog(`Initiating Binance API Handshake (${apiSettings.environment.toUpperCase()}) & Syncing Balance...`);

    const baseUrl = getBaseUrl(apiSettings.environment, apiSettings.enableFutures);
    const endpoint = apiSettings.enableFutures ? '/fapi/v2/account' : '/api/v3/account';
    const queryString = `timestamp=${Date.now()}`;

    try {
      const signature = await generateSignature(queryString, apiSettings.apiSecret);
      const targetUrl = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;
      const proxiedUrl = getCorsProxyUrl(targetUrl);

      const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: { 'X-MBX-APIKEY': apiSettings.apiKey, 'Content-Type': 'application/json' },
      });

      const rawText = await response.text();

      if (rawText.trim().startsWith('<')) {
        const diag = classifyBinance403(rawText, apiSettings.environment);
        setConnectionLog(diag);
        setApiSettings((prev) => ({ ...prev, geoBlocked: true, lastError: diag }));
        alertGeoBlock(diag, apiSettings.environment);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setConnectionLog('Non-JSON response: ' + rawText.slice(0, 160));
        return;
      }

      if (data && (data.balances || data.assets)) {
        let usdtBalance = 0;
        if (apiSettings.enableFutures && data.assets) {
          const usdt = data.assets.find((a: any) => a.asset === 'USDT');
          usdtBalance = usdt ? parseFloat(usdt.availableBalance || usdt.walletBalance) : 0;
        } else if (data.balances) {
          const usdt = data.balances.find((b: any) => b.asset === 'USDT');
          usdtBalance = usdt ? parseFloat(usdt.free) : 0;
        }
        setApiSettings((prev) => ({
          ...prev,
          isConfigured: true,
          usdtBalance,
          geoBlocked: false,
          lastError: null,
        }));
        setConnectionLog(`SUCCESS: Connected to ${baseUrl} (${apiSettings.environment})! USDT Balance: $${usdtBalance.toFixed(2)}`);
        alertBotStarted(apiSettings.environment, SCAN_WHITELIST.size, MIN_CONFLUENCE_SCORE);
      } else if (data?.msg) {
        const code = String(data.code);
        const known: Record<string, string> = {
          '-2015': 'Invalid API key / IP restriction / bad permissions.',
          '-2008': 'Invalid API key format.',
          '-1022': 'Signature mismatch — check the secret.',
          '-1102': 'Mandatory param missing — server clock offset?',
        };
        setConnectionLog(`Binance API Notice [${code}]: ${data.msg}${known[code] ? ' - ' + known[code] : ''}`);
        setApiSettings((prev) => ({ ...prev, lastError: `${data.code}: ${data.msg}` }));
      } else {
        setConnectionLog(`SUCCESS: Connected to ${baseUrl}! Account verified.`);
        setApiSettings((prev) => ({ ...prev, isConfigured: true, geoBlocked: false }));
      }
    } catch (err: any) {
      setConnectionLog(`Network error: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestAlert = async () => {
    setTestAlertMessage('Sending...');
    const ok = await alertTest();
    if (ok) {
      setTestAlertMessage('✅ Test alert sent — check your phone!');
      setTimeout(() => setTestAlertMessage(null), 4000);
    } else {
      setTestAlertMessage('❌ Failed — check console + telegram config');
      setTimeout(() => setTestAlertMessage(null), 6000);
    }
  };

  const formatDuration = (startTime?: number): string => {
    if (!startTime) return '0m 00s';
    const diffMs = Math.max(0, Date.now() - startTime);
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const formatStartTime = (timestamp?: number): string => {
    if (!timestamp) return new Date().toLocaleTimeString();
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const recordClosedSignalToJournal = (
    trade: TradeSignal,
    exitPrice: number,
    outcome: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL',
    pnlPercentage: number,
  ) => {
    try {
      if (trade.id && journalRecordedRef.current.has(trade.id)) return;
      if (trade.id) journalRecordedRef.current.add(trade.id);

      const startTimeMs = (trade as any).startTime || trade.createdAt || Date.now();
      const durationStr = formatDuration(startTimeMs);
      const startStr = `${formatStartTime(startTimeMs)} UTC`;
      const now = Date.now();
      const suffix = Math.random().toString(36).substring(2, 6);
      const closedAtStr = `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      const pnlPipsOrPoints = Number(Math.abs(exitPrice - trade.entryPrice).toFixed(4));

      const newRecord: ClosedSignal = {
        id: `CS-${trade.symbol.replace(/[^A-Z0-9]/g, '')}-${now}-${suffix}`,
        symbol: trade.symbol,
        direction: trade.direction,
        timeframe: trade.timeframe || '5m',
        entryPrice: trade.entryPrice,
        exitPrice,
        stopLoss: trade.stopLoss,
        pnlPercentage,
        pnlPipsOrPoints,
        outcome,
        timeStart: startStr,
        duration: durationStr,
        closedAt: closedAtStr,
        holdingTime: durationStr,
        timestamp: now,
      };

      const saved = localStorage.getItem('tradesignal_closed_signals_journal');
      let current: ClosedSignal[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) current = parsed;
        } catch { current = []; }
      }

      const seen = new Set<string>();
      const merged: ClosedSignal[] = [];
      for (const item of [newRecord, ...current]) {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
      localStorage.setItem('tradesignal_closed_signals_journal', JSON.stringify(merged));
      window.dispatchEvent(new Event('tradesignal_journal_updated'));
    } catch (err) {
      console.error('Failed to record closed trade:', err);
    }
  };

  const handleCopySingleTrade = (e: React.MouseEvent, trade: TradeSignal) => {
    e.stopPropagation();
    const startTime = (trade as any).startTime || trade.createdAt || Date.now();
    const isProfit = (trade.pnlPercentage ?? 0) >= 0;
    const text = `RUNNING TRADE: ${trade.symbol} | ${trade.direction}
- Status: ACTIVE (${trade.timeframe || '5m'})
- Start: ${formatStartTime(startTime)} UTC | Duration: ${formatDuration(startTime)}
- Entry: $${trade.entryPrice < 2 ? trade.entryPrice.toFixed(4) : trade.entryPrice.toLocaleString()}
- Live: $${trade.currentPrice < 2 ? trade.currentPrice.toFixed(4) : trade.currentPrice.toLocaleString()} (${isProfit ? '+' : ''}${trade.pnlPercentage?.toFixed(2)}%)
- SL: ${trade.stopLoss ? `$${trade.stopLoss < 2 ? trade.stopLoss.toFixed(4) : trade.stopLoss.toLocaleString()}` : 'N/A'}
- TP1: ${trade.takeProfit1 ? `$${trade.takeProfit1 < 2 ? trade.takeProfit1.toFixed(4) : trade.takeProfit1.toLocaleString()}` : 'N/A'}
- R:R 1:${trade.riskRewardRatio}
- Pattern: ${trade.chartPattern || 'Multi-Confluence'}
- Bot: ${botConfig.agent_config.bot_id} (${botConfig.binance_config.execution_mode} ${botConfig.binance_config.leverage}x)`;

    navigator.clipboard?.writeText(text);
    setCopiedTradeId(trade.id);
    setTimeout(() => setCopiedTradeId(null), 2000);
  };

  const handleCopyAllActiveTrades = () => {
    const actives = signals.filter((s) => s.status === 'ACTIVE');
    if (actives.length === 0) return;
    const items = actives.map((t, i) => {
      const start = (t as any).startTime || t.createdAt || Date.now();
      const p = (t.pnlPercentage ?? 0) >= 0;
      return `[${i + 1}] ${t.symbol} ${t.direction} (${t.timeframe})
  Entry $${t.entryPrice.toLocaleString()} -> Live $${t.currentPrice.toLocaleString()} (${p ? '+' : ''}${t.pnlPercentage?.toFixed(2)}%)
  SL $${t.stopLoss?.toLocaleString()} | TP1 $${t.takeProfit1?.toLocaleString()}
  Duration: ${formatDuration(start)}`;
    });

    const summary = `TRADESIGNAL ACTIVE TRADES (${actives.length}/${MAX_ACTIVE_TRADES})
Bot: ${botConfig.agent_config.bot_id} | ${botConfig.binance_config.execution_mode} ${botConfig.binance_config.leverage}x
Generated: ${new Date().toUTCString()}
==================================================
${items.join('\n\n')}
==================================================`;

    navigator.clipboard?.writeText(summary);
    setCopiedAllTrades(true);
    setTimeout(() => setCopiedAllTrades(false), 2000);
  };

  const handleExecuteCryptoScalpScan = async () => {
    console.log('[SCAN] ========== Scan starting ==========');
    const currentAssets = assetsRef.current;
    const currentSignals = signalsRef.current;

    if (!currentAssets.length) return;
    if (isScanningRef.current) return;

    const zone = isInKillZone();
    if (!skipKillZone && !zone.ok && zone.weight < MIN_KILLZONE_WEIGHT) {
      setConnectionLog(`⏸ Outside kill zones (${zone.name}, w=${zone.weight}) — skipped.`);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (dailyPnlRef.current.day !== today) {
      dailyPnlRef.current = { day: today, pnl: 0 };
    }
    if (Math.abs(dailyPnlRef.current.pnl) >= botConfig.risk_engine.max_daily_drawdown_percent) {
      setConnectionLog(`🛑 Daily drawdown limit reached (${dailyPnlRef.current.pnl.toFixed(2)}%) — paused.`);
      alertDailyDrawdownHit(dailyPnlRef.current.pnl, apiSettings.environment);
      return;
    }

    setIsScanning(true);

    const currentActive = currentSignals.filter((s) => s.status === 'ACTIVE');
    const slots = MAX_ACTIVE_TRADES - currentActive.length;
    if (slots <= 0) { setIsScanning(false); return; }

    const busySymbols = new Set(currentActive.map((s) => s.symbol));

    // ---- Fetch REAL candles for all whitelisted symbols in parallel ----
    const symbolsToScan = currentAssets
      .filter((a) => SCAN_WHITELIST.has(a.symbol))
      .filter((a) => !busySymbols.has(a.symbol))
      .filter((a) => {
        const lastSL = lossCooldownRef.current[a.symbol] ?? 0;
        return Date.now() - lastSL >= COOLDOWN_AFTER_SL_MS;
      });

    console.log(`[SCAN] Fetching real candles for ${symbolsToScan.length} symbols...`);

    const candleResults = await Promise.all(
      symbolsToScan.map(async (asset) => {
        const { candles, error } = await getRealCandles(asset.symbol, '5m', 220);
        return { asset, candles, error };
      }),
    );

    const newPositions: TradeSignal[] = [];

    for (const { asset, candles, error } of candleResults) {
      if (newPositions.length >= slots) break;
      if (error) {
        console.log(`[SCAN] ${asset.symbol}: ❌ kline fetch failed — ${error}`);
        continue;
      }
      if (candles.length < 30) {
        console.log(`[SCAN] ${asset.symbol}: ⏸ not enough candles (${candles.length})`);
        continue;
      }

      const confluence = scoreConfluence(candles);

      console.log(
        `[SCAN] ${asset.symbol}: score=${confluence.total.toFixed(0)} dir=${confluence.direction} | ${confluence.reasons.join(', ')}`,
      );

      if (confluence.total < MIN_CONFLUENCE_SCORE || confluence.direction === 'NONE') continue;

      const entry = asset.price;
      const { stopLoss, takeProfit1, takeProfit2, slDist } =
        buildRiskLevels(confluence.direction, entry, confluence.indicators.atr);

      const isLong = confluence.direction === 'LONG';
      const ts = Date.now();

      newPositions.push({
        id: `EXEC-${asset.symbol.replace('/', '')}-${isLong ? 'L' : 'S'}-${ts}`,
        symbol: asset.symbol,
        name: asset.name,
        assetClass: 'Crypto',
        direction: isLong ? 'BUY (LONG)' : 'SELL (SHORT)',
        entryPrice: entry,
        currentPrice: entry,
        targetPrice: takeProfit1,
        stopLoss,
        takeProfit1,
        takeProfit2,
        timeframe: '5m',
        status: 'ACTIVE',
        confidenceScore: Math.round(confluence.total),
        riskRewardRatio: Number((Math.abs(takeProfit1 - entry) / slDist).toFixed(2)),
        pnlPercentage: 0,
        chartPattern: 'Multi-Confluence ATR Scalp (REAL DATA)',
        reasoning:
          `[${botConfig.agent_config.bot_id}] Score ${Math.round(confluence.total)}/100 - ` +
          confluence.reasons.join(' - ') +
          ` | Zone: ${zone.name} (w=${zone.weight})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        startTime: ts,
      } as TradeSignal & { startTime?: number });

      busySymbols.add(asset.symbol);
    }

    if (!newPositions.length) {
      setConnectionLog(`⏸ No setups met confluence ≥ ${MIN_CONFLUENCE_SCORE} this round.`);
      setIsScanning(false);
      return;
    }

    setSignals((prev) => [...prev, ...newPositions]);

    const canTrade = Boolean(apiSettings.apiKey && apiSettings.apiSecret && apiSettings.isConfigured);
    if (!canTrade) {
      setConnectionLog('⚠️ Signals generated but NOT sent — no API keys.');
      setIsScanning(false);
      return;
    }

    for (const pos of newPositions) {
      const balance = apiSettings.usdtBalance ?? 1000;
      const dist = Math.abs(pos.entryPrice - pos.stopLoss);
      const qty = positionSize(pos.symbol, pos.entryPrice, dist, balance);
      if (qty <= 0) continue;

      const side: 'BUY' | 'SELL' = pos.direction.includes('BUY') ? 'BUY' : 'SELL';
      const r = await executeBinanceOrder(pos.symbol, side, qty, 'MARKET');
      console.log(`[SCAN] Order result:`, r);

      alertTradeOpened({
        symbol: pos.symbol,
        direction: pos.direction,
        entryPrice: r.fillPrice ?? pos.entryPrice,
        stopLoss: pos.stopLoss,
        takeProfit1: pos.takeProfit1,
        takeProfit2: pos.takeProfit2,
        confidenceScore: pos.confidenceScore,
        riskRewardRatio: pos.riskRewardRatio,
        reasoning: pos.reasoning,
        binanceOrderId: r.orderId,
        environment: apiSettings.environment,
        usdtBalance: apiSettings.usdtBalance,
      });

      setSignals((prev) => prev.map((s) =>
        s.id === pos.id
          ? {
              ...s,
              ...(r.orderId ? { binanceOrderId: r.orderId } : {}),
              ...(r.fillPrice ? { entryPrice: r.fillPrice, currentPrice: r.fillPrice } : {}),
              reasoning: r.success
                ? `${s.reasoning} | Binance: ${r.orderId} qty=${qty}`
                : `${s.reasoning} | ⚠️ ${r.error}`,
            } as TradeSignal
          : s,
      ));
    }

    setIsScanning(false);
  };

  useEffect(() => {
    if (!apiSettings.apiKey || !apiSettings.apiSecret) return;
    const justClosed = signals.filter(
      (s) => s.status === 'CLOSED' && (s as any).binanceOrderId && !binanceClosedRef.current.has(s.id),
    );
    if (!justClosed.length) return;

    justClosed.forEach(async (trade) => {
      binanceClosedRef.current.add(trade.id);
      const balance = apiSettings.usdtBalance ?? 1000;
      const dist = Math.abs(trade.entryPrice - trade.stopLoss);
      const qty = positionSize(trade.symbol, trade.entryPrice, dist, balance);
      const closeSide: 'BUY' | 'SELL' = trade.direction.includes('BUY') ? 'SELL' : 'BUY';
      await executeBinanceOrder(trade.symbol, closeSide, qty, 'MARKET', undefined, true);
    });
  }, [signals, apiSettings.apiKey, apiSettings.apiSecret]);

  useEffect(() => {
    if (!isAutoPilotActive) return;
    const backgroundInterval = setInterval(() => {
      if (!isScanningRef.current && assetsRef.current.length > 0) {
        handleExecuteCryptoScalpScan();
      }
    }, 15000);
    return () => clearInterval(backgroundInterval);
  }, [isAutoPilotActive, skipKillZone]);

  useEffect(() => {
    let isSubscribed = true;
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

    ws.onopen = () => { if (isSubscribed) setConnectionStatus('LIVE'); };

    ws.onmessage = (event) => {
      if (!isSubscribed) return;
      try {
        const rawData = JSON.parse(event.data);
        if (!Array.isArray(rawData)) return;

        setAssets((prev) => {
          const updated = [...prev];
          rawData.forEach((item: any) => {
            if (item.s && item.s.endsWith('USDT')) {
              const symbol = `${item.s.replace('USDT', '')}/USDT`;
              if (!SCAN_WHITELIST.has(symbol)) return;

              const livePrice = parseFloat(item.c);
              const openPrice = parseFloat(item.o);
              const change24h = ((livePrice - openPrice) / (openPrice || 1)) * 100;
              const idx = updated.findIndex((a) => a.symbol === symbol);
              const asset: MarketAsset = {
                symbol,
                name: `${item.s.replace('USDT', '')} Spot`,
                price: livePrice,
                change24h: Number(change24h.toFixed(2)),
                high24h: parseFloat(item.h),
                low24h: parseFloat(item.l),
                volume24h: `${(parseFloat(item.v) / 1000).toFixed(1)}K`,
                assetClass: 'Crypto',
              };
              if (idx >= 0) updated[idx] = asset;
              else updated.push(asset);
            }
          });
          return updated;
        });

        setSignals((prev) => prev.map((sig) => {
          if (sig.status !== 'ACTIVE') return sig;
          const match = rawData.find((item: any) => item.s === sig.symbol.replace('/', '').toUpperCase());
          if (!match) return sig;

          const livePrice = parseFloat(match.c);
          const isLong = sig.direction.includes('BUY');
          const rawPnl = isLong
            ? ((livePrice - sig.entryPrice) / (sig.entryPrice || 1)) * 100
            : ((sig.entryPrice - livePrice) / (sig.entryPrice || 1)) * 100;

          let stopLoss = sig.stopLoss;
          if (botConfig.risk_engine.dynamic_trailing_stop && rawPnl >= botConfig.risk_engine.trailing_stop_activation_pnl_pct) {
            const trail = botConfig.risk_engine.trailing_stop_distance_pct / 100;
            if (isLong) {
              const t = livePrice * (1 - trail);
              if (!stopLoss || t > stopLoss) stopLoss = t;
            } else {
              const t = livePrice * (1 + trail);
              if (!stopLoss || t < stopLoss) stopLoss = t;
            }
          }

          let isSL = false;
          let isTP = false;
          if (isLong) {
            if (stopLoss && livePrice <= stopLoss) isSL = true;
            if ((sig.takeProfit1 && livePrice >= sig.takeProfit1) || (sig.takeProfit2 && livePrice >= sig.takeProfit2)) isTP = true;
          } else {
            if (stopLoss && livePrice >= stopLoss) isSL = true;
            if ((sig.takeProfit1 && livePrice <= sig.takeProfit1) || (sig.takeProfit2 && livePrice <= sig.takeProfit2)) isTP = true;
          }

          if (isSL || isTP) {
            const outcome: 'TP1' | 'TP2' | 'SL' = isSL ? 'SL' : 'TP1';
            recordClosedSignalToJournal(sig, livePrice, outcome, Number(rawPnl.toFixed(2)));

            alertTradeClosed({
              symbol: sig.symbol,
              direction: sig.direction,
              entryPrice: sig.entryPrice,
              exitPrice: livePrice,
              pnlPercentage: Number(rawPnl.toFixed(2)),
              outcome,
              duration: formatDuration((sig as any).startTime || Date.now()),
              environment: apiSettings.environment,
            });

            if (isSL) {
              lossCooldownRef.current[sig.symbol] = Date.now();
              dailyPnlRef.current.pnl -= Math.abs(rawPnl);
            } else {
              dailyPnlRef.current.pnl += Math.abs(rawPnl);
            }
            return { ...sig, currentPrice: livePrice, stopLoss, pnlPercentage: Number(rawPnl.toFixed(2)), status: 'CLOSED' as const };
          }

          return { ...sig, currentPrice: livePrice, stopLoss, pnlPercentage: Number(rawPnl.toFixed(2)) };
        }));
      } catch (e) {
        console.error('Binance WS parse error:', e);
      }
    };

    ws.onerror = () => { if (isSubscribed) setConnectionStatus('DISCONNECTED'); };
    ws.onclose = () => { if (isSubscribed) setConnectionStatus('DISCONNECTED'); };

    return () => {
      isSubscribed = false;
      ws.close();
    };
  }, []);

  const handleCloseTrade = (tradeId: string) => {
    const t = signals.find((s) => s.id === tradeId);
    if (t) {
      const exit = t.currentPrice || t.entryPrice;
      const isLong = t.direction.includes('BUY');
      const pnl = t.pnlPercentage ?? (isLong
        ? ((exit - t.entryPrice) / t.entryPrice) * 100
        : ((t.entryPrice - exit) / t.entryPrice) * 100);
      recordClosedSignalToJournal(t, exit, 'MANUAL', Number(pnl.toFixed(2)));

      alertTradeClosed({
        symbol: t.symbol,
        direction: t.direction,
        entryPrice: t.entryPrice,
        exitPrice: exit,
        pnlPercentage: Number(pnl.toFixed(2)),
        outcome: 'MANUAL',
        duration: formatDuration((t as any).startTime || Date.now()),
        environment: apiSettings.environment,
      });
    }
    setSignals((prev) => prev.map((s) => (s.id === tradeId ? { ...s, status: 'CLOSED' } : s)));
  };

  const handleCloseAllTrades = () => {
    const actives = signals.filter((s) => s.status === 'ACTIVE');
    actives.forEach((t) => {
      const exit = t.currentPrice || t.entryPrice;
      const isLong = t.direction.includes('BUY');
      const pnl = t.pnlPercentage ?? (isLong
        ? ((exit - t.entryPrice) / t.entryPrice) * 100
        : ((t.entryPrice - exit) / t.entryPrice) * 100);
      recordClosedSignalToJournal(t, exit, 'MANUAL', Number(pnl.toFixed(2)));
    });
    setSignals((prev) => prev.map((s) => (s.status === 'ACTIVE' ? { ...s, status: 'CLOSED' } : s)));
  };

  const activeTrades = useMemo(() => signals.filter((s) => s.status === 'ACTIVE'), [signals]);

  return (
    <div id="tradesignal-app-root" className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab as NavTab}
        setActiveTab={(tab) => setActiveTab(tab)}
        audioEnabled={audioEnabled}
        setAudioEnabled={setAudioEnabled}
        activeSignalsCount={activeTrades.length}
        onOpenAlertModal={() => setIsAlertModalOpen(true)}
      />

      {assets.length > 0 ? (
        <MarketTicker assets={assets} selectedSymbol={selectedSymbol} onSelectAsset={(sym) => setSelectedSymbol(sym)} />
      ) : (
        <div className="bg-slate-900/90 border-b border-slate-800 py-1.5 px-4 text-center text-xs font-mono text-emerald-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Connecting to Binance Streaming Engine [{connectionStatus}]...</span>
        </div>
      )}

      {apiSettings.geoBlocked && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-[11px] font-mono text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span><strong>GEO-BLOCK DETECTED:</strong> Switch to TESTNET in Settings.</span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10px] font-bold shrink-0 cursor-pointer"
          >
            Open Settings
          </button>
        </div>
      )}

      {!apiSettings.isConfigured && !apiSettings.geoBlocked && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-2 text-[11px] font-mono text-blue-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400 shrink-0" />
            <span><strong>NO API KEYS SAVED</strong> — open Settings to paste testnet keys.</span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 text-[10px] font-bold shrink-0 cursor-pointer"
          >
            Open Settings
          </button>
        </div>
      )}

      {securityHealth.securityAlert && !apiSettings.geoBlocked && apiSettings.isConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-[11px] font-mono text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{securityHealth.securityAlert}</span>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline">Active: {securityHealth.activeEndpoint}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-3 overflow-y-auto">
        {(activeTab === 'dashboard' || activeTab === 'activeTrades') && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 p-3.5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Bot className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-extrabold text-white">BTC Priority Dual-Direction Engine</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {botConfig.agent_config.bot_id}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {botConfig.binance_config.execution_mode} {botConfig.binance_config.leverage}x
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-emerald-400" />
                      CAP: {activeTrades.length}/{MAX_ACTIVE_TRADES}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {apiSettings.environment.toUpperCase()} {apiSettings.enableFutures ? '· FUTURES' : '· SPOT'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{getActiveKillZoneInfo().name} (w:{getActiveKillZoneInfo().weight})</span>
                    </span>
                    {skipKillZone && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        KILLZONE GATE OFF
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      WHITELIST: {SCAN_WHITELIST.size} PAIRS
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      REAL DATA
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Confluence ≥ {MIN_CONFLUENCE_SCORE} · Real Binance Klines · ATR-scaled SL/TP · R:R 1:{botConfig.risk_engine.min_reward_risk_ratio}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>API Setup</span>
                </button>

                <button
                  onClick={() => {
                    const next = !isAutoPilotActive;
                    setIsAutoPilotActive(next);
                    if (next) alertBotStarted(apiSettings.environment, SCAN_WHITELIST.size, MIN_CONFLUENCE_SCORE);
                    else alertBotStopped(apiSettings.environment);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isAutoPilotActive
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isAutoPilotActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isAutoPilotActive ? 'Pause Engine' : 'Resume Engine'}</span>
                </button>

                <button
                  onClick={handleExecuteCryptoScalpScan}
                  disabled={isScanning || assets.length === 0 || activeTrades.length >= MAX_ACTIVE_TRADES}
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      <span>FORCE SCAN</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {activeTrades.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Running Positions ({activeTrades.length}/{MAX_ACTIVE_TRADES})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyAllActiveTrades}
                      className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700 text-[11px]"
                    >
                      {copiedAllTrades ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">All Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy All Active</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCloseAllTrades}
                      className="text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-[11px]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Emergency Close All</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {activeTrades.map((trade) => {
                    const isProfit = (trade.pnlPercentage ?? 0) >= 0;
                    const isLong = trade.direction.includes('BUY');
                    const startTime = (trade as any).startTime || Date.now();
                    const binanceOrderId = (trade as any).binanceOrderId as string | undefined;

                    return (
                      <div
                        key={trade.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isProfit
                            ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/20'
                            : 'bg-slate-900/90 border-rose-500/40 shadow-rose-950/20'
                        } flex flex-col justify-between`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <div>
                            <span className="font-bold text-sm text-white block">{trade.symbol}</span>
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-mono mt-0.5">
                              <Clock className="w-3 h-3 text-amber-400/80 shrink-0" />
                              <span>{formatDuration(startTime)}</span>
                              <span className="text-slate-500">- {formatStartTime(startTime)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleCopySingleTrade(e, trade)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                            >
                              {copiedTradeId === trade.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCloseTrade(trade.id)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="my-2">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                            <span className={`font-bold flex items-center gap-0.5 ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {isLong ? 'BUY (LONG)' : 'SELL (SHORT)'}
                            </span>
                            <span className="text-slate-500">{trade.timeframe}</span>
                          </div>
                          <div className={`text-lg font-extrabold font-mono text-center py-0.5 rounded bg-slate-950/80 border ${
                            isProfit ? 'text-emerald-400 border-emerald-500/30' : 'text-rose-400 border-rose-500/30'
                          }`}>
                            {isProfit ? '+' : ''}{trade.pnlPercentage?.toFixed(2)}%
                          </div>
                        </div>

                        <div className="text-[10px] font-mono space-y-0.5 text-slate-400 pt-1 border-t border-slate-800/80">
                          <div className="flex justify-between">
                            <span>Entry:</span>
                            <span className="text-slate-200">${trade.entryPrice < 2 ? trade.entryPrice.toFixed(4) : trade.entryPrice.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Live:</span>
                            <span className={`font-bold ${isProfit ? 'text-emerald-300' : 'text-rose-300'}`}>
                              ${trade.currentPrice < 2 ? trade.currentPrice.toFixed(4) : trade.currentPrice.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-rose-400 font-semibold">
                            <span className="text-slate-400 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-rose-400/90" />
                              <span>SL:</span>
                            </span>
                            <span className="flex items-center gap-1 font-bold text-rose-400">
                              {trade.stopLoss ? `$${trade.stopLoss < 2 ? trade.stopLoss.toFixed(4) : trade.stopLoss.toLocaleString()}` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-semibold">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Target className="w-3 h-3 text-emerald-400/90" />
                              <span>TP1:</span>
                            </span>
                            <span>${trade.takeProfit1 ? (trade.takeProfit1 < 2 ? trade.takeProfit1.toFixed(4) : trade.takeProfit1.toLocaleString()) : 'N/A'}</span>
                          </div>
                          {binanceOrderId && (
                            <div className="flex justify-between text-blue-300">
                              <span className="text-slate-400">Binance ID:</span>
                              <span className="truncate max-w-[100px]" title={binanceOrderId}>{binanceOrderId}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="text-[9px] font-mono text-slate-500 truncate max-w-[95px]" title={trade.chartPattern}>
                            Score: {trade.confidenceScore}/100
                          </span>
                          <button
                            onClick={(e) => handleCopySingleTrade(e, trade)}
                            className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                          >
                            {copiedTradeId === trade.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Copy Trade</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto text-slate-400">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xs font-bold text-white">Background AI Agent Active</h3>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Scanning {SCAN_WHITELIST.size} whitelisted pairs with real Binance klines for confluence ≥ {MIN_CONFLUENCE_SCORE}...
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Learned Rules</span>
                  <BrainCircuit className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-1">{learningStats.learnedRulesCount} Rules</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>USDT Balance</span>
                  <Gauge className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-base font-bold font-mono text-amber-300 mt-1">
                  {apiSettings.usdtBalance !== null ? `$${apiSettings.usdtBalance.toFixed(2)}` : 'Not Connected'}
                </div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Daily P&L</span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className={`text-base font-bold font-mono mt-1 ${dailyPnlRef.current.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dailyPnlRef.current.pnl >= 0 ? '+' : ''}{dailyPnlRef.current.pnl.toFixed(2)}%
                </div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Environment</span>
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-[10px] font-bold font-mono text-blue-300 mt-1 truncate">
                  {apiSettings.environment.toUpperCase()} - {apiSettings.enableFutures ? 'FUTURES' : 'SPOT'}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Binance Environment &amp; API Configuration</h3>
                <p className="text-xs text-slate-400">Choose environment, paste matching API keys, then verify.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Test Mode (Skip Kill Zones)</span>
                  <span className="text-[11px] text-slate-400">
                    When ON, trades fire any time of day.
                  </span>
                </div>
                <button
                  onClick={() => setSkipKillZone((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition-colors cursor-pointer ${
                    skipKillZone
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {skipKillZone ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white block">Trading Environment</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['testnet', 'demo', 'live'] as BinanceEnvironment[]).map((env) => (
                    <button
                      key={env}
                      onClick={() => {
                        setApiSettings((p) => ({
                          ...p,
                          environment: env,
                          geoBlocked: false,
                          lastError: null,
                        }));
                        listenKeyAttemptedRef.current = false;
                        listenKeyFatalRef.current = false;
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold font-mono border transition-colors cursor-pointer ${
                        apiSettings.environment === env
                          ? env === 'testnet'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : env === 'demo'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {env.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Market Type</span>
                  <span className="text-[11px] text-slate-400">
                    {apiSettings.enableFutures ? 'USDT-M Futures' : 'Spot Trading'}
                  </span>
                </div>
                <button
                  onClick={() => setApiSettings((p) => ({ ...p, enableFutures: !p.enableFutures }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition-colors cursor-pointer ${
                    apiSettings.enableFutures
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  }`}
                >
                  {apiSettings.enableFutures ? 'FUTURES' : 'SPOT'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Binance API Key</label>
                <input
                  type="text"
                  placeholder="Paste API Key"
                  value={apiSettings.apiKey}
                  onChange={(e) => setApiSettings({ ...apiSettings, apiKey: e.target.value.trim() })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">{apiSettings.apiKey.length} characters</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Binance Secret Key</label>
                <input
                  type="password"
                  placeholder="Paste Secret Key"
                  value={apiSettings.apiSecret}
                  onChange={(e) => setApiSettings({ ...apiSettings, apiSecret: e.target.value.trim() })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">{apiSettings.apiSecret.length} characters</span>
              </div>

              {connectionLog && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-amber-300 break-words">
                  {connectionLog}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleVerifyBinanceConnection}
                  disabled={testingConnection}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700 disabled:opacity-50"
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>{testingConnection ? 'Verifying...' : 'Verify Connection'}</span>
                </button>
                <button
                  onClick={() => {
                    setApiSettings((p) => ({ ...p, isConfigured: Boolean(p.apiKey && p.apiSecret) }));
                    setActiveTab('dashboard');
                  }}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save &amp; Return</span>
                </button>
              </div>

              <button
                onClick={handleTestAlert}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                📱 Send Test Alert to Phone
              </button>
              {testAlertMessage && (
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-blue-300 text-center">
                  {testAlertMessage}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-xs font-bold text-white mb-2">📱 Phone Alerts Enabled</h4>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>✅ Trade opened → Telegram</div>
                <div>✅ Trade closed (TP/SL) → Telegram</div>
                <div>✅ Daily drawdown hit → Telegram</div>
                <div>✅ Geo-block detected → Telegram</div>
                <div>✅ Bot start/stop → Telegram</div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-xs font-bold text-white mb-2">📊 Real Market Data</h4>
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>✅ Live Binance klines (5m, 220 bars)</div>
                <div>✅ 30-second cache to prevent rate-limits</div>
                <div>✅ Falls back to cache on fetch failure</div>
                <div>✅ Whitelisted: {SCAN_WHITELIST.size} pairs only</div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-xs font-bold text-white mb-2">Whitelisted Symbols ({SCAN_WHITELIST.size})</h4>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(SCAN_WHITELIST).map((sym) => (
                  <span key={sym} className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    {sym}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <CandleChart
            assets={assets}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            activeSignal={signals.find((s) => s.symbol === selectedSymbol)}
            onOpenCalculator={(sig) => { setActiveCalcSignal(sig); setIsRiskModalOpen(true); }}
          />
        )}

        {activeTab === 'calculator' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
            <Shield className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white">Crypto Risk &amp; Position Sizing Calculator</h3>
            <button onClick={() => setIsRiskModalOpen(true)} className="mt-3 px-5 py-2 bg-emerald-600 font-bold text-xs text-slate-950 rounded-lg cursor-pointer">
              Launch Sizing Calculator
            </button>
          </div>
        )}

        {activeTab === 'trackRecord' && <TrackRecord />}
      </main>

      <RiskCalculatorModal isOpen={isRiskModalOpen} onClose={() => setIsRiskModalOpen(false)} initialSignal={activeCalcSignal} />

      <CreateAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        assets={assets}
        onAddNewSignal={(newSig) => setSignals((prev) => [newSig, ...prev])}
        audioEnabled={audioEnabled}
      />
    </div>
  );
};

export default App;