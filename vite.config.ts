import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig merged with Vitest's own
// InlineConfig types, so the `test` field below type-checks under `tsc -b`
// (which npm run build's tsc step runs) instead of failing with "test does
// not exist in type UserConfigExport" — no behavior change to vite
// build/dev/preview or vitest run, purely a typing fix.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
