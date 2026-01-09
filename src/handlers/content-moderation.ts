import type { OrchestrationContext, OrchestrationHandler } from '../core/types'
import { consoleLogger, type Logger } from '../utils/logger'

export interface ModerationRule {
  pattern: RegExp
  reason: string
}

export interface ModerationConfig {
  spamPatterns?: string[]
  profanityWords?: string[]
  customRules?: ModerationRule[]
  outputKey?: string
  logger?: Logger
}

const DEFAULT_SPAM_PATTERNS = [
  /(.)\1{10,}/i,
  /^[A-Z\s!]{20,}$/,
]

/**
 * Creates content moderation handler for spam and profanity filtering.
 */
export function createModerationHandler(
  config: ModerationConfig = {}
): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const outputKey = config.outputKey ?? 'contentModeration'

  const spamPatterns = config.spamPatterns?.map((p) => new RegExp(p, 'i')) ?? DEFAULT_SPAM_PATTERNS
  const profanityWords = config.profanityWords ?? []
  const customRules = config.customRules ?? []

  return async (context: OrchestrationContext) => {
    const messages = context.request.messages
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || lastMessage.role !== 'user') {
      return {
        ...context,
        [outputKey]: {
          passed: true,
        },
      }
    }

    const content =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : Array.isArray(lastMessage.content)
          ? lastMessage.content
              .map((part) => (typeof part === 'string' ? part : part.text || ''))
              .join(' ')
          : ''

    try {
      for (const pattern of spamPatterns) {
        if (pattern.test(content)) {
          logger.warn(
            {
              reason: 'spam_pattern',
              pattern: pattern.source,
            },
            'Content moderation failed'
          )

          return {
            ...context,
            [outputKey]: {
              passed: false,
              reason: 'Message appears to be spam',
            },
            error: {
              message: 'Your message was flagged as inappropriate. Please try again.',
              statusCode: 400,
              step: 'contentModeration',
            },
          }
        }
      }

      const lowerContent = content.toLowerCase()
      for (const word of profanityWords) {
        if (lowerContent.includes(word.toLowerCase())) {
          logger.warn(
            {
              reason: 'profanity',
              word,
            },
            'Content moderation failed'
          )

          return {
            ...context,
            [outputKey]: {
              passed: false,
              reason: 'Message contains inappropriate language',
            },
            error: {
              message: 'Your message contains inappropriate language. Please revise and try again.',
              statusCode: 400,
              step: 'contentModeration',
            },
          }
        }
      }

      for (const rule of customRules) {
        if (rule.pattern.test(content)) {
          logger.warn(
            {
              reason: 'custom_rule',
              rule: rule.reason,
            },
            'Content moderation failed'
          )

          return {
            ...context,
            [outputKey]: {
              passed: false,
              reason: rule.reason,
            },
            error: {
              message: 'Your message was flagged as inappropriate. Please try again.',
              statusCode: 400,
              step: 'contentModeration',
            },
          }
        }
      }

      return {
        ...context,
        [outputKey]: {
          passed: true,
        },
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Content moderation check failed - allowing message'
      )

      return {
        ...context,
        [outputKey]: {
          passed: true,
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }
}
