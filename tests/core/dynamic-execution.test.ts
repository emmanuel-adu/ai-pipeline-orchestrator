import { describe, expect, it, vi } from 'vitest'

import { and, hasIntent, hasMetadata, isAuthenticated, not } from '../../src/core/conditions'
import { executeOrchestration } from '../../src/core/orchestrator'
import type {
  OrchestrationContext,
  OrchestrationHandler,
  OrchestrationStep,
} from '../../src/core/types'

describe('Dynamic Handler Execution', () => {
  it('should skip handler when shouldExecute returns false', async () => {
    const handlerSpy = vi.fn(async ctx => ({ ...ctx, handled: true }))

    const steps: OrchestrationStep[] = [
      {
        name: 'conditional',
        handler: handlerSpy,
        shouldExecute: () => false,
      },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(handlerSpy).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect((result.context as any).handled).toBeUndefined()
  })

  it('should execute handler when shouldExecute returns true', async () => {
    const handlerSpy = vi.fn(async ctx => ({ ...ctx, handled: true }))

    const steps: OrchestrationStep[] = [
      {
        name: 'conditional',
        handler: handlerSpy,
        shouldExecute: () => true,
      },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(handlerSpy).toHaveBeenCalledTimes(1)
    expect((result.context as any).handled).toBe(true)
  })

  it('should evaluate shouldExecute with context', async () => {
    const handlerSpy = vi.fn(async ctx => ({ ...ctx, handled: true }))

    const steps: OrchestrationStep[] = [
      {
        name: 'conditional',
        handler: handlerSpy,
        shouldExecute: ctx => ctx.request.messages.length > 2,
      },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)
    expect(handlerSpy).not.toHaveBeenCalled()

    const contextWithMoreMessages: OrchestrationContext = {
      request: {
        messages: [
          { role: 'user', content: '1' },
          { role: 'assistant', content: '2' },
          { role: 'user', content: '3' },
        ],
      },
    }

    const result2 = await executeOrchestration(contextWithMoreMessages, steps)
    expect(handlerSpy).toHaveBeenCalledTimes(1)
  })

  it('should work with async shouldExecute', async () => {
    const handlerSpy = vi.fn(async ctx => ({ ...ctx, handled: true }))

    const steps: OrchestrationStep[] = [
      {
        name: 'conditional',
        handler: handlerSpy,
        shouldExecute: async ctx => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return ctx.request.messages.length === 1
        },
      },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)
    expect(handlerSpy).toHaveBeenCalledTimes(1)
  })

  it('should use condition helpers', async () => {
    const rateLimitHandler: OrchestrationHandler = async ctx => ({ ...ctx, rateLimited: true })
    const authHandler: OrchestrationHandler = async ctx => ({ ...ctx, authenticated: true })

    const steps: OrchestrationStep[] = [
      {
        name: 'rateLimit',
        handler: rateLimitHandler,
        shouldExecute: not(isAuthenticated()),
      },
      {
        name: 'auth',
        handler: authHandler,
        shouldExecute: hasMetadata('userId'),
      },
    ]

    const unauthContext: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result1 = await executeOrchestration(unauthContext, steps)
    expect((result1.context as any).rateLimited).toBe(true)
    expect((result1.context as any).authenticated).toBeUndefined()

    const authContext: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }], metadata: { userId: '123' } },
    }

    const result2 = await executeOrchestration(authContext, steps)
    expect((result2.context as any).rateLimited).toBeUndefined()
    expect((result2.context as any).authenticated).toBe(true)
  })

  it('should combine multiple conditions with and', async () => {
    const handlerSpy = vi.fn(async ctx => ({ ...ctx, handled: true }))

    const steps: OrchestrationStep[] = [
      {
        name: 'conditional',
        handler: handlerSpy,
        shouldExecute: and(hasMetadata('userId'), hasIntent('help')),
      },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }], metadata: { userId: '123' } },
      intent: { intent: 'help' },
    }

    const result = await executeOrchestration(context, steps)
    expect(handlerSpy).toHaveBeenCalledTimes(1)

    const contextMissingIntent: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }], metadata: { userId: '123' } },
      intent: { intent: 'greeting' },
    }

    const result2 = await executeOrchestration(contextMissingIntent, steps)
    expect(handlerSpy).toHaveBeenCalledTimes(1)
  })

  it('should work alongside enabled property', async () => {
    const handlerSpy = vi.fn(async ctx => ({ ...ctx, handled: true }))

    const steps: OrchestrationStep[] = [
      {
        name: 'disabled',
        handler: handlerSpy,
        enabled: false,
        shouldExecute: () => true,
      },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)
    expect(handlerSpy).not.toHaveBeenCalled()
  })
})
