/**
 * Example: Dynamic context loading with versioning
 *
 * This example demonstrates:
 * - Loading contexts from a dynamic source (simulated database)
 * - Simple variant/version selection (environment-based or custom logic)
 * - TTL caching with race condition protection (5-minute cache)
 * - Analytics callbacks for tracking variant usage
 *
 * Use Cases:
 * - Load prompts from CMS/database for easy updates without deployment
 * - Switch between prompt versions via environment variable
 * - Use your own A/B testing tool (LaunchDarkly, Optimizely, etc.)
 * - Cache expensive database queries
 *
 * SETUP: Configure environment variables
 *
 * Anthropic (Claude):
 *   echo "AI_PROVIDER=anthropic" > .env
 *   echo "ANTHROPIC_API_KEY=your-key" >> .env
 *   echo "AI_MODEL=claude-3-5-haiku-20241022" >> .env
 *   echo "PROMPT_VARIANT=variant-a" >> .env  # Optional: control, experiment, v2, etc.
 */
import { getProviderCredentials, getSimpleEnvConfig } from './utils'

import 'dotenv/config'

import {
  type ContextLoader,
  type ContextLoadOptions,
  type ContextSection,
  createAIHandler,
  createDynamicContextHandler,
  executeOrchestration,
  type OrchestrationContext,
  TTLCache,
} from '../src'

/**
 * Database-backed context loader (simulated)
 *
 * In production, this would:
 * - Query Postgres/MySQL/MongoDB for context sections
 * - Support topic filtering
 * - Handle errors gracefully with fallback
 *
 * Example with Prisma:
 * ```typescript
 * async load(topics: string[], variant?: string) {
 *   return await prisma.contextSection.findMany({
 *     where: {
 *       variant,
 *       OR: topics.map(topic => ({ topics: { has: topic } }))
 *     },
 *     orderBy: { priority: 'desc' }
 *   })
 * }
 * ```
 */
class DatabaseContextLoader implements ContextLoader {
  async load(options: ContextLoadOptions): Promise<ContextSection[]> {
    await new Promise(resolve => setTimeout(resolve, 50))

    console.log(`📦 Loading contexts from database for variant: ${options.variant}`)

    if (options.variant === 'variant-a') {
      // Variant A: Casual, friendly tone
      return [
        {
          id: 'core',
          name: 'Core Instructions',
          content: 'You are a friendly assistant. Variant A: Use casual, conversational language.',
          alwaysInclude: true,
          priority: 10,
        },
        {
          id: 'greeting',
          name: 'Greeting Instructions',
          content: 'Respond to greetings warmly with emojis! Be enthusiastic and welcoming.',
          topics: ['greeting', 'hello'],
          priority: 5,
        },
      ]
    }

    // Variant B: Professional, formal tone
    return [
      {
        id: 'core',
        name: 'Core Instructions',
        content: 'You are a professional assistant. Variant B: Use formal, precise language.',
        alwaysInclude: true,
        priority: 10,
      },
      {
        id: 'greeting',
        name: 'Greeting Instructions',
        content: 'Respond to greetings professionally and courteously.',
        topics: ['greeting', 'hello'],
        priority: 5,
      },
    ]
  }
}

async function main() {
  const { provider, model } = getSimpleEnvConfig()
  const { apiKey, baseURL } = getProviderCredentials(provider)

  // Setup cache with 5-minute TTL
  const cache = new TTLCache<ContextSection[]>(5 * 60 * 1000)

  // Setup context loader
  const loader = new DatabaseContextLoader()

  // Test with different variant sources
  const tests = [
    {
      name: 'Environment Variable',
      getVariant: () => process.env.PROMPT_VARIANT || 'variant-a',
    },
    {
      name: 'Hardcoded',
      getVariant: () => 'variant-b',
    },
  ]

  console.log('🧪 Testing different variant selection strategies\n')
  console.log('This shows how you can integrate with your own A/B testing tool\n')

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔧 Strategy: ${test.name}`)
    console.log('='.repeat(60))

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello!' }],
      },
    }

    const result = await executeOrchestration(context, [
      {
        name: 'dynamic-context',
        handler: createDynamicContextHandler({
          loader,
          cache,
          getTopics: ctx => {
            const message = ctx.request.messages[ctx.request.messages.length - 1]
            const content = typeof message.content === 'string' ? message.content.toLowerCase() : ''
            // Simple topic extraction
            if (content.includes('hello') || content.includes('hi')) {
              return ['greeting']
            }
            return []
          },
          getVariant: test.getVariant,
          onVariantUsed: data => {
            console.log(
              `\n📊 Analytics: Using variant "${data.variant}" for topics: ${data.topics.join(', ')}`
            )
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
        }),
      },
    ])

    if (result.success) {
      const promptContext = result.context.promptContext as {
        variant?: string
        tokenEstimate?: number
        maxTokenEstimate?: number
      }
      const aiResponse = result.context.aiResponse as { text?: string }

      console.log(`\n📝 Variant: ${promptContext?.variant}`)
      console.log(`💬 AI Response: ${aiResponse?.text}`)
      console.log(`\n💾 Cache status: ${cache.size()} variant(s) cached`)
    } else {
      console.error('\n❌ Error:', result.error)
    }
  }

  console.log(`\n\n${'='.repeat(60)}`)
  console.log('✅ Demo complete')
  console.log('='.repeat(60))
  console.log(`\n💡 Key Takeaways:`)
  console.log('   • Use environment variables for simple version control')
  console.log('   • Integrate with LaunchDarkly, Optimizely, or your own A/B tool')
  console.log('   • Contexts are cached to avoid redundant database queries')
  console.log('   • Analytics callbacks let you track variant usage however you want')
  console.log('   • You can update prompts in the database without redeploying')
  console.log(`\n💡 Example with A/B testing tool:`)
  console.log(`   getVariant: (ctx) => {`)
  console.log(`     return launchDarkly.variation('prompt-version', ctx.userId, 'control')`)
  console.log(`   }`)
}

main().catch(console.error)
