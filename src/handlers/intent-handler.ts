import type { OrchestrationContext, OrchestrationHandler } from '../core/types'
import type { IntentClassifier } from '../intent/classifier'
import type { LLMIntentClassifier } from '../intent/llm-classifier'
import { consoleLogger, type Logger } from '../utils/logger'

export interface IntentHandlerConfig {
  classifier: IntentClassifier
  llmFallback?: {
    enabled: boolean
    classifier: LLMIntentClassifier
    confidenceThreshold?: number
  }
  contextKey?: string
  onFallback?: (data: {
    message: string
    keywordIntent: string
    keywordConfidence: number
    llmIntent: string
    llmConfidence: number
    matchedKeywords?: string[]
  }) => void | Promise<void>
  logger?: Logger
}

/**
 * Creates intent detection handler with hybrid classification.
 * Uses keyword matching first, falls back to LLM if confidence is low and LLM is enabled.
 *
 * Keyword matching algorithm:
 * - Scoring: Each keyword match adds points equal to the keyword's word count.
 * - Single-word keywords (e.g., "hello") score 1 point
 * - Multi-word keywords (e.g., "help me") score 2 points
 *
 * - Selection: The category with the highest score wins. Confidence is calculated as the margin between the best and second-best scores, normalized to 0-1.
 *
 * Note: This is a simple heuristic. For production use, consider the LLM fallback option in createIntentHandler when confidence is low.
 */
export function createIntentHandler(config: IntentHandlerConfig): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const confidenceThreshold = config.llmFallback?.confidenceThreshold ?? 0.5
  const contextKey = config.contextKey ?? 'intent'

  return async (context: OrchestrationContext) => {
    const messages = context.request.messages
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || lastMessage.role !== 'user') {
      return {
        ...context,
        [contextKey]: {
          intent: 'general',
          confidence: 0,
        },
      }
    }

    const content =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : Array.isArray(lastMessage.content)
          ? lastMessage.content
              .map(part => (typeof part === 'string' ? part : part.text || ''))
              .join(' ')
          : ''

    try {
      const keywordResult = config.classifier.classify(content)

      if (keywordResult.confidence >= confidenceThreshold || !config.llmFallback?.enabled) {
        logger.debug(
          {
            intent: keywordResult.intent,
            confidence: keywordResult.confidence,
            matchedKeywords: keywordResult.matchedKeywords,
            method: 'keyword',
          },
          'Intent detected via keyword matching'
        )

        return {
          ...context,
          [contextKey]: keywordResult,
        }
      }

      logger.debug(
        {
          keywordIntent: keywordResult.intent,
          keywordConfidence: keywordResult.confidence,
          threshold: confidenceThreshold,
        },
        'Keyword confidence low - using LLM fallback'
      )

      const llmResult = await config.llmFallback.classifier.classify(content)

      if (config.onFallback) {
        Promise.resolve(
          config.onFallback({
            message: content,
            keywordIntent: keywordResult.intent,
            keywordConfidence: keywordResult.confidence,
            llmIntent: llmResult.intent,
            llmConfidence: llmResult.confidence,
            matchedKeywords: keywordResult.matchedKeywords,
          })
        ).catch((err: unknown) => {
          logger.error({ error: err }, 'Failed to log intent fallback')
        })
      }

      logger.debug(
        {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          method: 'llm-fallback',
          reasoning: llmResult.reasoning,
        },
        'Intent detected via LLM fallback'
      )

      return {
        ...context,
        [contextKey]: {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          metadata: {
            ...keywordResult.metadata,
            classificationMethod: 'llm',
            reasoning: llmResult.reasoning,
          },
        },
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Intent detection failed - using defaults'
      )

      return {
        ...context,
        [contextKey]: {
          intent: 'general',
          confidence: 0,
        },
      }
    }
  }
}
