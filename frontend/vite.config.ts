import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, proxy API requests to FastAPI backend
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"]
  },
})
