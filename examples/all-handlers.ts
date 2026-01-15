/**
 * All Handlers Example - Complete production pipeline
 *
 * This example demonstrates all available handlers working together:
 * - Rate limiting
 * - Content moderation
 * - Intent detection (keyword + LLM fallback with analytics)
 * - Context optimization (static with tone injection)
 * - AI generation
 *
 * NOTE: This uses static context optimization. For dynamic context loading
 * with A/B testing, see examples/dynamic-context.ts
 *
 * SETUP: Configure environment variables in .env file
 *
 * Simple (same provider for intent and AI):
 *   echo "AI_PROVIDER=anthropic" > .env
 *   echo "AI_MODEL=claude-3-5-haiku-20241022" >> .env
 *   echo "ANTHROPIC_API_KEY=your-key" >> .env
 *
 * Advanced (different providers for intent vs AI):
 *   echo "AI_PROVIDER=anthropic" > .env
 *   echo "AI_MODEL=claude-3-5-sonnet-20241022" >> .env
 *   echo "INTENT_PROVIDER=openai" >> .env
 *   echo "INTENT_MODEL=gpt-4o-mini" >> .env
 *   echo "ANTHROPIC_API_KEY=your-anthropic-key" >> .env
 *   echo "OPENAI_API_KEY=your-openai-key" >> .env
 */
import { getEnvConfig, getProviderCredentials } from './utils'

import 'dotenv/config'

import {
  ContextOptimizer,
  createAIHandler,
  createContextHandler,
  createIntentHandler,
  createModerationHandler,
  createRateLimitHandler,
  executeOrchestration,
  IntentClassifier,
  LLMIntentClassifier,
  type OrchestrationContext,
  type RateLimiter,
} from '../src'

// 1. Rate Limiter - Simple in-memory implementation (use Redis/Upstash in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const rateLimiter: RateLimiter = {
  check: async (identifier: string) => {
    const now = Date.now()
    const limit = 5 // 5 requests per minute
    const window = 60 * 1000 // 1 minute

    const current = rateLimitStore.get(identifier)

    if (!current || now > current.resetAt) {
      rateLimitStore.set(identifier, { count: 1, resetAt: now + window })
      return { allowed: true }
    }

    if (current.count >= limit) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000)
      return { allowed: false, retryAfter }
    }

    current.count++
    return { allowed: true }
  },
}

// 2. Content Moderation - Supports both string and RegExp patterns
const moderationHandler = createModerationHandler({
  // Strings are automatically converted to case-insensitive RegExp
  spamPatterns: ['buy now', 'click here', 'limited time offer', /\d{10,}/],
  profanityWords: ['badword1', 'badword2'],
  customRules: [
    {
      // Can use RegExp for complex patterns
      pattern: /\b(spam|scam)\b/i,
      reason: 'Potential spam content',
    },
    {
      // Or strings for simple patterns
      pattern: 'urgent action required',
      reason: 'Urgency manipulation',
    },
  ],
})

// 3. Intent Classification - Keyword-based
const intentClassifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey', 'greetings'] },
    { category: 'help', keywords: ['help', 'support', 'assist', 'question'] },
    { category: 'pricing', keywords: ['price', 'cost', 'pricing', 'payment'] },
    { category: 'technical', keywords: ['bug', 'error', 'not working', 'broken'] },
  ],
  metadata: {
    tones: {
      greeting: 'Be warm and welcoming',
      help: 'Be helpful and patient',
      pricing: 'Be clear about pricing',
      technical: 'Be technical and solution-oriented',
    },
  },
})

// 4. LLM Fallback Classifier (configured in main based on provider)

// 5. Context Optimizer with Tone Injection
const contextOptimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      name: 'Core Instructions',
      content: 'You are a helpful customer support assistant. Be concise and friendly.',
      alwaysInclude: true,
    },
    {
      id: 'greeting-guide',
      name: 'Greeting Guide',
      content: 'Welcome users warmly. Ask how you can help them today.',
      topics: ['greeting'],
    },
    {
      id: 'help-guide',
      name: 'Help Guide',
      content: 'Available resources: documentation, tutorials, support tickets.',
      topics: ['help'],
    },
    {
      id: 'pricing-info',
      name: 'Pricing Information',
      content: 'Plans: Free ($0/mo), Pro ($29/mo), Enterprise (custom pricing).',
      topics: ['pricing'],
    },
    {
      id: 'technical-guide',
      name: 'Technical Support Guide',
      content: 'Common issues: Check logs, restart service, contact support if persists.',
      topics: ['technical'],
    },
  ],
  strategy: {
    firstMessage: 'full',
    followUp: 'selective',
  },
  // Tone-specific instructions injected based on intent
  toneInstructions: {
    'Be warm and welcoming': '\n\nTONE: Use a warm, friendly tone with enthusiasm.',
    'Be helpful and patient': '\n\nTONE: Be patient and thorough in your explanations.',
    'Be clear about pricing': '\n\nTONE: Be clear and transparent about costs.',
    'Be technical and solution-oriented':
      '\n\nTONE: Focus on technical details and actionable solutions.',
  },
})

async function main() {
  const { aiProvider, aiModel, intentProvider, intentModel } = getEnvConfig()
  const aiConfig = getProviderCredentials(aiProvider)
  const intentConfig = getProviderCredentials(intentProvider)

  const llmClassifier = new LLMIntentClassifier({
    provider: intentProvider,
    model: intentModel as string,
    apiKey: intentConfig.apiKey,
    baseURL: intentConfig.baseURL,
    categories: ['greeting', 'help', 'pricing', 'technical', 'general'],
    categoryDescriptions: {
      greeting: 'User is greeting or saying hello',
      help: 'User needs help or has a question',
      pricing: 'User is asking about pricing or costs',
      technical: 'User has a technical issue or bug report',
      general: 'General conversation or unclear intent',
    },
  })

  const context: OrchestrationContext = {
    request: {
      messages: [
        {
          role: 'user',
          content: 'Hi! I need help with a bug in my app',
        },
      ],
      metadata: {
        userId: 'user-123', // For rate limiting
      },
    },
  }

  console.log('Executing full production pipeline...\n')

  const result = await executeOrchestration(
    context,
    [
      {
        name: 'rate-limit',
        handler: createRateLimitHandler({
          limiter: rateLimiter,
          identifierKey: 'userId',
        }),
      },
      {
        name: 'moderation',
        handler: moderationHandler,
      },
      {
        name: 'intent',
        handler: createIntentHandler({
          classifier: intentClassifier,
          llmFallback: {
            enabled: true,
            classifier: llmClassifier,
            confidenceThreshold: 0.5,
          },
          onFallback: data => {
            // Log intent fallback for learning
            console.log(
              `\n📊 Intent fallback triggered: ${data.keywordIntent} (${data.keywordConfidence.toFixed(2)}) → ${data.llmIntent} (${data.llmConfidence.toFixed(2)})`
            )
          },
        }),
      },
      {
        name: 'context',
        handler: createContextHandler({
          optimizer: contextOptimizer,
          getTopics: ctx => {
            const intent = ctx.intent as { intent?: string }
            return intent?.intent ? [intent.intent] : []
          },
          getTone: ctx => {
            const intent = ctx.intent as { metadata?: { tone?: string } }
            return intent?.metadata?.tone
          },
        }),
      },
      {
        name: 'ai',
        handler: createAIHandler({
          provider: aiProvider,
          model: aiModel as string,
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseURL,
          temperature: 0.7,
          maxTokens: 1024,
          getSystemPrompt: ctx => {
            // Context optimizer already includes tone injection
            const promptContext = ctx.promptContext as { systemPrompt?: string }
            return promptContext?.systemPrompt || ''
          },
        }),
      },
    ],
    {
      onStepComplete: (step, duration) => {
        console.log(`✓ ${step} completed in ${duration}ms`)
      },
    }
  )

  console.log('\n=== Results ===\n')

  if (result.success) {
    console.log('Intent:', result.context.intent)
    console.log(
      '\nContext sections included:',
      (result.context.promptContext as any)?.sectionsIncluded
    )
    console.log('\nAI Response:', (result.context.aiResponse as any)?.text)
    console.log('\nToken usage:', (result.context.aiResponse as any)?.usage)
  } else {
    console.error('Error:', result.error)
  }
}

main().catch(console.error)
