import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolveBasePath } from './build/base.ts';
import { pwaPlugin } from './build/pwa.ts';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), pwaPlugin()],
  base: resolveBasePath({
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  }),
  server: {
    host: '127.0.0.1',
    watch: {
      ignored: [
        '**/artifacts/**',
        '**/playwright-report/**',
        '**/test-results/**',
      ],
    },
  },
  preview: { host: '127.0.0.1' },
}));
