# ai-pipeline-orchestrator

Build AI chatbots and agents using composable handler pipelines. Handles the messy parts: intent detection, context management, token optimization, rate limiting, and moderation.

## What's inside

- **Sequential pipelines** - Compose handlers that run in order with automatic error handling
- **Hybrid intent detection** - Keyword matching (fast, free) with optional LLM fallback
- **Context optimization** - Load only relevant context based on intent, reduce tokens 30-50%
- **Multi-provider** - Works with Claude, GPT, DeepSeek, or local Ollama models
- **Handlers** - Rate limiting, moderation, intent, context, AI generation
- **TypeScript** - Full type safety with minimal dependencies (just Zod)

## Install

```bash
npm install ai-pipeline-orchestrator
```

Then install a provider:

```bash
# Claude (recommended)
npm install @ai-sdk/anthropic ai

# Or GPT
npm install @ai-sdk/openai ai

# Or local models
npm install ollama-ai-provider ai
```

## Quick start

```typescript
import { executeOrchestration, createAIHandler } from 'ai-pipeline-orchestrator'

const context = {
  request: {
    messages: [{ role: 'user', content: 'Tell me a joke' }],
  },
}

const result = await executeOrchestration(context, [
  {
    name: 'ai',
    handler: createAIHandler({
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY,
      getSystemPrompt: () => 'You are a helpful assistant.',
    }),
  },
])

if (result.success) {
  console.log(result.context.aiResponse.text)
}
```

## Try it out

```bash
# Setup
cp .env.example .env
# Edit .env with your provider + API key

# Interactive chat CLI
npm run example:chat

# Or try other examples
npm run example:basic      # Intent + context (no AI)
npm run example:complete   # Full pipeline
npm run example:streaming  # Streaming responses
npm run example:all        # All handlers
```

## Providers

Supports four providers via the `AIProvider` type:

```typescript
type AIProvider = 'anthropic' | 'openai' | 'deepseek' | 'ollama'
```

**Claude (Anthropic)** - `AI_PROVIDER=anthropic`
- Models: `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`
- Needs: `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com)

**GPT (OpenAI)** - `AI_PROVIDER=openai`
- Models: `gpt-4o-mini`, `gpt-4o`
- Needs: `OPENAI_API_KEY` from [platform.openai.com](https://platform.openai.com)

**DeepSeek (Cloud)** - `AI_PROVIDER=deepseek`
- Models: `deepseek-chat`
- Needs: `DEEPSEEK_API_KEY` from [platform.deepseek.com](https://platform.deepseek.com)

**Ollama (Local)** - `AI_PROVIDER=ollama`
- Models: Run `ollama list` or `ollama pull deepseek-r1`
- Free, runs locally. Get it at [ollama.com](https://ollama.com)
- Optional: `OLLAMA_BASE_URL` (defaults to `http://localhost:11434`)

For local DeepSeek, use `AI_PROVIDER=ollama` with `AI_MODEL=deepseek-r1`.

## How it works

Handlers run sequentially, passing context between them:

```typescript
const result = await executeOrchestration(
  context,
  [
    { name: 'moderation', handler: moderationHandler },
    { name: 'intent', handler: intentHandler },
    { name: 'context', handler: contextHandler },
    { name: 'ai', handler: aiHandler },
  ],
  {
    logger: myLogger,
    onStepComplete: (step, duration) => console.log(`${step}: ${duration}ms`),
  }
)
```

If any handler sets `context.error` or throws, the pipeline stops.

## Handlers

### Content moderation

```typescript
import { createModerationHandler } from 'ai-pipeline-orchestrator'

const handler = createModerationHandler({
  spamPatterns: ['buy now', 'click here'],
  customRules: [
    { pattern: /badword/i, reason: 'Profanity detected' },
  ],
})
```

### Rate limiting

Bring your own rate limiter (Upstash, Redis, etc):

```typescript
import { createRateLimitHandler, type RateLimiter } from 'ai-pipeline-orchestrator'

const limiter: RateLimiter = {
  check: async (id) => ({
    allowed: await checkLimit(id),
    retryAfter: 60, // seconds
  }),
}

const handler = createRateLimitHandler({
  limiter,
  identifierKey: 'userId', // which context field to check
})
```

### Intent detection

Three modes: keyword-only, LLM-only, or hybrid (keyword → LLM fallback).

**Keyword-based** (fast, free):

```typescript
import { IntentClassifier, createIntentHandler } from 'ai-pipeline-orchestrator'

const classifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey'] },
    { category: 'help', keywords: ['help', 'support'] },
  ],
  metadata: {
    tones: { greeting: 'friendly', help: 'helpful' },
  },
})

const handler = createIntentHandler({ classifier })
```

**LLM-based** (accurate, paid):

```typescript
import { LLMIntentClassifier } from 'ai-pipeline-orchestrator'

const llmClassifier = new LLMIntentClassifier({
  provider: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  categories: ['greeting', 'help', 'question'],
  categoryDescriptions: {
    greeting: 'User says hello',
    help: 'User needs help',
    question: 'User asks a question',
  },
})
```

**Hybrid** (best of both):

```typescript
const handler = createIntentHandler({
  classifier, // keyword first
  llmFallback: {
    enabled: true,
    classifier: llmClassifier,
    confidenceThreshold: 0.5, // use LLM if keyword confidence < 0.5
  },
})
```

### Context optimization

Load only relevant context based on intent:

```typescript
import { ContextOptimizer, createContextHandler } from 'ai-pipeline-orchestrator'

const optimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      content: 'You are a helpful assistant.',
      alwaysInclude: true,
    },
    {
      id: 'help',
      content: 'Help documentation...',
      topics: ['help', 'support'], // include when intent matches
    },
    {
      id: 'pricing',
      content: 'Pricing info...',
      topics: ['pricing', 'cost'],
    },
  ],
  strategy: {
    firstMessage: 'full',      // all sections for first message
    followUp: 'selective',     // only relevant sections after
  },
})

const handler = createContextHandler({
  optimizer,
  getTopics: (ctx) => {
    const intent = ctx.intent as { intent?: string }
    return intent?.intent ? [intent.intent] : []
  },
})
```

### AI generation

**Non-streaming:**

```typescript
import { createAIHandler } from 'ai-pipeline-orchestrator'

const handler = createAIHandler({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  getSystemPrompt: (ctx) => {
    const promptCtx = ctx.promptContext as { systemPrompt?: string }
    return promptCtx?.systemPrompt || 'You are a helpful assistant.'
  },
})
```

**Streaming:**

```typescript
import { createStreamingAIHandler } from 'ai-pipeline-orchestrator'

const handler = createStreamingAIHandler({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  onChunk: (chunk) => {
    // Send via SSE, WebSocket, etc
    sendToClient(chunk)
  },
})

// Full text still available after streaming
if (result.success) {
  console.log(result.context.aiResponse.text)
}
```

### Custom handlers

```typescript
import { OrchestrationHandler } from 'ai-pipeline-orchestrator'

const authHandler: OrchestrationHandler = async (context) => {
  const userId = context.request.metadata?.userId

  if (!userId) {
    return {
      ...context,
      error: {
        message: 'Authentication required',
        statusCode: 401,
        step: 'auth',
      },
    }
  }

  return { ...context, user: await fetchUser(userId) }
}
```

## Full example

```typescript
import {
  executeOrchestration,
  IntentClassifier,
  ContextOptimizer,
  createModerationHandler,
  createIntentHandler,
  createContextHandler,
  createAIHandler,
} from 'ai-pipeline-orchestrator'

const intentClassifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi'] },
    { category: 'help', keywords: ['help', 'support'] },
  ],
})

const contextOptimizer = new ContextOptimizer({
  sections: [
    { id: 'core', content: 'You are a helpful assistant.', alwaysInclude: true },
    { id: 'help', content: 'Help guide...', topics: ['help'] },
  ],
})

const context = {
  request: {
    messages: [{ role: 'user', content: 'Hello!' }],
  },
}

const result = await executeOrchestration(context, [
  { name: 'moderation', handler: createModerationHandler() },
  { name: 'intent', handler: createIntentHandler({ classifier: intentClassifier }) },
  { name: 'context', handler: createContextHandler({ optimizer: contextOptimizer }) },
  {
    name: 'ai',
    handler: createAIHandler({
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  },
])

if (result.success) {
  console.log(result.context.aiResponse.text)
}
```

## API

**Core:**
- `executeOrchestration(context, steps, config?)` - Run the pipeline
- `Orchestrator` - Class-based version for stateful pipelines
- `OrchestrationHandler` - Handler function type
- `OrchestrationContext` - Context object passed between handlers

**Intent:**
- `IntentClassifier` - Keyword-based detection
- `LLMIntentClassifier` - LLM-based detection
- `createIntentHandler(config)` - Creates intent handler

**Context:**
- `ContextOptimizer` - Smart context selection
- `createContextHandler(config)` - Creates context handler

**AI:**
- `createAIHandler(config)` - Text generation
- `createStreamingAIHandler(config)` - Streaming generation

**Utilities:**
- `createRateLimitHandler(config)` - Rate limiting
- `createModerationHandler(config)` - Content moderation

## License

MIT
