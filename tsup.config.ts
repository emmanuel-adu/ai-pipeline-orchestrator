import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'intent/index': 'src/intent/index.ts',
    'context/index': 'src/context/index.ts',
    'handlers/index': 'src/handlers/index.ts',
    'utils/index': 'src/utils/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@ai-sdk/anthropic',
    'ai',
    'zod',
  ],
})
