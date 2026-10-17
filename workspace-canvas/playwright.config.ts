import { defineConfig, devices } from '@playwright/test';

// Two servers: the built-in local writer (no key), and a simulated AI that streams,
// so the streaming path is tested without spending API credits.
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1440, height: 900 } },
  webServer: [
    { command: 'npx vite --port 5181 --strictPort', port: 5181, reuseExistingServer: false, env: { WC_NO_OPEN: '1', ANTHROPIC_API_KEY: '' } },
    { command: 'npx vite --port 5182 --strictPort', port: 5182, reuseExistingServer: false, env: { WC_NO_OPEN: '1', WC_FAKE_AI: '1', ANTHROPIC_API_KEY: '' } },
  ],
  projects: [
    { name: 'local', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:5181' }, testIgnore: /streaming|screens/ },
    { name: 'ai-sim', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:5182' }, testMatch: /streaming/ },
    { name: 'screens', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5181' }, testMatch: /screens/ },
  ],
});
