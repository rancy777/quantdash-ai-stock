import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      publicDir: path.resolve(__dirname, 'data'),
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.VITE_GEMINI_API_KEY ?? ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.VITE_GEMINI_API_KEY ?? ''),
        'import.meta.env.TUSHARE_API_KEY': JSON.stringify(env.TUSHARE_API_KEY ?? env.VITE_TUSHARE_API_KEY ?? ''),
        'import.meta.env.TUSHARE_API_BASE_URL': JSON.stringify(env.TUSHARE_API_BASE_URL ?? env.VITE_TUSHARE_API_BASE_URL ?? 'https://api.tushare.pro')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
