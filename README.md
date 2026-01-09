# ai-pipeline-orchestrator

Production-ready orchestration framework for AI applications featuring hybrid intent classification, dynamic context optimization, and sequential pipeline architecture.

## Features

- **Sequential Orchestration** - Map-based handler system with error propagation and performance monitoring
- **Hybrid Intent Classification** - Fast keyword matching (free) with optional LLM fallback (accurate)
- **Dynamic Context Optimization** - Smart context loading based on topics/intent (30-50% token reduction)
- **Multi-Provider Support** - Works with Anthropic (Claude), OpenAI (GPT), or Ollama (local models)
- **Essential Handlers** - Rate limiting, content moderation, intent detection, context building, AI generation
- **Extensible** - Easy to add custom handlers and extend functionality
- **TypeScript First** - Full type safety and IntelliSense support
- **Minimal Dependencies** - Only Zod required, AI SDK is optional

## Installation

```bash
npm install ai-pipeline-orchestrator
```

Optional dependencies (install only the provider you need):

```bash
# Anthropic (Claude)
npm install @ai-sdk/anthropic ai

# OpenAI (GPT)
npm install @ai-sdk/openai ai

# Ollama (Local models)
npm install ollama-ai-provider ai
```

## Provider Configuration

The package supports multiple LLM providers for intent classification and AI generation:

### Anthropic (Claude)

```typescript
import { LLMIntentClassifier, createAIHandler } from 'ai-pipeline-orchestrator'

const classifier = new LLMIntentClassifier({
  provider: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  categories: ['greeting', 'help'],
  categoryDescriptions: { greeting: 'User says hello', help: 'User needs help' },
})

const aiHandler = createAIHandler({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

### OpenAI (GPT)

```typescript
const classifier = new LLMIntentClassifier({
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
  categories: ['greeting', 'help'],
  categoryDescriptions: { greeting: 'User says hello', help: 'User needs help' },
})

const aiHandler = createAIHandler({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
})
```

### Ollama (Local Models)

```typescript
const classifier = new LLMIntentClassifier({
  provider: 'ollama',
  model: 'llama3.2',
  baseURL: 'http://localhost:11434', // Optional, this is the default
  categories: ['greeting', 'help'],
  categoryDescriptions: { greeting: 'User says hello', help: 'User needs help' },
})

const aiHandler = createAIHandler({
  provider: 'ollama',
  model: 'llama3.2',
  baseURL: 'http://localhost:11434', // Optional, this is the default
})
```

## Quick Start

```typescript
import {
  executeOrchestration,
  IntentClassifier,
  ContextOptimizer,
  createIntentHandler,
  createContextHandler,
  createModerationHandler,
  type OrchestrationContext,
} from 'ai-pipeline-orchestrator'

// Configure intent classifier
const intentClassifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey'] },
    { category: 'help', keywords: ['help', 'support'] },
  ],
})

// Configure context optimizer
const contextOptimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      name: 'Core Instructions',
      content: 'You are a helpful assistant.',
      alwaysInclude: true,
    },
  ],
})

// Execute orchestration
const context: OrchestrationContext = {
  request: {
    messages: [{ role: 'user', content: 'Hello!' }],
  },
}

const result = await executeOrchestration(context, [
  { name: 'moderation', handler: createModerationHandler() },
  { name: 'intent', handler: createIntentHandler({ classifier: intentClassifier }) },
  { name: 'context', handler: createContextHandler({ optimizer: contextOptimizer }) },
])

if (result.success) {
  console.log('Intent:', result.context.intent)
  console.log('Context:', result.context.promptContext)
}
```

## Core Concepts

### Orchestration Pipeline

The orchestration pipeline executes handlers sequentially, passing context between them:

```typescript
const result = await executeOrchestration(
  context,
  [
    { name: 'step1', handler: handler1 },
    { name: 'step2', handler: handler2 },
  ],
  {
    logger: myLogger,
    onStepComplete: (step, duration) => {
      console.log(`${step} completed in ${duration}ms`)
    },
  }
)
```

Pipeline stops immediately if any handler sets `context.error` or throws.

### Intent Classification

Hybrid approach combining keyword matching with optional LLM fallback:

```typescript
const classifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi'] },
  ],
  metadata: {
    tones: { greeting: 'friendly' },
    requiresAuth: ['admin_action'],
  },
})

const llmClassifier = new LLMIntentClassifier({
  categories: ['greeting', 'help', 'question'],
  categoryDescriptions: {
    greeting: 'User says hello',
    help: 'User needs help',
  },
})

const handler = createIntentHandler({
  classifier,
  llmFallback: {
    enabled: true,
    classifier: llmClassifier,
    confidenceThreshold: 0.5, // Use LLM if keyword confidence < 0.5
  },
})
```

### Context Optimization

Smart context selection based on topics and message position:

```typescript
const optimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      content: 'Core instructions...',
      alwaysInclude: true,
    },
    {
      id: 'help',
      content: 'Help documentation...',
      topics: ['help', 'support'],
    },
  ],
  strategy: {
    firstMessage: 'full',      // Full context for first message
    followUp: 'selective',     // Selective for follow-ups
  },
})
```

### Custom Handlers

Create your own handlers:

```typescript
import { OrchestrationHandler } from 'ai-pipeline-orchestrator'

const myHandler: OrchestrationHandler = async (context) => {
  // Your logic here
  return {
    ...context,
    myData: 'processed',
  }
}
```

## Complete Example with AI Generation

```typescript
import {
  executeOrchestration,
  createModerationHandler,
  createIntentHandler,
  createContextHandler,
  createAIHandler,
} from 'ai-pipeline-orchestrator'

const result = await executeOrchestration(context, [
  { name: 'moderation', handler: createModerationHandler() },
  { name: 'intent', handler: createIntentHandler({ classifier }) },
  { name: 'context', handler: createContextHandler({ optimizer }) },
  { name: 'ai', handler: createAIHandler({ model: 'claude-3-5-haiku-20241022' }) },
])

if (result.success) {
  console.log('AI Response:', result.context.aiResponse)
}
```

## Examples

- [`examples/basic-chatbot.ts`](./examples/basic-chatbot.ts) - Basic orchestration without AI
- [`examples/complete-chatbot.ts`](./examples/complete-chatbot.ts) - Complete end-to-end with AI generation

## API Documentation

### Core

- `executeOrchestration(context, steps, config?)` - Execute orchestration pipeline
- `Orchestrator` - Class-based orchestrator
- `OrchestrationContext` - Context passed between handlers
- `OrchestrationHandler` - Handler function type

### Intent

- `IntentClassifier` - Keyword-based intent classifier
- `LLMIntentClassifier` - LLM-based intent classifier
- `detectIntent(message, config)` - Functional API for intent detection
- `classifyWithLLM(message, config)` - Functional API for LLM classification

### Context

- `ContextOptimizer` - Context optimization engine
- `buildContext(topics, isFirstMessage, config)` - Functional API for context building

### Handlers

- `createIntentHandler(config)` - Intent detection handler
- `createContextHandler(config)` - Context building handler
- `createRateLimitHandler(config)` - Rate limiting handler
- `createModerationHandler(config)` - Content moderation handler
- `createAIHandler(config)` - AI generation handler (optional, requires AI SDK)

## License

MIT
