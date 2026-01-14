import type { ContextOptimizer } from '../context/optimizer'
import type { OrchestrationContext, OrchestrationHandler } from '../core/types'
import { consoleLogger, type Logger } from '../utils/logger'

export interface ContextHandlerConfig {
  optimizer: ContextOptimizer
  getTopics?: (context: OrchestrationContext) => string[]
  isFirstMessage?: (context: OrchestrationContext) => boolean
  getTone?: (context: OrchestrationContext) => string | undefined
  outputKey?: string
  logger?: Logger
}

/**
 * Creates context building handler for dynamic prompt generation.
 */
export function createContextHandler(config: ContextHandlerConfig): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const outputKey = config.outputKey ?? 'promptContext'

  return async (context: OrchestrationContext) => {
    try {
      const topics = config.getTopics?.(context) ?? []
      const isFirstMessage =
        config.isFirstMessage?.(context) ?? context.request.messages.length === 1
      const tone = config.getTone?.(context)

      const result = config.optimizer.build(topics, isFirstMessage, tone)

      logger.debug(
        {
          topics,
          isFirstMessage,
          tone,
          sectionsIncluded: result.sectionsIncluded,
          tokenEstimate: result.tokenEstimate,
        },
        'Context built successfully'
      )

      return {
        ...context,
        [outputKey]: result,
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Context building failed'
      )

      return context
    }
  }
}
