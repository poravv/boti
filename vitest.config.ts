import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Load .env for integration tests that need OPENAI_API_KEY
    env: Object.fromEntries(
      Object.entries(
        (() => {
          const fs = require('fs');
          const path = require('path');
          const envFile = path.resolve(__dirname, '.env');
          if (!fs.existsSync(envFile)) return {};
          const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
          const env: Record<string, string> = {};
          for (const line of lines) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) env[match[1].trim()] = match[2].trim();
          }
          return env;
        })()
      )
    ),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'packages/core/src/**/*.ts',
        'apps/backend/src/**/*.ts',
      ],
      exclude: ['**/__tests__/**', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@boti/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
});
