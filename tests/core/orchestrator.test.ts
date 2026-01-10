import { describe, expect, it, vi } from 'vitest'

import { executeOrchestration, Orchestrator } from '../../src/core'
import type { OrchestrationContext, OrchestrationHandler } from '../../src/core'

describe('executeOrchestration', () => {
  it('should execute handlers sequentially', async () => {
    const executionOrder: number[] = []

    const handler1: OrchestrationHandler = async ctx => {
      executionOrder.push(1)
      return { ...ctx, step1: 'done' }
    }

    const handler2: OrchestrationHandler = async ctx => {
      executionOrder.push(2)
      return { ...ctx, step2: 'done' }
    }

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    const result = await executeOrchestration(context, [
      { name: 'step1', handler: handler1 },
      { name: 'step2', handler: handler2 },
    ])

    expect(result.success).toBe(true)
    expect(executionOrder).toEqual([1, 2])
    expect(result.context.step1).toBe('done')
    expect(result.context.step2).toBe('done')
  })

  it('should stop on first handler that sets error', async () => {
    const handler1: OrchestrationHandler = async ctx => {
      return {
        ...ctx,
        error: {
          message: 'Test error',
          statusCode: 400,
          step: 'step1',
        },
      }
    }

    const handler2 = vi.fn()

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    const result = await executeOrchestration(context, [
      { name: 'step1', handler: handler1 },
      { name: 'step2', handler: handler2 },
    ])

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Test error')
    expect(result.error?.statusCode).toBe(400)
    expect(handler2).not.toHaveBeenCalled()
  })

  it('should handle thrown errors gracefully', async () => {
    const handler1: OrchestrationHandler = async () => {
      throw new Error('Handler failed')
    }

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    const result = await executeOrchestration(context, [{ name: 'step1', handler: handler1 }], {
      includeErrorDetails: true,
    })

    expect(result.success).toBe(false)
    expect(result.error?.details).toBe('Handler failed')
    expect(result.error?.step).toBe('step1')
  })

  it('should skip disabled handlers', async () => {
    const handler1 = vi.fn(async (ctx: OrchestrationContext) => ctx)
    const handler2: OrchestrationHandler = async ctx => {
      return { ...ctx, completed: true }
    }

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    const result = await executeOrchestration(context, [
      { name: 'step1', handler: handler1, enabled: false },
      { name: 'step2', handler: handler2 },
    ])

    expect(result.success).toBe(true)
    expect(handler1).not.toHaveBeenCalled()
    expect(result.context.completed).toBe(true)
  })

  it('should call onStepComplete callback', async () => {
    const onStepComplete = vi.fn()
    const handler: OrchestrationHandler = async ctx => ctx

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    await executeOrchestration(context, [{ name: 'test-step', handler }], { onStepComplete })

    expect(onStepComplete).toHaveBeenCalledWith('test-step', expect.any(Number))
  })

  it('should call onError callback when handler fails', async () => {
    const onError = vi.fn()
    const handler: OrchestrationHandler = async ctx => {
      return {
        ...ctx,
        error: {
          message: 'Test error',
          statusCode: 400,
          step: 'test-step',
        },
      }
    }

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    await executeOrchestration(context, [{ name: 'test-step', handler }], { onError })

    expect(onError).toHaveBeenCalledWith({
      step: 'test-step',
      message: 'Test error',
      statusCode: 400,
    })
  })
})

describe('Orchestrator class', () => {
  it('should create and execute pipeline', async () => {
    const handler: OrchestrationHandler = async ctx => {
      return { ...ctx, processed: true }
    }

    const orchestrator = new Orchestrator([{ name: 'process', handler }])

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'test' }],
      },
    }

    const result = await orchestrator.execute(context)

    expect(result.success).toBe(true)
    expect(result.context.processed).toBe(true)
  })

  it('should allow adding and removing handlers', () => {
    const handler: OrchestrationHandler = async ctx => ctx

    const orchestrator = new Orchestrator([{ name: 'step1', handler }])

    orchestrator.addHandler({ name: 'step2', handler })

    expect(orchestrator.getSteps()).toHaveLength(2)

    orchestrator.removeHandler('step1')

    expect(orchestrator.getSteps()).toHaveLength(1)
    expect(orchestrator.getSteps()[0].name).toBe('step2')
  })

  it('should allow toggling step enabled status', () => {
    const handler: OrchestrationHandler = async ctx => ctx

    const orchestrator = new Orchestrator([
      { name: 'step1', handler },
      { name: 'step2', handler },
    ])

    orchestrator.toggleStep('step1', false)

    const steps = orchestrator.getSteps()
    expect(steps[0].enabled).toBe(false)
    expect(steps[1].enabled).toBeUndefined()
  })
})
