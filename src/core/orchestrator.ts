import type {
  OrchestrationContext,
  OrchestrationResult,
  OrchestrationStep,
  OrchestrationSteps,
} from './types'

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
 * Runs handlers sequentially or in parallel (when grouped in arrays).
 */
export async function executeOrchestration(
  context: OrchestrationContext,
  steps: OrchestrationSteps,
  config?: OrchestratorConfig
): Promise<OrchestrationResult> {
  const logger = config?.logger ?? consoleLogger
  const includeErrorDetails = config?.includeErrorDetails ?? process.env.NODE_ENV !== 'production'

  let currentContext = { ...context }
  const startTime = Date.now()

  const executeSingleStep = async (
    step: OrchestrationStep,
    ctx: OrchestrationContext
  ): Promise<OrchestrationContext> => {
    if (step.enabled === false) {
      logger.debug({ step: step.name }, 'Skipping disabled step')
      return ctx
    }

    if (step.shouldExecute) {
      const shouldRun = await step.shouldExecute(ctx)
      if (!shouldRun) {
        logger.debug({ step: step.name }, 'Skipping step based on shouldExecute condition')
        return ctx
      }
    }

    const stepStartTime = Date.now()
    const result = await step.handler(ctx)
    const stepDuration = Date.now() - stepStartTime

    logger.debug({ step: step.name, durationMs: stepDuration }, 'Orchestration step completed')
    config?.onStepComplete?.(step.name, stepDuration)

    return result
  }

  try {
    logger.debug(
      {
        messageCount: context.request.messages.length,
        metadata: context.request.metadata,
      },
      'Starting AI orchestration'
    )

    for (const stepOrGroup of steps) {
      const isParallelGroup = Array.isArray(stepOrGroup)

      try {
        if (isParallelGroup) {
          const groupStartTime = Date.now()
          const stepNames = stepOrGroup.map(s => s.name).join(', ')
          logger.debug({ steps: stepNames }, 'Executing parallel group')

          const results = await Promise.all(
            stepOrGroup.map(step => executeSingleStep(step, currentContext))
          )

          for (let i = 0; i < results.length; i++) {
            const result = results[i]
            if (result.error) {
              const failedStep = result.error.step || stepOrGroup[i].name
              const errorWithStep = { ...result.error, step: failedStep }

              logger.warn(
                {
                  step: failedStep,
                  error: errorWithStep.message,
                  statusCode: errorWithStep.statusCode,
                },
                'Parallel group stopped due to error'
              )

              config?.onError?.({
                step: failedStep,
                message: errorWithStep.message,
                statusCode: errorWithStep.statusCode,
                details: errorWithStep.details,
              })

              return {
                success: false,
                context: { ...result, error: errorWithStep },
                error: errorWithStep,
              }
            }
          }

          currentContext = results.reduce((acc, result) => ({ ...acc, ...result }), currentContext)

          const groupDuration = Date.now() - groupStartTime
          logger.debug({ steps: stepNames, durationMs: groupDuration }, 'Parallel group completed')
        } else {
          const result = await executeSingleStep(stepOrGroup, currentContext)

          if (result.error) {
            logger.warn(
              {
                step: stepOrGroup.name,
                error: result.error.message,
                statusCode: result.error.statusCode,
              },
              'Orchestration stopped due to error'
            )

            config?.onError?.({
              step: stepOrGroup.name,
              message: result.error.message,
              statusCode: result.error.statusCode,
              details: result.error.details,
            })

            return {
              success: false,
              context: result,
              error: result.error,
            }
          }

          currentContext = result
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const stepName = isParallelGroup
          ? stepOrGroup.map(s => s.name).join(', ')
          : stepOrGroup.name

        logger.error({ step: stepName, error: errorMessage }, 'Orchestration step failed')

        currentContext.error = {
          message: 'An error occurred while processing your request. Please try again.',
          statusCode: 500,
          step: stepName,
          details: includeErrorDetails ? errorMessage : undefined,
        }

        config?.onError?.({
          step: stepName,
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

    const stepsExecuted = steps.filter(s => {
      if (Array.isArray(s)) return true
      return s.enabled !== false
    }).length

    logger.info(
      {
        totalDurationMs: totalDuration,
        stepsExecuted,
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
 */
export class Orchestrator {
  private config: OrchestratorConfig
  private steps: OrchestrationSteps

  constructor(steps: OrchestrationSteps, config?: OrchestratorConfig) {
    this.steps = steps
    this.config = config ?? {}
  }

  async execute(context: OrchestrationContext): Promise<OrchestrationResult> {
    return executeOrchestration(context, this.steps, this.config)
  }

  addHandler(step: OrchestrationStep | OrchestrationStep[]): void {
    this.steps.push(step)
  }

  removeHandler(name: string): void {
    this.steps = this.steps.filter(s => {
      if (Array.isArray(s)) {
        return !s.some(step => step.name === name)
      }
      return s.name !== name
    })
  }

  toggleStep(name: string, enabled: boolean): void {
    for (const stepOrGroup of this.steps) {
      if (Array.isArray(stepOrGroup)) {
        const step = stepOrGroup.find(s => s.name === name)
        if (step) {
          step.enabled = enabled
          return
        }
      } else if (stepOrGroup.name === name) {
        stepOrGroup.enabled = enabled
        return
      }
    }
  }

  getSteps(): OrchestrationSteps {
    return [...this.steps]
  }
}
