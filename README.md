# AI Pipeline Orchestrator

![Demo](./assets/demo.gif)

Build production-ready AI chatbots with composable handler pipelines. Handles intent detection, context optimization, token management, rate limiting, and moderation out of the box.

## Features

| Feature | Description |
|---------|-------------|
| **Sequential Pipelines** | Compose handlers that run in order with automatic error handling |
| **Hybrid Intent Detection** | Keyword matching (fast, free) → LLM fallback (accurate, paid) |
| **Context Optimization** | Load only relevant context based on intent (30-50% token savings) |
| **Multi-Provider** | Works with Anthropic, OpenAI, or Ollama (local/cloud) |
| **Production Ready** | Rate limiting, moderation, logging, error handling built-in |
| **TypeScript** | Full type safety with minimal dependencies (just Zod) |

## Installation

```bash
npm install ai-pipeline-orchestrator
```

Install a provider SDK:

```bash
# Anthropic (recommended)
npm install @ai-sdk/anthropic ai

# OpenAI
npm install @ai-sdk/openai ai

# Ollama (free, local/cloud)
npm install ai-sdk-ollama ai
```

## Quick Start

```typescript
import { executeOrchestration, createAIHandler } from 'ai-pipeline-orchestrator'

const result = await executeOrchestration(
  {
    request: {
      messages: [{ role: 'user', content: 'Tell me a joke' }],
    },
  },
  [
    {
      name: 'ai',
      handler: createAIHandler({
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY,
        getSystemPrompt: () => 'You are a helpful assistant.',
      }),
    },
  ]
)

console.log(result.context.aiResponse.text)
```

## Providers

### Supported Providers

| Provider | Package | Models | API Key | Best For |
|----------|---------|--------|---------|----------|
| **Anthropic** | `@ai-sdk/anthropic` | `claude-3-5-haiku-20241022`<br/>`claude-3-5-sonnet-20241022` | [Get key](https://console.anthropic.com) | Production, high-quality responses |
| **OpenAI** | `@ai-sdk/openai` | `gpt-4o-mini`<br/>`gpt-4o` | [Get key](https://platform.openai.com) | Production, wide model selection |
| **Ollama** | `ai-sdk-ollama` | `llama3.2`, `deepseek-r1`, `qwen2.5`<br/>100+ more | Optional ([Cloud](https://ollama.com)) | Development, cost savings, offline |

### Provider Setup

<details>
<summary><strong>Anthropic / OpenAI</strong></summary>

```bash
# .env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-haiku-20241022
ANTHROPIC_API_KEY=your-key-here
```

</details>

<details>
<summary><strong>Ollama Local</strong></summary>

```bash
# Install and run
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull llama3.2

# .env
AI_PROVIDER=ollama
AI_MODEL=llama3.2:latest
OLLAMA_BASE_URL=http://localhost:11434
```

</details>

<details>
<summary><strong>Ollama Cloud (Free Tier)</strong></summary>

```bash
# .env
AI_PROVIDER=ollama
AI_MODEL=llama3.2:latest
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=your-key-here  # Get from https://ollama.com
```

</details>

<details>
<summary><strong>💡 Hybrid Setup (Recommended)</strong></summary>

Use a cloud provider for chat (best quality) + Ollama for intent classification (free):

```bash
# .env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-haiku-20241022
ANTHROPIC_API_KEY=your-key-here

INTENT_PROVIDER=ollama
INTENT_MODEL=deepseek-r1:latest
OLLAMA_BASE_URL=http://localhost:11434
```

This gives you high-quality chat responses with zero-cost intent classification.

</details>

## Usage

### Pipeline Orchestration

Handlers run sequentially, passing context between them:

```typescript
import {
  executeOrchestration,
  createModerationHandler,
  createIntentHandler,
  createContextHandler,
  createAIHandler,
} from 'ai-pipeline-orchestrator'

const result = await executeOrchestration(
  context,
  [
    { name: 'moderation', handler: createModerationHandler() },
    { name: 'intent', handler: createIntentHandler({ classifier }) },
    { name: 'context', handler: createContextHandler({ optimizer }) },
    { name: 'ai', handler: createAIHandler({ provider, model, apiKey }) },
  ],
  {
    logger: myLogger,
    onStepComplete: (step, duration) => console.log(`${step}: ${duration}ms`),
  }
)
```

If any handler sets `context.error` or throws, the pipeline stops.

### Handlers

#### Content Moderation

```typescript
import { createModerationHandler } from 'ai-pipeline-orchestrator'

const handler = createModerationHandler({
  spamPatterns: ['buy now', 'click here'],
  customRules: [{ pattern: /badword/i, reason: 'Profanity detected' }],
})
```

#### Rate Limiting

Bring your own rate limiter (Upstash, Redis, etc):

```typescript
import { createRateLimitHandler } from 'ai-pipeline-orchestrator'

const handler = createRateLimitHandler({
  limiter: {
    check: async (id) => ({
      allowed: await checkLimit(id),
      retryAfter: 60, // seconds
    }),
  },
  identifierKey: 'userId',
})
```

#### Intent Detection

Three modes: keyword-only, LLM-only, or hybrid.

<details>
<summary><strong>Keyword-based</strong> (fast, free)</summary>

```typescript
import { IntentClassifier, createIntentHandler } from 'ai-pipeline-orchestrator'

const classifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey'] },
    { category: 'help', keywords: ['help', 'support'] },
  ],
})

const handler = createIntentHandler({ classifier })
```

</details>

<details>
<summary><strong>LLM-based</strong> (accurate, paid)</summary>

```typescript
import { LLMIntentClassifier, createIntentHandler } from 'ai-pipeline-orchestrator'

const classifier = new LLMIntentClassifier({
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

const handler = createIntentHandler({ classifier })
```

</details>

<details>
<summary><strong>Hybrid</strong> (best of both)</summary>

```typescript
const handler = createIntentHandler({
  classifier: keywordClassifier,
  llmFallback: {
    enabled: true,
    classifier: llmClassifier,
    confidenceThreshold: 0.5, // use LLM if keyword confidence < 0.5
  },
})
```

</details>

#### Context Optimization

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
      topics: ['help', 'support'],
    },
  ],
  strategy: {
    firstMessage: 'full',
    followUp: 'selective',
  },
})

const handler = createContextHandler({
  optimizer,
  getTopics: (ctx) => [ctx.intent?.intent],
})
```

#### AI Generation

<details>
<summary><strong>Non-streaming</strong></summary>

```typescript
import { createAIHandler } from 'ai-pipeline-orchestrator'

const handler = createAIHandler({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  getSystemPrompt: (ctx) => ctx.promptContext?.systemPrompt || 'You are a helpful assistant.',
})
```

</details>

<details>
<summary><strong>Streaming</strong></summary>

```typescript
import { createStreamingAIHandler } from 'ai-pipeline-orchestrator'

const handler = createStreamingAIHandler({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  onChunk: (chunk) => sendToClient(chunk),
})

// Full text still available after streaming
console.log(result.context.aiResponse.text)
```

</details>

#### Custom Handlers

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

## Try the Interactive Demo

```bash
git clone https://github.com/emmanuel-adu/ai-pipeline-orchestrator.git
cd ai-pipeline-orchestrator
npm install

# Configure (copy .env.example to .env and add your API key)
cp .env.example .env

# Run the demo
npm run example:chat
```

The demo showcases all features in real-time:
- Content moderation
- Rate limiting
- Hybrid intent classification
- Context optimization (30-50% token savings)
- Real-time streaming
- Token usage breakdown

## API Reference

### Core

| Export | Description |
|--------|-------------|
| `executeOrchestration(context, steps, config?)` | Run the pipeline |
| `Orchestrator` | Class-based version for stateful pipelines |
| `OrchestrationHandler` | Handler function type |
| `OrchestrationContext` | Context object passed between handlers |

### Intent

| Export | Description |
|--------|-------------|
| `IntentClassifier` | Keyword-based detection |
| `LLMIntentClassifier` | LLM-based detection with structured output |
| `createIntentHandler(config)` | Creates intent handler |

### Context

| Export | Description |
|--------|-------------|
| `ContextOptimizer` | Smart context selection |
| `createContextHandler(config)` | Creates context handler |

### AI

| Export | Description |
|--------|-------------|
| `createAIHandler(config)` | Text generation |
| `createStreamingAIHandler(config)` | Streaming generation |

### Utilities

| Export | Description |
|--------|-------------|
| `createRateLimitHandler(config)` | Rate limiting |
| `createModerationHandler(config)` | Content moderation |

## Examples

Check out the [examples](./examples) directory:

- [`basic-chatbot.ts`](./examples/basic-chatbot.ts) - Minimal working example
- [`complete-chatbot.ts`](./examples/complete-chatbot.ts) - All features combined
- [`streaming-chatbot.ts`](./examples/streaming-chatbot.ts) - Streaming responses
- [`chat-cli.ts`](./examples/chat-cli.ts) - Interactive CLI demo

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT © [Emmanuel Adu](https://github.com/emmanuel-adu)
