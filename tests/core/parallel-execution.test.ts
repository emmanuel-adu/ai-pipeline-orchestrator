import { describe, expect, it, vi } from 'vitest'

import { executeOrchestration } from '../../src/core/orchestrator'
import type {
  OrchestrationContext,
  OrchestrationHandler,
  OrchestrationSteps,
} from '../../src/core/types'

describe('Parallel Execution', () => {
  it('should execute steps in parallel when grouped in array', async () => {
    const executionOrder: string[] = []
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    const handler1: OrchestrationHandler = async ctx => {
      executionOrder.push('start-1')
      await delay(50)
      executionOrder.push('end-1')
      return { ...ctx, step1: true }
    }

    const handler2: OrchestrationHandler = async ctx => {
      executionOrder.push('start-2')
      await delay(30)
      executionOrder.push('end-2')
      return { ...ctx, step2: true }
    }

    const handler3: OrchestrationHandler = async ctx => {
      executionOrder.push('start-3')
      await delay(20)
      executionOrder.push('end-3')
      return { ...ctx, step3: true }
    }

    const steps: OrchestrationSteps = [
      [
        { name: 'parallel1', handler: handler1 },
        { name: 'parallel2', handler: handler2 },
        { name: 'parallel3', handler: handler3 },
      ],
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect(executionOrder).toEqual(['start-1', 'start-2', 'start-3', 'end-3', 'end-2', 'end-1'])
    expect((result.context as any).step1).toBe(true)
    expect((result.context as any).step2).toBe(true)
    expect((result.context as any).step3).toBe(true)
  })

  it('should execute sequential steps normally', async () => {
    const executionOrder: string[] = []

    const handler1: OrchestrationHandler = async ctx => {
      executionOrder.push('step1')
      return { ...ctx, step1: true }
    }

    const handler2: OrchestrationHandler = async ctx => {
      executionOrder.push('step2')
      return { ...ctx, step2: true }
    }

    const steps: OrchestrationSteps = [
      { name: 'sequential1', handler: handler1 },
      { name: 'sequential2', handler: handler2 },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect(executionOrder).toEqual(['step1', 'step2'])
    expect((result.context as any).step1).toBe(true)
    expect((result.context as any).step2).toBe(true)
  })

  it('should mix parallel and sequential steps', async () => {
    const executionOrder: string[] = []

    const handler1: OrchestrationHandler = async ctx => {
      executionOrder.push('step1')
      return { ...ctx, step1: true }
    }

    const handler2: OrchestrationHandler = async ctx => {
      executionOrder.push('parallel1')
      return { ...ctx, parallel1: true }
    }

    const handler3: OrchestrationHandler = async ctx => {
      executionOrder.push('parallel2')
      return { ...ctx, parallel2: true }
    }

    const handler4: OrchestrationHandler = async ctx => {
      executionOrder.push('step2')
      return { ...ctx, step2: true }
    }

    const steps: OrchestrationSteps = [
      { name: 'seq1', handler: handler1 },
      [
        { name: 'par1', handler: handler2 },
        { name: 'par2', handler: handler3 },
      ],
      { name: 'seq2', handler: handler4 },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect(executionOrder[0]).toBe('step1')
    expect(executionOrder.slice(1, 3).sort()).toEqual(['parallel1', 'parallel2'])
    expect(executionOrder[3]).toBe('step2')
  })

  it('should merge contexts from parallel steps', async () => {
    const handler1: OrchestrationHandler = async ctx => ({
      ...ctx,
      prop1: 'value1',
      shared: 'from1',
    })
    const handler2: OrchestrationHandler = async ctx => ({ ...ctx, prop2: 'value2' })
    const handler3: OrchestrationHandler = async ctx => ({
      ...ctx,
      prop3: 'value3',
      shared: 'from3',
    })

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1 },
        { name: 'step2', handler: handler2 },
        { name: 'step3', handler: handler3 },
      ],
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect((result.context as any).prop1).toBe('value1')
    expect((result.context as any).prop2).toBe('value2')
    expect((result.context as any).prop3).toBe('value3')
    expect((result.context as any).shared).toBeDefined()
  })

  it('should stop on error in parallel group', async () => {
    const handler1 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step1: true }))
    const handler2 = vi.fn(async (ctx: OrchestrationContext) => {
      ctx.error = { message: 'Test error', statusCode: 500 }
      return ctx
    })
    const handler3 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step3: true }))

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1 },
        { name: 'step2', handler: handler2 },
        { name: 'step3', handler: handler3 },
      ],
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Test error')
    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
  })

  it('should stop on thrown error in parallel group', async () => {
    const handler1 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step1: true }))
    const handler2 = vi.fn(async (_ctx: OrchestrationContext) => {
      throw new Error('Test error')
    })
    const handler3 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step3: true }))

    const afterParallel = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, after: true }))

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1 },
        { name: 'step2', handler: handler2 },
        { name: 'step3', handler: handler3 },
      ],
      { name: 'after', handler: afterParallel },
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(false)
    expect(result.error?.statusCode).toBe(500)
    expect(afterParallel).not.toHaveBeenCalled()
  })

  it('should respect enabled property in parallel steps', async () => {
    const handler1 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step1: true }))
    const handler2 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step2: true }))
    const handler3 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step3: true }))

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1 },
        { name: 'step2', handler: handler2, enabled: false },
        { name: 'step3', handler: handler3 },
      ],
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect(handler1).toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
    expect((result.context as any).step1).toBe(true)
    expect((result.context as any).step2).toBeUndefined()
    expect((result.context as any).step3).toBe(true)
  })

  it('should respect shouldExecute in parallel steps', async () => {
    const handler1 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step1: true }))
    const handler2 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step2: true }))
    const handler3 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step3: true }))

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1 },
        { name: 'step2', handler: handler2, shouldExecute: () => false },
        { name: 'step3', handler: handler3 },
      ],
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect(handler1).toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
  })

  it('should handle all steps being disabled in parallel group', async () => {
    const handler1 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step1: true }))
    const handler2 = vi.fn(async (ctx: OrchestrationContext) => ({ ...ctx, step2: true }))

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1, enabled: false },
        { name: 'step2', handler: handler2, enabled: false },
      ],
    ]

    const context: OrchestrationContext = {
      request: { messages: [{ role: 'user', content: 'test' }] },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })

  it('should preserve request context in parallel steps', async () => {
    const handler1: OrchestrationHandler = async ctx => {
      expect(ctx.request.messages.length).toBe(1)
      return { ...ctx, step1: true }
    }

    const handler2: OrchestrationHandler = async ctx => {
      expect(ctx.request.metadata?.userId).toBe('123')
      return { ...ctx, step2: true }
    }

    const steps: OrchestrationSteps = [
      [
        { name: 'step1', handler: handler1 },
        { name: 'step2', handler: handler2 },
      ],
    ]

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
        metadata: { userId: '123' },
      },
    }

    const result = await executeOrchestration(context, steps)

    expect(result.success).toBe(true)
  })
})
