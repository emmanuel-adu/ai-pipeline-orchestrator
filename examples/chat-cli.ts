#!/usr/bin/env node
/**
 * Interactive Chat CLI
 *
 * This is the COMPLETE showcase of ai-pipeline-orchestrator featuring:
 *
 * Content Moderation - Blocks spam and inappropriate content
 * Rate Limiting - Prevents abuse (demo: 10 requests/minute)
 * Hybrid Intent Classification - Keyword matching with LLM fallback
 * Dynamic Context Optimization - Loads only relevant context (30-50% token savings)
 * Multi-Provider Support - Works with Anthropic, OpenAI, Ollama
 * Real-Time Streaming - Fast, responsive AI responses
 * Token Usage Tracking - See exactly what you're using
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

// Analytics tracking for demonstration
interface AnalyticsEvent {
  type: 'intent_fallback'
  data: {
    message: string
    keywordIntent: string
    keywordConfidence: number
    llmIntent: string
    llmConfidence: number
  }
}

let lastAnalyticsEvent: AnalyticsEvent | null = null

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
  toneInstructions: {
    'Be warm, welcoming, and enthusiastic': 'Use an upbeat and friendly tone',
    'Be patient, clear, and provide actionable guidance':
      'Be instructive and supportive with clear step-by-step guidance',
    'Be friendly and leave a positive impression': 'End on a warm and positive note',
    'Be informative and thorough in your explanation':
      'Provide comprehensive answers with examples when helpful',
    'Be appreciative and show you value their input':
      'Express genuine appreciation for their feedback',
    'Be helpful, friendly, and conversational': 'Keep the conversation natural and engaging',
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
    console.log(`${colors.dim}╭${'─'.repeat(68)}╮${colors.reset}`)
    console.log(
      `${colors.dim}│${colors.reset} ${colors.gray}No conversation history yet${colors.reset}`.padEnd(
        70
      ) + `${colors.dim}│${colors.reset}`
    )
    console.log(`${colors.dim}╰${'─'.repeat(68)}╯${colors.reset}`)
    console.log()
    return
  }

  console.log()
  console.log(
    `${colors.bright}📝 Conversation History${colors.reset} ${colors.dim}(${messages.length} messages)${colors.reset}`
  )
  console.log()
  console.log(`${colors.dim}╭${'─'.repeat(68)}╮${colors.reset}`)

  messages.forEach((msg, idx) => {
    const label =
      msg.role === 'user'
        ? `${colors.cyan}You${colors.reset}`
        : `${colors.magenta}Bot${colors.reset}`

    const contentText = typeof msg.content === 'string' ? msg.content : '[multipart message]'
    const content = contentText.length > 80 ? contentText.substring(0, 80) + '...' : contentText

    console.log(
      `${colors.dim}│${colors.reset} ${colors.gray}${(idx + 1).toString().padStart(2)}${colors.reset}. ${label}: ${content}`
    )

    if (idx < messages.length - 1) {
      console.log(`${colors.dim}│${colors.reset}`)
    }
  })

  console.log(`${colors.dim}╰${'─'.repeat(68)}╯${colors.reset}`)
  console.log()
}

function showHeader(aiProvider: string, aiModel: string, classifierProvider?: string) {
  console.log(
    `${colors.bright}${colors.blue}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`
  )
  console.log(
    `${colors.bright}${colors.blue}║  🤖 AI Pipeline Orchestrator - Interactive Demo                  ║${colors.reset}`
  )
  console.log(
    `${colors.bright}${colors.blue}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`
  )
  console.log()
  console.log(
    `${colors.dim}Chat:${colors.reset}   ${colors.bright}${aiProvider}${colors.reset} ${colors.dim}•${colors.reset} ${aiModel}`
  )
  if (classifierProvider) {
    console.log(
      `${colors.dim}Intent:${colors.reset} ${colors.bright}${classifierProvider}${colors.reset} ${colors.dim}(hybrid: keyword → LLM fallback)${colors.reset}`
    )
  } else {
    console.log(`${colors.dim}Intent:${colors.reset} ${colors.bright}Keyword-only${colors.reset}`)
  }
  console.log()
  console.log(`${colors.bright}${colors.green}✅ Active Features${colors.reset}`)
  console.log()
  console.log(
    `   ${colors.green}✓${colors.reset} Content Moderation      ${colors.dim}blocks spam/inappropriate content${colors.reset}`
  )
  console.log(
    `   ${colors.green}✓${colors.reset} Rate Limiting           ${colors.dim}10 requests per minute${colors.reset}`
  )
  console.log(
    `   ${colors.green}✓${colors.reset} Intent Classification   ${colors.dim}5 categories with hybrid detection${colors.reset}`
  )
  console.log(
    `   ${colors.green}✓${colors.reset} Context Optimization    ${colors.dim}30-50% token savings${colors.reset}`
  )
  console.log(
    `   ${colors.green}✓${colors.reset} Tone Injection          ${colors.dim}intent-based response customization${colors.reset}`
  )
  console.log(
    `   ${colors.green}✓${colors.reset} Analytics Tracking      ${colors.dim}intent fallback monitoring${colors.reset}`
  )
  console.log(
    `   ${colors.green}✓${colors.reset} Real-Time Streaming     ${colors.dim}fast, responsive AI responses${colors.reset}`
  )
  console.log()
  console.log(
    `${colors.bright}${colors.cyan}💡 Try:${colors.reset} ${colors.dim}"Hello!" • "I need help" • "What's the weather?"${colors.reset}`
  )
  console.log()
  console.log(
    `${colors.dim}Commands: ${colors.cyan}/clear${colors.dim} • ${colors.cyan}/history${colors.dim} • ${colors.cyan}/help${colors.dim} • ${colors.cyan}/exit${colors.reset}`
  )
  console.log()
}

function showMetadata(
  moderation: any,
  rateLimit: any,
  intent: any,
  promptContext: any,
  aiResponse: any,
  aiModel: string,
  intentModel: string
) {
  console.log()
  console.log(`${colors.dim}╭${'─'.repeat(68)}╮${colors.reset}`)

  // Helper to strip ANSI codes and calculate display width
  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '')
  const getDisplayWidth = (str: string) => {
    const cleaned = stripAnsi(str)
    let width = 0
    for (const char of cleaned) {
      const code = char.codePointAt(0) || 0
      // Wide characters that take 2 columns (emojis and some symbols)
      // These are typically rendered as double-width in terminals
      if (
        (code >= 0x1f300 && code <= 0x1f9ff) || // Emoji range (🤖 robot, etc)
        code === 0x26a0 || // ⚠ warning sign
        code === 0x26a1 // ⚡ lightning bolt
      ) {
        width += 2
      } else {
        width += 1
      }
    }
    return width
  }
  const padLine = (content: string, width: number = 69) => {
    const contentWidth = getDisplayWidth(content)
    const padding = Math.max(0, width - contentWidth)
    return content + ' '.repeat(padding)
  }

  const lines: string[] = []

  // Moderation & Rate Limit
  const moderationStatus = moderation?.flagged
    ? `${colors.red}⚠  Flagged${colors.reset}`
    : `${colors.green}✓  Clean${colors.reset}`
  const requestsLeft = 10 - (rateLimit?.currentCount || 1)
  const rateLimitStatus = `${colors.green}✓${colors.reset} ${requestsLeft}/10 requests`

  lines.push(
    padLine(
      `${colors.dim}│${colors.reset} ${colors.bright}Moderation:${colors.reset} ${moderationStatus}         ${colors.bright}Rate Limit:${colors.reset} ${rateLimitStatus}`
    )
  )

  // Intent
  if (intent?.intent) {
    const method = intent.method === 'llm' ? `🤖 ${intentModel}` : '⚡ Keyword'
    const confidenceColor =
      intent.confidence >= 0.7
        ? colors.green
        : intent.confidence >= 0.5
          ? colors.yellow
          : colors.red
    const confidenceText =
      intent.confidence !== undefined
        ? `${confidenceColor}${(intent.confidence * 100).toFixed(0)}%${colors.reset}`
        : 'N/A'

    lines.push(
      padLine(
        `${colors.dim}│${colors.reset} ${colors.bright}Intent:${colors.reset}     ${colors.cyan}${intent.intent}${colors.reset} ${colors.dim}via${colors.reset} ${method} ${colors.dim}(${confidenceText}${colors.dim})${colors.reset}`
      )
    )
  }

  // Context optimization
  if (promptContext?.sectionsIncluded?.length > 0) {
    const sectionsText = `${colors.cyan}${promptContext.sectionsIncluded.length}${colors.reset}${colors.dim}/${promptContext.totalSections || promptContext.sectionsIncluded.length}${colors.reset} sections`

    if (promptContext.maxTokenEstimate && promptContext.tokenEstimate) {
      const maxTokens = promptContext.maxTokenEstimate
      const actualTokens = promptContext.tokenEstimate
      const tokensSaved = maxTokens - actualTokens

      if (tokensSaved > 0) {
        const percentage = ((tokensSaved / maxTokens) * 100).toFixed(0)
        lines.push(
          padLine(
            `${colors.dim}│${colors.reset} ${colors.bright}Context:${colors.reset}    ${sectionsText} ${colors.green}→ ${percentage}% saved${colors.reset} ${colors.dim}(${actualTokens}/${maxTokens} tokens)${colors.reset}`
          )
        )
      } else {
        lines.push(
          padLine(
            `${colors.dim}│${colors.reset} ${colors.bright}Context:${colors.reset}    ${sectionsText}`
          )
        )
      }
    } else {
      lines.push(
        padLine(
          `${colors.dim}│${colors.reset} ${colors.bright}Context:${colors.reset}    ${sectionsText}`
        )
      )
    }
  }

  // Tone injection
  if (intent?.metadata?.tone) {
    lines.push(
      padLine(
        `${colors.dim}│${colors.reset} ${colors.bright}Tone:${colors.reset}       ${colors.cyan}${intent.metadata.tone}${colors.reset} ${colors.dim}(applied to response)${colors.reset}`
      )
    )
  }

  // Analytics events
  if (lastAnalyticsEvent) {
    const event = lastAnalyticsEvent
    if (event.type === 'intent_fallback') {
      const keywordConf = (event.data.keywordConfidence * 100).toFixed(0)
      const llmConf = (event.data.llmConfidence * 100).toFixed(0)
      lines.push(
        padLine(
          `${colors.dim}│${colors.reset} ${colors.bright}Fallback:${colors.reset}   ${colors.yellow}⚡→🤖${colors.reset} ${colors.dim}keyword ${keywordConf}% → LLM ${llmConf}%${colors.reset}`
        )
      )
    }
  }

  // Tokens
  const classificationMethod = intent?.method || 'keyword'
  const classificationTokens = intent?.llmTokens || intent?.usage?.totalTokens || 0

  if (aiResponse?.usage) {
    const usage = aiResponse.usage
    const promptTokens = usage.promptTokens ?? usage.inputTokens ?? 0
    const completionTokens = usage.completionTokens ?? usage.outputTokens ?? 0
    const totalChatTokens = usage.totalTokens ?? promptTokens + completionTokens
    const grandTotal = classificationTokens + totalChatTokens

    if (classificationMethod === 'llm') {
      lines.push(
        padLine(
          `${colors.dim}│${colors.reset} ${colors.bright}Tokens:${colors.reset}     ${colors.bright}${grandTotal.toLocaleString()}${colors.reset} ${colors.dim}total${colors.reset} ${colors.dim}(${colors.yellow}${classificationTokens}${colors.reset} ${colors.dim}intent +${colors.reset} ${colors.blue}${totalChatTokens}${colors.reset} ${colors.dim}chat)${colors.reset}`
        )
      )
    } else {
      lines.push(
        padLine(
          `${colors.dim}│${colors.reset} ${colors.bright}Tokens:${colors.reset}     ${colors.bright}${grandTotal.toLocaleString()}${colors.reset} ${colors.dim}total${colors.reset} ${colors.dim}(${colors.green}0${colors.reset} ${colors.dim}intent +${colors.reset} ${colors.blue}${totalChatTokens}${colors.reset} ${colors.dim}chat)${colors.reset}`
        )
      )
    }
  }

  lines.forEach(line => console.log(line + `${colors.dim}│${colors.reset}`))
  console.log(`${colors.dim}╰${'─'.repeat(68)}╯${colors.reset}`)
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

    // Show animated "thinking" indicator
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let spinnerIndex = 0
    process.stdout.write(`\n${colors.magenta}Bot${colors.reset} > `)
    const spinnerInterval = setInterval(() => {
      process.stdout.write(
        `\r${colors.magenta}Bot${colors.reset} > ${colors.cyan}${spinnerFrames[spinnerIndex]}${colors.reset} ${colors.dim}Thinking...${colors.reset}`
      )
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
    }, 80)

    let isFirstChunk = true

    // Reset analytics tracking
    lastAnalyticsEvent = null

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
              getTone: ctx => {
                const intent = ctx.intent as { metadata?: { tone?: string } }
                return intent?.metadata?.tone
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
                return promptContext?.systemPrompt || ''
              },
              onChunk: chunk => {
                // Clear spinner and "thinking" line on first chunk
                if (isFirstChunk) {
                  clearInterval(spinnerInterval)
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
          onIntentFallback: data => {
            // Track when LLM fallback is triggered
            lastAnalyticsEvent = {
              type: 'intent_fallback',
              data: {
                message: data.message,
                keywordIntent: data.keywordIntent,
                keywordConfidence: data.keywordConfidence,
                llmIntent: data.llmIntent,
                llmConfidence: data.llmConfidence,
              },
            }
          },
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
            aiModel,
            intentModel
          )
        }
      } else {
        // Clear spinner and "thinking" line on error
        clearInterval(spinnerInterval)
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        console.log(`${colors.red}❌ Error: ${result.error?.message}${colors.reset}`)
        if (process.env.NODE_ENV === 'development' && result.error?.details) {
          console.log(`${colors.dim}Details: ${result.error.details}${colors.reset}`)
        }
        messages.pop() // Remove failed message
      }
    } catch (error) {
      // Clear spinner and "thinking" line on exception
      clearInterval(spinnerInterval)
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
