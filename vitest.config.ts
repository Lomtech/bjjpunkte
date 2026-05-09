import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json'],
      include: ['src/lib/excel-parser.ts', 'src/lib/iban.ts', 'src/lib/encryption.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
    },
  },
})
