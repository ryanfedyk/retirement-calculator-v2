import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { aiPlugin } from './server/ai';

export default defineConfig(({ mode }) => {
  // Load every .env variable (not only VITE_*) for the server side only; nothing here is exposed to the browser.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), aiPlugin(env)],
    server: { port: Number(env.PORT) || 5180, open: !process.env.CI && !env.WC_NO_OPEN },
    preview: { port: Number(env.PORT) || 5180 },
  };
});
