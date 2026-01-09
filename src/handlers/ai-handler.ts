import type { OrchestrationContext, OrchestrationHandler } from '../core/types'
import { createModel, type ProviderConfig } from '../providers'
import { consoleLogger, type Logger } from '../utils/logger'

export interface AIHandlerConfig extends ProviderConfig {
  maxTokens?: number
  temperature?: number
  getSystemPrompt?: (context: OrchestrationContext) => string
  outputKey?: string
  logger?: Logger
}

export interface StreamingAIHandlerConfig extends AIHandlerConfig {
  onChunk: (chunk: string) => void | Promise<void>
}

/**
 * Creates AI generation handler.
 */
export function createAIHandler(config: AIHandlerConfig): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const outputKey = config.outputKey ?? 'aiResponse'

  return async (context: OrchestrationContext) => {
    try {
      const { generateText } = await import('ai')

      const systemPrompt = config.getSystemPrompt
        ? config.getSystemPrompt(context)
        : ((context.promptContext as { systemPrompt?: string })?.systemPrompt ?? '')

      if (!systemPrompt) {
        logger.warn({}, 'No system prompt found, using empty prompt')
      }

      const model = await createModel(config)

      logger.debug(
        {
          provider: config.provider,
          model: config.model,
          messageCount: context.request.messages.length,
        },
        'Calling AI model'
      )

      const startTime = Date.now()

      const response = await generateText({
        model,
        system: systemPrompt,
        messages: context.request.messages as any,
        ...(config.maxTokens && { maxTokens: config.maxTokens }),
        ...(config.temperature !== undefined && { temperature: config.temperature }),
      })

      const duration = Date.now() - startTime

      logger.info(
        {
          durationMs: duration,
          finishReason: response.finishReason,
          usage: response.usage,
        },
        'AI generation completed'
      )

      return {
        ...context,
        [outputKey]: {
          text: response.text,
          finishReason: response.finishReason,
          usage: response.usage,
        },
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'AI generation failed'
      )

      return {
        ...context,
        error: {
          message: 'Failed to generate AI response. Please try again.',
          statusCode: 500,
          step: 'aiGeneration',
          details: error instanceof Error ? error.message : undefined,
        },
      }
    }
  }
}

/**
 * Creates streaming AI generation handler.
 */
export function createStreamingAIHandler(config: StreamingAIHandlerConfig): OrchestrationHandler {
  const logger = config.logger ?? consoleLogger
  const outputKey = config.outputKey ?? 'aiResponse'

  return async (context: OrchestrationContext) => {
    try {
      const { streamText } = await import('ai')

      const systemPrompt = config.getSystemPrompt
        ? config.getSystemPrompt(context)
        : ((context.promptContext as { systemPrompt?: string })?.systemPrompt ?? '')

      if (!systemPrompt) {
        logger.warn({}, 'No system prompt found, using empty prompt')
      }

      const model = await createModel(config)

      logger.debug(
        {
          provider: config.provider,
          model: config.model,
          messageCount: context.request.messages.length,
        },
        'Starting AI streaming'
      )

      const startTime = Date.now()

      const result = await streamText({
        model,
        system: systemPrompt,
        messages: context.request.messages as any,
        ...(config.maxTokens && { maxTokens: config.maxTokens }),
        ...(config.temperature !== undefined && { temperature: config.temperature }),
      })

      let fullText = ''

      for await (const textPart of result.textStream) {
        fullText += textPart
        await Promise.resolve(config.onChunk(textPart))
      }

      const duration = Date.now() - startTime

      logger.info(
        {
          durationMs: duration,
          finishReason: result.finishReason,
          usage: result.usage,
        },
        'AI streaming completed'
      )

      return {
        ...context,
        [outputKey]: {
          text: fullText,
          finishReason: result.finishReason,
          usage: await result.usage,
        },
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'AI streaming failed'
      )

      return {
        ...context,
        error: {
          message: 'Failed to generate AI response. Please try again.',
          statusCode: 500,
          step: 'aiGeneration',
          details: error instanceof Error ? error.message : undefined,
        },
      }
    }
  }
}
