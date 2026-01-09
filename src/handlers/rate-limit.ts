import type { OrchestrationContext, OrchestrationHandler } from '../core/types'
import { consoleLogger, type Logger } from '../utils/logger'

export interface RateLimiter {
  check(identifier: string): Promise<{
    allowed: boolean
    retryAfter?: number
  }>
}

export interface RateLimitHandlerConfig {
  limiter: RateLimiter
  identifierKey?: string
  getIdentifier?: (context: OrchestrationContext) => string
  outputKey?: string
  logger?: Logger
}

/**
 * Creates rate limiting handler to prevent abuse.
 */
export function createRateLimitHandler(
  config: RateLimitHandlerConfig
): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const outputKey = config.outputKey ?? 'rateLimit'

  return async (context: OrchestrationContext) => {
    try {
      const identifier =
        config.getIdentifier?.(context) ??
        (config.identifierKey
          ? (context.request.metadata?.[config.identifierKey] as string)
          : undefined) ??
        'anonymous'

      const result = await config.limiter.check(identifier)

      if (!result.allowed) {
        logger.warn(
          {
            identifier,
            retryAfter: result.retryAfter,
          },
          'Rate limit exceeded'
        )

        return {
          ...context,
          [outputKey]: result,
          error: {
            message: 'Too many requests. Please try again later.',
            statusCode: 429,
            retryAfter: result.retryAfter,
            step: 'rateLimit',
          },
        }
      }

      return {
        ...context,
        [outputKey]: result,
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Rate limit check failed - allowing request'
      )

      return {
        ...context,
        [outputKey]: {
          allowed: true,
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }
}
