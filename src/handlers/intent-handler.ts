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
  /**
   * Classification strategy.
   * - 'keyword-first' (default): classify by keyword match; call the LLM only when
   *   confidence is below confidenceThreshold and llmFallback.enabled is true.
   * - 'llm-primary': always classify via llmFallback.classifier. The keyword classifier
   *   is only used as a fallback if the LLM call itself fails, and for tone/deepLink
   *   metadata lookup. Requires llmFallback.enabled to be true.
   */
  mode?: 'keyword-first' | 'llm-primary'
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
 * Creates intent detection handler with keyword, LLM, or hybrid classification -
 * see IntentHandlerConfig.mode.
 *
 * Keyword matching algorithm:
 * - Scoring: Each keyword match adds points equal to the keyword's word count.
 * - Single-word keywords (e.g., "hello") score 1 point
 * - Multi-word keywords (e.g., "help me") score 2 points
 *
 * - Selection: The category with the highest score wins. Confidence is calculated as the margin between the best and second-best scores, normalized to 0-1.
 */
export function createIntentHandler(config: IntentHandlerConfig): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const mode = config.mode ?? 'keyword-first'
  const confidenceThreshold = config.llmFallback?.confidenceThreshold ?? 0.5
  const contextKey = config.contextKey ?? 'intent'

  if (mode === 'llm-primary' && !config.llmFallback?.enabled) {
    throw new Error(
      "createIntentHandler: mode 'llm-primary' requires llmFallback.enabled to be true and llmFallback.classifier to be set"
    )
  }

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

      const useLLM =
        config.llmFallback?.enabled &&
        (mode === 'llm-primary' || keywordResult.confidence < confidenceThreshold)

      if (!useLLM) {
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
          [contextKey]: {
            ...keywordResult,
            method: 'keyword',
          },
        }
      }

      logger.debug(
        mode === 'llm-primary'
          ? { threshold: confidenceThreshold }
          : {
              keywordIntent: keywordResult.intent,
              keywordConfidence: keywordResult.confidence,
              threshold: confidenceThreshold,
            },
        mode === 'llm-primary'
          ? 'Classifying intent via LLM (llm-primary mode)'
          : 'Keyword confidence low - using LLM fallback'
      )

      const llmResult = await config.llmFallback!.classifier.classify(content)

      // If LLM classification failed (0 confidence with error message), fall back to keyword result
      const hasError =
        llmResult.reasoning &&
        (llmResult.reasoning.includes('failed') ||
          llmResult.reasoning.includes('Error') ||
          llmResult.reasoning.includes('Unsupported') ||
          llmResult.reasoning.includes('not available'))

      if (llmResult.confidence === 0 && hasError) {
        logger.warn(
          {
            error: llmResult.reasoning,
            fallingBackTo: 'keyword',
          },
          'LLM classification failed - using keyword result'
        )

        return {
          ...context,
          [contextKey]: {
            ...keywordResult,
            method: 'keyword',
            metadata: {
              ...keywordResult.metadata,
              llmFallbackAttempted: true,
              llmError: llmResult.reasoning,
            },
          },
        }
      }

      if (config.onFallback && mode !== 'llm-primary') {
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
          method: mode,
          reasoning: llmResult.reasoning,
        },
        mode === 'llm-primary' ? 'Intent detected via LLM' : 'Intent detected via LLM fallback'
      )

      // Look up metadata for the LLM's detected intent from keyword classifier config
      // This ensures tones, deepLinks, and other metadata are preserved even when using LLM fallback
      const llmIntentMetadata = config.classifier.getMetadataForIntent(llmResult.intent)

      return {
        ...context,
        [contextKey]: {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          metadata: {
            ...llmIntentMetadata,
            classificationMethod: 'llm',
            reasoning: llmResult.reasoning,
          },
          method: 'llm',
          llmTokens: llmResult.usage?.totalTokens || 0,
          usage: llmResult.usage,
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
