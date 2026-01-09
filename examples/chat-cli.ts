/**
 * Interactive Chat CLI - Live chatbot with multi-turn conversations
 *
 * This example demonstrates:
 * - Multi-turn conversation history
 * - Real-time streaming responses
 * - All handlers working together
 * - Interactive user experience
 *
 * SETUP: Configure environment variables in .env file
 *
 * Simple setup:
 *   echo "AI_PROVIDER=anthropic" > .env
 *   echo "AI_MODEL=claude-3-5-haiku-20241022" >> .env
 *   echo "ANTHROPIC_API_KEY=your-key" >> .env
 *
 * Run:
 *   npx tsx examples/chat-cli.ts
 */
import 'dotenv/config'
import * as readline from 'readline'
import {
  executeOrchestration,
  IntentClassifier,
  ContextOptimizer,
  createModerationHandler,
  createIntentHandler,
  createContextHandler,
  createStreamingAIHandler,
  type OrchestrationContext,
  type Message,
} from '../src'
import { getSimpleEnvConfig, getProviderCredentials } from './utils'

const intentClassifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey', 'greetings'] },
    { category: 'help', keywords: ['help', 'support', 'assist'] },
    { category: 'goodbye', keywords: ['bye', 'goodbye', 'exit', 'quit'] },
  ],
  metadata: {
    tones: {
      greeting: 'Be warm and welcoming',
      help: 'Be helpful and patient',
      goodbye: 'Be friendly and wish them well',
    },
  },
})

const contextOptimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      name: 'Core Instructions',
      content: 'You are a helpful AI assistant. Be concise, friendly, and conversational.',
      alwaysInclude: true,
    },
    {
      id: 'greeting',
      name: 'Greeting Guide',
      content: 'Welcome users warmly and ask how you can help.',
      topics: ['greeting'],
    },
    {
      id: 'help',
      name: 'Help Guide',
      content: 'Provide clear, actionable help and guidance.',
      topics: ['help'],
    },
  ],
  strategy: {
    firstMessage: 'full',
    followUp: 'selective',
  },
})

async function chat() {
  const { provider: aiProvider, model: aiModel } = getSimpleEnvConfig()
  const aiConfig = getProviderCredentials(aiProvider)

  const messages: Message[] = []

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log('\n🤖 AI Chat CLI')
  console.log('━'.repeat(50))
  console.log(`Provider: ${aiProvider} | Model: ${aiModel}`)
  console.log('Type "exit" or "quit" to end the conversation\n')

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const userMessage = input.trim()

      if (!userMessage) {
        prompt()
        return
      }

      if (userMessage.toLowerCase() === 'exit' || userMessage.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye!\n')
        rl.close()
        return
      }

      messages.push({ role: 'user', content: userMessage })

      const context: OrchestrationContext = {
        request: {
          messages: [...messages],
          metadata: { userId: 'cli-user' },
        },
      }

      process.stdout.write('\nAssistant: ')

      try {
        const result = await executeOrchestration(context, [
          {
            name: 'moderation',
            handler: createModerationHandler({
              spamPatterns: ['buy now', 'click here'],
            }),
          },
          {
            name: 'intent',
            handler: createIntentHandler({
              classifier: intentClassifier,
            }),
          },
          {
            name: 'context',
            handler: createContextHandler({
              optimizer: contextOptimizer,
              getTopics: (ctx) => {
                const intent = ctx.intent as { intent?: string }
                return intent?.intent ? [intent.intent] : []
              },
            }),
          },
          {
            name: 'streaming-ai',
            handler: createStreamingAIHandler({
              provider: aiProvider,
              model: aiModel as string,
              apiKey: aiConfig.apiKey,
              baseURL: aiConfig.baseURL,
              temperature: 0.7,
              maxTokens: 1024,
              getSystemPrompt: (ctx) => {
                const promptContext = ctx.promptContext as { systemPrompt?: string }
                const intent = ctx.intent as { metadata?: { tone?: string } }

                let systemPrompt = promptContext?.systemPrompt || ''

                if (intent?.metadata?.tone) {
                  systemPrompt += `\n\nTone: ${intent.metadata.tone}`
                }

                return systemPrompt
              },
              onChunk: (chunk) => {
                process.stdout.write(chunk)
              },
            }),
          },
        ])

        if (result.success) {
          const aiResponse = result.context.aiResponse as { text?: string }
          if (aiResponse?.text) {
            messages.push({ role: 'assistant', content: aiResponse.text })
          }
          console.log('\n')
        } else {
          console.error(`\n\n❌ Error: ${result.error?.message}\n`)
        }
      } catch (error) {
        console.error(`\n\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      }

      prompt()
    })
  }

  prompt()
}

chat().catch(console.error)
