/**
 * Complete Chatbot - End-to-end example with AI generation
 *
 * SETUP: Choose your provider and configure environment variables
 *
 * Anthropic (Claude):
 *   echo "AI_PROVIDER=anthropic" > .env
 *   echo "ANTHROPIC_API_KEY=your-key" >> .env
 *   echo "AI_MODEL=claude-3-5-haiku-20241022" >> .env
 *
 * OpenAI (GPT):
 *   echo "AI_PROVIDER=openai" > .env
 *   echo "OPENAI_API_KEY=your-key" >> .env
 *   echo "AI_MODEL=gpt-4o-mini" >> .env
 *
 * Ollama (Local):
 *   echo "AI_PROVIDER=ollama" > .env
 *   echo "AI_MODEL=llama3.2" >> .env
 *   echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env
 */
import { getProviderCredentials, getSimpleEnvConfig } from './utils'

import 'dotenv/config'

import {
  ContextOptimizer,
  createAIHandler,
  createContextHandler,
  createIntentHandler,
  createModerationHandler,
  executeOrchestration,
  IntentClassifier,
  type OrchestrationContext,
} from 'ai-pipeline-orchestrator'

const intentClassifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey'] },
    { category: 'help', keywords: ['help', 'support', 'assist'] },
    { category: 'info', keywords: ['information', 'tell me about', 'what is'] },
  ],
  metadata: {
    tones: {
      greeting: 'Be warm and welcoming',
      help: 'Be helpful and guide them to resources',
      info: 'Be informative and concise',
    },
  },
})

const contextOptimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      name: 'Core Instructions',
      content: 'You are a helpful customer support assistant. Be concise and friendly.',
      alwaysInclude: true,
    },
    {
      id: 'help',
      name: 'Help Guide',
      content: 'Help topics available: account management, billing, technical support.',
      topics: ['help'],
    },
    {
      id: 'info',
      name: 'Company Info',
      content: 'We are a SaaS company providing cloud solutions.',
      topics: ['info'],
    },
  ],
  strategy: {
    firstMessage: 'full',
    followUp: 'selective',
  },
})

async function main() {
  const { provider, model } = getSimpleEnvConfig()
  const { apiKey, baseURL } = getProviderCredentials(provider)

  const context: OrchestrationContext = {
    request: {
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you help me with my account?',
        },
      ],
    },
  }

  const result = await executeOrchestration(
    context,
    [
      {
        name: 'moderation',
        handler: createModerationHandler(),
      },
      {
        name: 'intent',
        handler: createIntentHandler({ classifier: intentClassifier }),
      },
      {
        name: 'context',
        handler: createContextHandler({
          optimizer: contextOptimizer,
          getTopics: ctx => {
            const intent = ctx.intent as { intent?: string; metadata?: { tone?: string } }
            return intent?.intent ? [intent.intent] : []
          },
        }),
      },
      {
        name: 'ai',
        handler: createAIHandler({
          provider,
          model: model as string,
          apiKey,
          baseURL,
          temperature: 0.7,
          maxTokens: 1024,
          getSystemPrompt: ctx => {
            const promptContext = ctx.promptContext as { systemPrompt?: string }
            const intent = ctx.intent as { metadata?: { tone?: string } }

            let systemPrompt = promptContext?.systemPrompt || ''

            if (intent?.metadata?.tone) {
              systemPrompt += `\n\nTone: ${intent.metadata.tone}`
            }

            return systemPrompt
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

  if (result.success) {
    console.log('\n=== Orchestration Results ===')
    console.log('Intent:', result.context.intent)
    console.log('\nAI Response:', result.context.aiResponse)
  } else {
    console.error('\nError:', result.error)
  }
}

main()
