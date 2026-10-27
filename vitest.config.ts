import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: 'dsh-antv-ava/protocol', replacement: resolve(__dirname, 'src/protocol/index.ts') },
      { find: /^react$/, replacement: resolve(__dirname, 'node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: resolve(__dirname, 'node_modules/react/jsx-runtime.js') },
      { find: /^react-dom\/client$/, replacement: resolve(__dirname, 'node_modules/react-dom/client.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.{ts,tsx}'],
    server: {
      deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] },
    },
  },
})
