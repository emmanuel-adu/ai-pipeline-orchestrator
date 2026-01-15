import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'intent/index': 'src/intent/index.ts',
    'context/index': 'src/context/index.ts',
    'handlers/index': 'src/handlers/index.ts',
    'providers/index': 'src/providers/index.ts',
    'utils/index': 'src/utils/index.ts',
    'testing/index': 'src/testing/index.ts',
    'adapters/upstash': 'src/adapters/upstash-ratelimit.ts',
    'adapters/prisma': 'src/adapters/prisma-context.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.cjs',
  }),
  external: [
    '@ai-sdk/anthropic',
    '@ai-sdk/openai',
    'ollama-ai-provider',
    'ai',
    'zod',
    '@upstash/ratelimit',
    '@upstash/redis',
    '@prisma/client',
  ],
})
