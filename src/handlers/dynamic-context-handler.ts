import type { TTLCache } from '../context/cache'
import type { ContextLoader } from '../context/loader'
import type { ContextOptimizer } from '../context/optimizer'
import type { ContextSection } from '../context/types'
import type { OrchestrationContext, OrchestrationHandler } from '../core/types'
import { consoleLogger, type Logger } from '../utils/logger'

export interface DynamicContextHandlerConfig {
  loader: ContextLoader
  cache?: TTLCache<ContextSection[]>
  fallbackOptimizer?: ContextOptimizer
  getTopics?: (context: OrchestrationContext) => string[]
  isFirstMessage?: (context: OrchestrationContext) => boolean
  getTone?: (context: OrchestrationContext) => string | undefined
  getVariant?: (context: OrchestrationContext) => string | undefined
  onVariantUsed?: (data: { variant: string; topics: string[] }) => void | Promise<void>
  outputKey?: string
  logger?: Logger
}

/**
 * Creates dynamic context handler with caching support
 */
export function createDynamicContextHandler(
  config: DynamicContextHandlerConfig
): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const outputKey = config.outputKey ?? 'promptContext'

  return async (context: OrchestrationContext) => {
    try {
      const topics = config.getTopics?.(context) ?? []
      const isFirstMessage =
        config.isFirstMessage?.(context) ?? context.request.messages.length === 1
      const tone = config.getTone?.(context)

      let variant: string | undefined
      if (config.getVariant) {
        variant = config.getVariant(context)
        if (variant) {
          logger.debug({ variant }, 'Using context variant')

          if (config.onVariantUsed) {
            Promise.resolve(
              config.onVariantUsed({
                variant,
                topics,
              })
            ).catch((err: unknown) => {
              logger.error({ error: err }, 'Failed to log variant usage')
            })
          }
        }
      }

      let sections: ContextSection[]

      try {
        if (config.cache) {
          const cacheKey = `${variant || 'default'}`
          sections = await config.cache.getOrLoad(cacheKey, () =>
            config.loader.load({ topics, variant, isFirstMessage })
          )
          logger.debug({ cacheKey, sectionCount: sections.length }, 'Loaded from cache')
        } else {
          sections = await config.loader.load({ topics, variant, isFirstMessage })
          logger.debug({ sectionCount: sections.length }, 'Loaded sections')
        }
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to load dynamic contexts, using fallback'
        )

        if (config.fallbackOptimizer) {
          const result = config.fallbackOptimizer.build(topics, isFirstMessage, tone)
          return {
            ...context,
            [outputKey]: result,
          }
        }

        throw error
      }

      const useFullContext = isFirstMessage

      let selectedSections: ContextSection[]

      if (useFullContext) {
        selectedSections = sections
      } else {
        selectedSections = sections.filter(section => {
          if (section.alwaysInclude) return true

          if (!section.topics || section.topics.length === 0) return false

          return section.topics.some(topic => topics.includes(topic))
        })

        selectedSections.sort((a, b) => (b.priority || 0) - (a.priority || 0))
      }

      let systemPrompt = selectedSections.map(section => section.content).join('\n\n')

      if (tone && config.fallbackOptimizer?.['config']?.toneInstructions?.[tone]) {
        systemPrompt += '\n\n' + config.fallbackOptimizer['config'].toneInstructions[tone]
      }

      const tokenEstimate = Math.ceil(systemPrompt.length / 4)
      const allSectionsPrompt = sections.map(section => section.content).join('\n\n')
      const maxTokenEstimate = Math.ceil(allSectionsPrompt.length / 4)

      const result = {
        systemPrompt,
        sectionsIncluded: selectedSections.map(s => s.id),
        totalSections: sections.length,
        tokenEstimate,
        maxTokenEstimate,
        variant,
      }

      logger.debug(
        {
          topics,
          isFirstMessage,
          tone,
          variant,
          sectionsIncluded: result.sectionsIncluded,
          tokenEstimate: result.tokenEstimate,
        },
        'Dynamic context built successfully'
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
        'Dynamic context building failed'
      )

      return {
        ...context,
        error: {
          message: 'Failed to build context. Please try again.',
          statusCode: 500,
          step: 'dynamicContext',
          details: error instanceof Error ? error.message : undefined,
        },
      }
    }
  }
}
