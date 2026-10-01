import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, forward API and WebSocket calls to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': { target: 'ws://localhost:5000', ws: true },
    },
  },
});
