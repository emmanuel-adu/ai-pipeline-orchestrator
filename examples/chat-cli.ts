#!/usr/bin/env node
/**
 * Interactive Chat CLI
 *
 * This is the COMPLETE showcase of ai-pipeline-orchestrator featuring:
 *
 * ✅ Content Moderation - Blocks spam and inappropriate content
 * ✅ Rate Limiting - Prevents abuse (demo: 10 requests/minute)
 * ✅ Hybrid Intent Classification - Keyword matching with LLM fallback
 * ✅ Dynamic Context Optimization - Loads only relevant context (30-50% token savings)
 * ✅ Multi-Provider Support - Works with Anthropic, OpenAI, DeepSeek, Ollama
 * ✅ Real-Time Streaming - Fast, responsive AI responses
 * ✅ Token Usage Tracking - See exactly what you're using
 *
 * QUICK SETUP (30 seconds):
 *
 *   echo "AI_PROVIDER=anthropic" > .env
 *   echo "AI_MODEL=claude-3-5-haiku-20241022" >> .env
 *   echo "ANTHROPIC_API_KEY=your-key-here" >> .env
 *   npm run example:chat
 *
 * Try these queries to see different features:
 *   - "Hello!" → Triggers greeting intent, loads greeting context
 *   - "I need help" → Triggers help intent, loads help documentation
 *   - "What's the weather?" → Low keyword confidence → LLM fallback kicks in
 *   - Send 11+ messages fast → Rate limiting activates
 */
import { getEnvConfig, getProviderCredentials } from './utils'

import 'dotenv/config'

import * as readline from 'readline'

import {
  ContextOptimizer,
  createContextHandler,
  createIntentHandler,
  createModerationHandler,
  createRateLimitHandler,
  createStreamingAIHandler,
  executeOrchestration,
  IntentClassifier,
  LLMIntentClassifier,
  type Message,
  type OrchestrationContext,
  type RateLimiter,
} from '../src'

// Silent logger for clean CLI output
const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

// Simple in-memory rate limiter for demo (10 requests per minute)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

const demoRateLimiter: RateLimiter = {
  check: async (identifier: string) => {
    const now = Date.now()
    const userLimit = requestCounts.get(identifier)

    // Reset if past reset time
    if (userLimit && now > userLimit.resetTime) {
      requestCounts.delete(identifier)
    }

    const current = requestCounts.get(identifier)

    if (!current) {
      // First request
      requestCounts.set(identifier, {
        count: 1,
        resetTime: now + 60000, // Reset in 60 seconds
      })
      return { allowed: true }
    }

    if (current.count >= 10) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((current.resetTime - now) / 1000)
      return { allowed: false, retryAfter }
    }

    // Increment count
    current.count++
    return { allowed: true }
  },
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
}

const intentClassifier = new IntentClassifier({
  patterns: [
    {
      category: 'greeting',
      keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'],
    },
    {
      category: 'help',
      keywords: ['help', 'support', 'assist', 'how do i', 'how to', 'need help'],
    },
    {
      category: 'goodbye',
      keywords: ['bye', 'goodbye', 'exit', 'quit', 'see you', 'farewell'],
    },
    {
      category: 'question',
      keywords: ['what', 'when', 'where', 'why', 'how', 'who', 'which'],
    },
    {
      category: 'feedback',
      keywords: ['feedback', 'suggestion', 'improve', 'feature request', 'bug'],
    },
  ],
  metadata: {
    tones: {
      greeting: 'Be warm, welcoming, and enthusiastic',
      help: 'Be patient, clear, and provide actionable guidance',
      goodbye: 'Be friendly and leave a positive impression',
      question: 'Be informative and thorough in your explanation',
      feedback: 'Be appreciative and show you value their input',
      general: 'Be helpful, friendly, and conversational',
    },
  },
})

const contextOptimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      name: 'Core Instructions',
      content:
        'You are a helpful AI assistant. Be natural, concise, and friendly. Only mention framework features if directly relevant to the question.',
      alwaysInclude: true,
    },
    {
      id: 'greeting',
      name: 'Greeting Guide',
      content:
        'Greet users warmly and briefly. Keep it short - just say hello and ask how you can help.',
      topics: ['greeting'],
    },
    {
      id: 'help',
      name: 'Help Documentation',
      content:
        'When users need help, explain features naturally. This demo showcases: content moderation, rate limiting, intent classification, context optimization, and streaming responses. Be helpful, not sales-y.',
      topics: ['help'],
    },
    {
      id: 'questions',
      name: 'Q&A Guide',
      content: 'Answer questions thoroughly and naturally. Be informative but conversational.',
      topics: ['question'],
    },
    {
      id: 'feedback',
      name: 'Feedback Guide',
      content:
        'Thank users for feedback genuinely. If relevant, mention the project is open-source on GitHub (emmanuel-adu/ai-pipeline-orchestrator).',
      topics: ['feedback'],
    },
    {
      id: 'goodbye',
      name: 'Goodbye Guide',
      content: 'Say goodbye warmly. Keep it brief and friendly.',
      topics: ['goodbye'],
    },
  ],
  strategy: {
    firstMessage: 'selective', // Only load relevant sections
    followUp: 'selective', // Optimize based on intent
  },
})

function showHelp() {
  console.log()
  console.log(`${colors.bright}Available Commands:${colors.reset}`)
  console.log()
  console.log(`  ${colors.cyan}/help${colors.reset}     - Show this help message`)
  console.log(`  ${colors.cyan}/clear${colors.reset}    - Clear conversation history`)
  console.log(`  ${colors.cyan}/history${colors.reset}  - Show conversation history`)
  console.log(`  ${colors.cyan}/exit${colors.reset}     - Exit the chat`)
  console.log()
  console.log(`${colors.gray}Or just type your message and press Enter to chat!${colors.reset}`)
  console.log()
}

function showHistory(messages: Message[]) {
  if (messages.length === 0) {
    console.log()
    console.log(`${colors.gray}No conversation history yet${colors.reset}`)
    console.log()
    return
  }

  console.log()
  console.log(`${colors.bright}Conversation History (${messages.length} messages):${colors.reset}`)
  console.log()

  messages.forEach((msg, idx) => {
    const label =
      msg.role === 'user'
        ? `${colors.cyan}You${colors.reset}`
        : `${colors.magenta}Bot${colors.reset}`

    const content = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content

    console.log(`${colors.gray}${idx + 1}.${colors.reset} ${label}: ${content}`)
  })

  console.log()
}

function showHeader(aiProvider: string, aiModel: string, classifierProvider?: string) {
  console.log(
    `${colors.bright}${colors.blue}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`
  )
  console.log(
    `${colors.bright}${colors.blue}║  🤖 AI Pipeline Orchestrator - Ultimate Demo                     ║${colors.reset}`
  )
  console.log(
    `${colors.bright}${colors.blue}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`
  )
  console.log()
  console.log(
    `${colors.gray}Chat Provider: ${colors.bright}${aiProvider}${colors.reset}${colors.gray} | Model: ${colors.bright}${aiModel}${colors.reset}`
  )
  if (classifierProvider) {
    console.log(
      `${colors.gray}Intent Classifier: ${colors.bright}${classifierProvider}${colors.reset}${colors.gray} (Hybrid: keyword → LLM fallback)${colors.reset}`
    )
  } else {
    console.log(
      `${colors.gray}Intent Classifier: ${colors.bright}Keyword-only${colors.reset}${colors.gray} (upgrade with LLM fallback available)${colors.reset}`
    )
  }
  console.log()
  console.log(`${colors.bright}${colors.green}✅ Features Active:${colors.reset}`)
  console.log(
    `${colors.gray}   • Content Moderation ${colors.reset}${colors.dim}(blocks spam/inappropriate)${colors.reset}`
  )
  console.log(
    `${colors.gray}   • Rate Limiting ${colors.reset}${colors.dim}(10 requests/minute)${colors.reset}`
  )
  console.log(
    `${colors.gray}   • Intent Classification ${colors.reset}${colors.dim}(5 categories)${colors.reset}`
  )
  console.log(
    `${colors.gray}   • Context Optimization ${colors.reset}${colors.dim}(30-50% token savings)${colors.reset}`
  )
  console.log(
    `${colors.gray}   • Real-Time Streaming ${colors.reset}${colors.dim}(fast responses)${colors.reset}`
  )
  console.log(
    `${colors.gray}   • Token Usage Tracking ${colors.reset}${colors.dim}(see what you use)${colors.reset}`
  )
  console.log()
  console.log(
    `${colors.bright}${colors.cyan}💡 Try these:${colors.reset} ${colors.dim}"Hello!" • "I need help" • "What's the weather?"${colors.reset}`
  )
  console.log()
  console.log(
    `${colors.gray}Commands: ${colors.cyan}/clear${colors.gray} • ${colors.cyan}/history${colors.gray} • ${colors.cyan}/help${colors.gray} • ${colors.cyan}/exit${colors.reset}`
  )
  console.log()
}

function showMetadata(
  moderation: any,
  rateLimit: any,
  intent: any,
  promptContext: any,
  aiResponse: any,
  aiProvider: string,
  aiModel: string,
  intentProvider: string,
  intentModel: string
) {
  console.log()
  console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}`)

  // Single-line status indicators
  const moderationStatus = moderation?.flagged
    ? `${colors.red}⚠ Flagged${colors.reset}`
    : `${colors.green}✓ Clean${colors.reset}`
  const requestsLeft = 10 - (rateLimit?.currentCount || 1)
  const rateLimitStatus = `${colors.green}✓${colors.reset} ${colors.dim}${requestsLeft} left${colors.reset}`

  console.log(
    `${colors.dim}Moderation: ${moderationStatus}  •  Rate Limit: ${rateLimitStatus}${colors.reset}`
  )

  // Intent on one line
  if (intent?.intent) {
    const method = intent.method === 'llm' ? `🤖 ${intentModel}` : '⚡ Keyword'
    const confidenceColor =
      intent.confidence >= 0.7
        ? colors.green
        : intent.confidence >= 0.5
          ? colors.yellow
          : colors.red
    const confidence =
      intent.confidence !== undefined
        ? ` ${confidenceColor}${(intent.confidence * 100).toFixed(0)}%${colors.reset}`
        : ''
    console.log(
      `${colors.dim}Intent: ${colors.cyan}${intent.intent}${colors.reset} ${colors.dim}(${method})${confidence}${colors.reset}`
    )
  }

  // Context optimization - compact
  if (promptContext?.sectionsIncluded?.length > 0) {
    const sections = promptContext.sectionsIncluded.join(', ')
    let contextLine = `${colors.dim}Context: ${colors.cyan}${promptContext.sectionsIncluded.length}${colors.reset}${colors.dim}/${promptContext.totalSections || promptContext.sectionsIncluded.length} sections${colors.reset}`

    // Token savings on same line
    if (promptContext.maxTokenEstimate && promptContext.tokenEstimate) {
      const maxTokens = promptContext.maxTokenEstimate
      const actualTokens = promptContext.tokenEstimate
      const tokensSaved = maxTokens - actualTokens

      if (tokensSaved > 0) {
        const percentage = ((tokensSaved / maxTokens) * 100).toFixed(0)
        contextLine += ` ${colors.green}→ ${percentage}% saved${colors.reset} ${colors.dim}(${actualTokens}/${maxTokens} tokens)${colors.reset}`
      }
    }
    console.log(contextLine)
  }

  // Tokens - compact view with models
  const classificationMethod = intent?.method || 'keyword'
  const classificationTokens = intent?.llmTokens || intent?.usage?.totalTokens || 0

  if (aiResponse?.usage) {
    const usage = aiResponse.usage
    const promptTokens = usage.promptTokens ?? usage.inputTokens ?? 0
    const completionTokens = usage.completionTokens ?? usage.outputTokens ?? 0
    const totalChatTokens = usage.totalTokens ?? promptTokens + completionTokens
    const grandTotal = classificationTokens + totalChatTokens

    // One line token summary with model info
    let tokenLine = `${colors.dim}Tokens: ${colors.bright}${grandTotal}${colors.reset}`

    if (classificationMethod === 'llm') {
      tokenLine += ` ${colors.dim}(${colors.yellow}${classificationTokens}${colors.reset}${colors.dim} ${intentModel} + ${colors.blue}${totalChatTokens}${colors.reset}${colors.dim} ${aiModel})${colors.reset}`
    } else {
      tokenLine += ` ${colors.dim}(${colors.green}0${colors.reset}${colors.dim} keyword + ${colors.blue}${totalChatTokens}${colors.reset}${colors.dim} ${aiModel})${colors.reset}`
    }

    console.log(tokenLine)
  }

  console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}`)
}

async function chat() {
  const { aiProvider, aiModel, intentProvider, intentModel } = getEnvConfig()
  const aiConfig = getProviderCredentials(aiProvider)
  const intentConfig = getProviderCredentials(intentProvider)

  // Initialize LLM classifier for hybrid fallback
  // Uses separate intent provider/model if specified, otherwise uses same as chat
  // Use TextLLMIntentClassifier for Ollama (doesn't support structured output)
  // Use regular LLMIntentClassifier for other providers (supports structured output)
  const categories = ['greeting', 'help', 'goodbye', 'question', 'feedback', 'general']
  const categoryDescriptions = {
    greeting: 'User is greeting or saying hello',
    help: 'User needs help or support',
    goodbye: 'User is saying goodbye or leaving',
    question: 'User is asking a question',
    feedback: 'User is providing feedback or suggestions',
    general: "General conversation that doesn't fit other categories",
  }

  // Use LLMIntentClassifier for all providers (works with ollama-ai-provider-v2)
  // Note: If using older Ollama models without structured output support,
  // use TextLLMIntentClassifier instead
  const llmClassifier = new LLMIntentClassifier({
    provider: intentProvider,
    model: intentModel,
    apiKey: intentConfig.apiKey,
    baseURL: intentConfig.baseURL,
    categories,
    categoryDescriptions,
  })

  const messages: Message[] = []

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}You${colors.reset} > `,
  })

  // Clear screen and show header
  console.clear()
  showHeader(aiProvider, aiModel, intentProvider) // Show LLM classifier provider

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log()
    console.log(`${colors.yellow}👋 Goodbye!${colors.reset}`)
    process.exit(0)
  })

  // Show initial prompt
  rl.prompt()

  rl.on('line', async input => {
    const userMessage = input.trim()

    // Handle empty input
    if (!userMessage) {
      rl.prompt()
      return
    }

    // Handle commands
    if (userMessage.startsWith('/')) {
      const cmd = userMessage.toLowerCase()

      switch (cmd) {
        case '/help':
          showHelp()
          break

        case '/clear':
          console.clear()
          showHeader(aiProvider, aiModel, intentProvider)
          console.log(`${colors.green}✓ Conversation cleared${colors.reset}`)
          messages.length = 0
          break

        case '/history':
          showHistory(messages)
          break

        case '/exit':
        case '/quit':
          console.log(`${colors.yellow}👋 Goodbye!${colors.reset}`)
          process.exit(0)
          break

        default:
          console.log(`${colors.red}Unknown command: ${userMessage}${colors.reset}`)
          console.log(`${colors.gray}Type /help for available commands${colors.reset}`)
      }

      console.log()
      rl.prompt()
      return
    }

    messages.push({ role: 'user', content: userMessage })

    const context: OrchestrationContext = {
      request: {
        messages: [...messages],
        metadata: { userId: 'cli-user' },
      },
    }

    // Show "thinking" indicator
    process.stdout.write(
      `\n${colors.magenta}Bot${colors.reset} > ${colors.dim}Thinking...${colors.reset}`
    )

    let isFirstChunk = true

    try {
      const result = await executeOrchestration(
        context,
        [
          {
            name: 'moderation',
            handler: createModerationHandler({
              spamPatterns: ['buy now', 'click here', 'limited time', 'act now'],
              customRules: [{ pattern: /spam/i, reason: 'Spam detected' }],
              logger: silentLogger,
            }),
          },
          {
            name: 'rateLimit',
            handler: createRateLimitHandler({
              limiter: demoRateLimiter,
              identifierKey: 'userId',
              logger: silentLogger,
            }),
          },
          {
            name: 'rateLimitTracking',
            handler: async ctx => {
              // Track current request count for display
              const userId = ctx.request.metadata?.userId as string
              const current = requestCounts.get(userId)
              return {
                ...ctx,
                rateLimitInfo: {
                  currentCount: current?.count || 1,
                  limit: 10,
                },
              }
            },
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
              logger: silentLogger,
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
              logger: silentLogger,
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
              logger: silentLogger,
              getSystemPrompt: ctx => {
                const promptContext = ctx.promptContext as { systemPrompt?: string }
                const intent = ctx.intent as { metadata?: { tone?: string } }

                let systemPrompt = promptContext?.systemPrompt || ''

                if (intent?.metadata?.tone) {
                  systemPrompt += `\n\nTone: ${intent.metadata.tone}`
                }

                return systemPrompt
              },
              onChunk: chunk => {
                // Clear "thinking" line on first chunk
                if (isFirstChunk) {
                  readline.clearLine(process.stdout, 0)
                  readline.cursorTo(process.stdout, 0)
                  process.stdout.write(`${colors.magenta}Bot${colors.reset} > `)
                  isFirstChunk = false
                }
                process.stdout.write(chunk)
              },
            }),
          },
        ],
        {
          logger: silentLogger,
        }
      )

      if (result.success) {
        const aiResponse = result.context.aiResponse as { text?: string; usage?: any }
        if (aiResponse?.text) {
          messages.push({ role: 'assistant', content: aiResponse.text })

          // Show metadata
          showMetadata(
            result.context.moderation,
            result.context.rateLimitInfo,
            result.context.intent,
            result.context.promptContext,
            aiResponse,
            aiProvider,
            aiModel,
            intentProvider,
            intentModel
          )
        }
      } else {
        // Clear "thinking" line on error
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        console.log(`${colors.red}❌ Error: ${result.error?.message}${colors.reset}`)
        if (process.env.NODE_ENV === 'development' && result.error?.details) {
          console.log(`${colors.dim}Details: ${result.error.details}${colors.reset}`)
        }
        messages.pop() // Remove failed message
      }
    } catch (error) {
      // Clear "thinking" line on exception
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      console.log(
        `${colors.red}❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}${colors.reset}`
      )
      if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
        console.log(`${colors.dim}${error.stack.split('\n').slice(0, 3).join('\n')}${colors.reset}`)
      }
      messages.pop() // Remove failed message
    }

    console.log()
    rl.prompt()
  })
}

chat().catch(console.error)
