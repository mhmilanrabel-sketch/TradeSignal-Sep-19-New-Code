import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
    proxy: {
      // LIVE API
      '/binance-api': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/binance-api/, ''),
        secure: false,
      },
      '/binance-fapi': {
        target: 'https://fapi.binance.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/binance-fapi/, ''),
        secure: false,
      },
      // TESTNET
      '/binance-testnet': {
        target: 'https://testnet.binance.vision',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/binance-testnet/, ''),
        secure: false,
      },
      '/binance-futures-testnet': {
        target: 'https://testnet.binancefuture.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/binance-futures-testnet/, ''),
        secure: false,
      },
      // NEW BINANCE "DEMO TRADING" (2024)
      '/binance-demo-api': {
        target: 'https://demo-api.binance.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/binance-demo-api/, ''),
        secure: false,
      },
      '/binance-demo-fapi': {
        target: 'https://demo-fapi.binance.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/binance-demo-fapi/, ''),
        secure: false,
      },
    },
  },
});