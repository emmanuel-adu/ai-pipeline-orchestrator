/**
 * Example: Streaming chatbot with real-time response delivery
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
  createModerationHandler,
  createStreamingAIHandler,
  executeOrchestration,
  type OrchestrationContext,
} from '../src'

async function main() {
  const { provider, model } = getSimpleEnvConfig()
  const { apiKey, baseURL } = getProviderCredentials(provider)

  const context: OrchestrationContext = {
    request: {
      messages: [{ role: 'user', content: 'Tell me a story about a robot' }],
    },
  }

  const result = await executeOrchestration(context, [
    {
      name: 'moderation',
      handler: createModerationHandler({
        spamPatterns: ['buy now', 'click here'],
      }),
    },
    {
      name: 'streaming-ai',
      handler: createStreamingAIHandler({
        provider,
        model: model as string,
        apiKey,
        baseURL,
        getSystemPrompt: () =>
          'You are a creative storyteller. Keep your story brief (2-3 sentences).',
        onChunk: chunk => {
          process.stdout.write(chunk)
        },
      }),
    },
  ])

  if (result.success) {
    console.log('\n\n--- Streaming complete ---')
    const aiResponse = result.context.aiResponse as { text?: string; usage?: any }
    console.log('Full text length:', aiResponse?.text?.length || 0, 'characters')
    console.log('Usage:', aiResponse?.usage)
  } else {
    console.error('Error:', result.error)
  }
}

main().catch(console.error)
