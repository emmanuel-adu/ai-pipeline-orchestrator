/**
 * Testing utilities for ai-pipeline-orchestrator
 *
 * Provides helpers for testing custom handlers and orchestration pipelines.
 *
 * @example
 * ```typescript
 * import { createMockContext, createTestPipeline } from 'ai-pipeline-orchestrator/testing'
 *
 * test('my custom handler works', async () => {
 *   const context = createMockContext({
 *     request: { messages: [{ role: 'user', content: 'test' }] }
 *   })
 *
 *   const result = await myHandler(context)
 *   expect(result.customField).toBe('expected value')
 * })
 * ```
 */
import type { OrchestrationContext, OrchestrationHandler, OrchestrationStep } from '../core/types'

/**
 * Creates a mock context with sensible defaults
 */
export function createMockContext(
  overrides: Partial<OrchestrationContext> = {}
): OrchestrationContext {
  const defaultContext: OrchestrationContext = {
    request: {
      messages: [{ role: 'user', content: 'Test message' }],
      metadata: {},
    },
  }

  return {
    ...defaultContext,
    ...overrides,
    request: {
      ...defaultContext.request,
      ...(overrides.request || {}),
      messages: overrides.request?.messages || defaultContext.request.messages,
      metadata: {
        ...defaultContext.request.metadata,
        ...(overrides.request?.metadata || {}),
      },
    },
  }
}

/**
 * Creates a mock handler that merges response into context
 */
export function createMockHandler(response?: Partial<OrchestrationContext>): OrchestrationHandler {
  return async (context: OrchestrationContext): Promise<OrchestrationContext> => {
    return {
      ...context,
      ...response,
    }
  }
}

/**
 * Creates a mock handler that sets an error
 */
export function createMockErrorHandler(
  message: string,
  statusCode = 500,
  step = 'test'
): OrchestrationHandler {
  return async (context: OrchestrationContext): Promise<OrchestrationContext> => {
    return {
      ...context,
      error: {
        message,
        statusCode,
        step,
      },
    }
  }
}

/**
 * Spy handler that tracks all calls for inspection
 */
export function createSpyHandler() {
  const calls: OrchestrationContext[] = []

  const handler: OrchestrationHandler = async (
    context: OrchestrationContext
  ): Promise<OrchestrationContext> => {
    calls.push({ ...context })
    return context
  }

  return {
    handler,
    calls,
    reset: () => {
      calls.length = 0
    },
  }
}

/**
 * Test pipeline that executes steps and tracks execution time
 */
export function createTestPipeline(steps: OrchestrationStep[]) {
  let lastResult: {
    success: boolean
    context: OrchestrationContext
    error?: {
      message: string
      statusCode: number
      retryAfter?: number
      step?: string
      details?: string
    }
  } | null = null
  let lastExecutionTime = 0

  async function execute(initialContext: OrchestrationContext): Promise<{
    success: boolean
    context: OrchestrationContext
    error?: {
      message: string
      statusCode: number
      retryAfter?: number
      step?: string
      details?: string
    }
  }> {
    const startTime = Date.now()
    let context = { ...initialContext }

    for (const step of steps) {
      if (step.enabled === false) {
        continue
      }

      try {
        context = await step.handler(context)

        if (context.error) {
          lastExecutionTime = Date.now() - startTime
          lastResult = {
            success: false,
            context,
            error: context.error,
          }
          return lastResult
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorDetails = error instanceof Error ? error.stack : undefined

        lastExecutionTime = Date.now() - startTime
        lastResult = {
          success: false,
          context,
          error: {
            message: 'Handler execution failed',
            statusCode: 500,
            step: step.name,
            details: errorDetails || errorMessage,
          },
        }
        return lastResult
      }
    }

    lastExecutionTime = Date.now() - startTime
    lastResult = {
      success: true,
      context,
    }
    return lastResult
  }

  return {
    execute,
    steps,
    get executionTime() {
      return lastExecutionTime
    },
    get lastResult() {
      return lastResult
    },
  }
}

export function assertContextHasProperty(
  context: OrchestrationContext,
  key: string,
  expectedValue?: unknown
): void {
  if (!(key in context)) {
    throw new Error(`Expected context to have property '${key}'`)
  }

  if (expectedValue !== undefined && context[key] !== expectedValue) {
    throw new Error(
      `Expected context.${key} to equal ${JSON.stringify(expectedValue)}, got ${JSON.stringify(context[key])}`
    )
  }
}

export function assertContextHasError(
  context: OrchestrationContext,
  expectedMessage?: string,
  expectedStatusCode?: number
): void {
  if (!context.error) {
    throw new Error('Expected context to have an error')
  }

  if (expectedMessage && !context.error.message.includes(expectedMessage)) {
    throw new Error(
      `Expected error message to include '${expectedMessage}', got '${context.error.message}'`
    )
  }

  if (expectedStatusCode !== undefined && context.error.statusCode !== expectedStatusCode) {
    throw new Error(
      `Expected error statusCode to be ${expectedStatusCode}, got ${context.error.statusCode}`
    )
  }
}

export function createDelayHandler(delayMs: number): OrchestrationHandler {
  return async (context: OrchestrationContext): Promise<OrchestrationContext> => {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    return context
  }
}
