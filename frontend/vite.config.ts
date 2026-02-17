import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, serve large stele assets via FastAPI.
      '/steles': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: (req) => {
          const url = req.url || '';
          if (!url.startsWith('/steles/')) return null;
          const localPath = resolve(__dirname, 'public', url.slice(1));
          return existsSync(localPath) ? url : null;
        },
      },
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"]
  },
})
