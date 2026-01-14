import type { OrchestrationContext, OrchestrationResult, OrchestrationStep } from './types'

import { consoleLogger, type Logger } from '../utils/logger'

export interface IntentFallbackData {
  message: string
  keywordIntent: string
  keywordConfidence: number
  llmIntent: string
  llmConfidence: number
  llmReasoning?: string
}

export interface VariantUsageData {
  variant: string
  topics: string[]
}

export interface OrchestratorConfig {
  logger?: Logger
  onStepComplete?: (step: string, durationMs: number) => void
  onError?: (error: { step: string; message: string; statusCode: number; details?: string }) => void
  onIntentFallback?: (data: IntentFallbackData) => void
  onVariantUsed?: (data: VariantUsageData) => void
  includeErrorDetails?: boolean
}

/**
 * Execute the orchestration pipeline.
 * Runs handlers sequentially, stops immediately if any handler sets context.error or throws.
 */
export async function executeOrchestration(
  context: OrchestrationContext,
  steps: OrchestrationStep[],
  config?: OrchestratorConfig
): Promise<OrchestrationResult> {
  const logger = config?.logger ?? consoleLogger
  const includeErrorDetails = config?.includeErrorDetails ?? process.env.NODE_ENV !== 'production'

  let currentContext = { ...context }
  const startTime = Date.now()

  try {
    logger.debug(
      {
        messageCount: context.request.messages.length,
        metadata: context.request.metadata,
      },
      'Starting AI orchestration'
    )

    for (const step of steps) {
      if (step.enabled === false) {
        logger.debug({ step: step.name }, 'Skipping disabled step')
        continue
      }

      const stepStartTime = Date.now()

      try {
        currentContext = await step.handler(currentContext)

        const stepDuration = Date.now() - stepStartTime
        logger.debug(
          {
            step: step.name,
            durationMs: stepDuration,
          },
          'Orchestration step completed'
        )

        config?.onStepComplete?.(step.name, stepDuration)

        if (currentContext.error) {
          logger.warn(
            {
              step: step.name,
              error: currentContext.error.message,
              statusCode: currentContext.error.statusCode,
            },
            'Orchestration stopped due to error'
          )

          config?.onError?.({
            step: step.name,
            message: currentContext.error.message,
            statusCode: currentContext.error.statusCode,
            details: currentContext.error.details,
          })

          return {
            success: false,
            context: currentContext,
            error: currentContext.error,
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(
          {
            step: step.name,
            error: errorMessage,
          },
          'Orchestration step failed'
        )

        currentContext.error = {
          message: 'An error occurred while processing your request. Please try again.',
          statusCode: 500,
          step: step.name,
          details: includeErrorDetails ? errorMessage : undefined,
        }

        config?.onError?.({
          step: step.name,
          message: currentContext.error.message,
          statusCode: currentContext.error.statusCode,
          details: currentContext.error.details,
        })

        return {
          success: false,
          context: currentContext,
          error: currentContext.error,
        }
      }
    }

    const totalDuration = Date.now() - startTime

    logger.info(
      {
        totalDurationMs: totalDuration,
        stepsExecuted: steps.filter(s => s.enabled !== false).length,
      },
      'AI orchestration completed successfully'
    )

    return {
      success: true,
      context: currentContext,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Unexpected error in orchestration'
    )

    currentContext.error = {
      message: 'An unexpected error occurred. Please try again.',
      statusCode: 500,
      step: 'orchestration',
      details: includeErrorDetails ? errorMessage : undefined,
    }

    return {
      success: false,
      context: currentContext,
      error: currentContext.error,
    }
  }
}

/**
 * Class-based orchestrator for stateful pipeline management.
 * Alternative to functional executeOrchestration API.
 */
export class Orchestrator {
  private config: OrchestratorConfig
  private steps: OrchestrationStep[]

  constructor(steps: OrchestrationStep[], config?: OrchestratorConfig) {
    this.steps = steps
    this.config = config ?? {}
  }

  async execute(context: OrchestrationContext): Promise<OrchestrationResult> {
    return executeOrchestration(context, this.steps, this.config)
  }

  addHandler(step: OrchestrationStep): void {
    this.steps.push(step)
  }

  removeHandler(name: string): void {
    this.steps = this.steps.filter(s => s.name !== name)
  }

  toggleStep(name: string, enabled: boolean): void {
    const step = this.steps.find(s => s.name === name)
    if (step) {
      step.enabled = enabled
    }
  }

  getSteps(): OrchestrationStep[] {
    return [...this.steps]
  }
}
