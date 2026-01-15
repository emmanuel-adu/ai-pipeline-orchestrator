import { describe, expect, it } from 'vitest'

import type { OrchestrationContext } from '../../src/core/types'
import {
  assertContextHasError,
  assertContextHasProperty,
  createDelayHandler,
  createMockContext,
  createMockErrorHandler,
  createMockHandler,
  createSpyHandler,
  createTestPipeline,
} from '../../src/testing'

describe('Testing Utilities', () => {
  describe('createMockContext', () => {
    it('should create a default context', () => {
      const context = createMockContext()

      expect(context.request).toBeDefined()
      expect(context.request.messages).toHaveLength(1)
      expect(context.request.messages[0].role).toBe('user')
      expect(context.request.messages[0].content).toBe('Test message')
      expect(context.request.metadata).toEqual({})
    })

    it('should override messages', () => {
      const context = createMockContext({
        request: {
          messages: [{ role: 'user', content: 'Custom message' }],
        },
      })

      expect(context.request.messages[0].content).toBe('Custom message')
    })

    it('should override metadata', () => {
      const context = createMockContext({
        request: {
          messages: [{ role: 'user', content: 'test' }],
          metadata: { userId: '123', isAdmin: true },
        },
      })

      expect(context.request.metadata?.userId).toBe('123')
      expect(context.request.metadata?.isAdmin).toBe(true)
    })

    it('should allow adding custom properties', () => {
      const context = createMockContext({
        customField: 'value',
      })

      expect(context.customField).toBe('value')
    })
  })

  describe('createMockHandler', () => {
    it('should return context unchanged when no response provided', async () => {
      const handler = createMockHandler()
      const context = createMockContext()

      const result = await handler(context)

      expect(result).toEqual(context)
    })

    it('should merge response into context', async () => {
      const handler = createMockHandler({ processed: true, result: 'success' })
      const context = createMockContext()

      const result = await handler(context)

      expect(result.processed).toBe(true)
      expect(result.result).toBe('success')
    })
  })

  describe('createMockErrorHandler', () => {
    it('should set error in context', async () => {
      const handler = createMockErrorHandler('Test error', 400, 'validation')
      const context = createMockContext()

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Test error')
      expect(result.error?.statusCode).toBe(400)
      expect(result.error?.step).toBe('validation')
    })

    it('should use default status code and step', async () => {
      const handler = createMockErrorHandler('Error')
      const context = createMockContext()

      const result = await handler(context)

      expect(result.error?.statusCode).toBe(500)
      expect(result.error?.step).toBe('test')
    })
  })

  describe('createSpyHandler', () => {
    it('should track calls', async () => {
      const spy = createSpyHandler()
      const context1 = createMockContext({
        request: { messages: [{ role: 'user', content: 'msg1' }] },
      })
      const context2 = createMockContext({
        request: { messages: [{ role: 'user', content: 'msg2' }] },
      })

      await spy.handler(context1)
      await spy.handler(context2)

      expect(spy.calls).toHaveLength(2)
      expect(spy.calls[0].request.messages[0].content).toBe('msg1')
      expect(spy.calls[1].request.messages[0].content).toBe('msg2')
    })

    it('should reset calls', async () => {
      const spy = createSpyHandler()
      const context = createMockContext()

      await spy.handler(context)
      expect(spy.calls).toHaveLength(1)

      spy.reset()
      expect(spy.calls).toHaveLength(0)
    })

    it('should return context unchanged', async () => {
      const spy = createSpyHandler()
      const context = createMockContext()

      const result = await spy.handler(context)

      expect(result).toEqual(context)
    })
  })

  describe('createTestPipeline', () => {
    it('should execute handlers in order', async () => {
      const executionOrder: number[] = []

      const pipeline = createTestPipeline([
        {
          name: 'step1',
          handler: createMockHandler({ step1: 'done' }),
        },
        {
          name: 'step2',
          handler: async ctx => {
            executionOrder.push(1)
            return { ...ctx, step2: 'done' }
          },
        },
        {
          name: 'step3',
          handler: async ctx => {
            executionOrder.push(2)
            return { ...ctx, step3: 'done' }
          },
        },
      ])

      const context = createMockContext()
      const result = await pipeline.execute(context)

      expect(result.success).toBe(true)
      expect(executionOrder).toEqual([1, 2])
      expect(result.context.step1).toBe('done')
      expect(result.context.step2).toBe('done')
      expect(result.context.step3).toBe('done')
    })

    it('should stop on error', async () => {
      const handler3Called = { value: false }

      const pipeline = createTestPipeline([
        { name: 'step1', handler: createMockHandler() },
        { name: 'step2', handler: createMockErrorHandler('Test error') },
        {
          name: 'step3',
          handler: async ctx => {
            handler3Called.value = true
            return ctx
          },
        },
      ])

      const context = createMockContext()
      const result = await pipeline.execute(context)

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Test error')
      expect(handler3Called.value).toBe(false)
    })

    it('should skip disabled handlers', async () => {
      const handler2Called = { value: false }

      const pipeline = createTestPipeline([
        { name: 'step1', handler: createMockHandler({ step1: 'done' }) },
        {
          name: 'step2',
          handler: async ctx => {
            handler2Called.value = true
            return ctx
          },
          enabled: false,
        },
        { name: 'step3', handler: createMockHandler({ step3: 'done' }) },
      ])

      const context = createMockContext()
      const result = await pipeline.execute(context)

      expect(result.success).toBe(true)
      expect(handler2Called.value).toBe(false)
      expect(result.context.step1).toBe('done')
      expect(result.context.step3).toBe('done')
    })

    it('should track execution time', async () => {
      const pipeline = createTestPipeline([{ name: 'delay', handler: createDelayHandler(50) }])

      const context = createMockContext()
      await pipeline.execute(context)

      expect(pipeline.executionTime).toBeGreaterThanOrEqual(50)
    })

    it('should provide access to steps', () => {
      const steps = [
        { name: 'step1', handler: createMockHandler() },
        { name: 'step2', handler: createMockHandler() },
      ]

      const pipeline = createTestPipeline(steps)

      expect(pipeline.steps).toEqual(steps)
    })

    it('should handle handler exceptions', async () => {
      const pipeline = createTestPipeline([
        {
          name: 'throwing',
          handler: async () => {
            throw new Error('Handler failed')
          },
        },
      ])

      const context = createMockContext()
      const result = await pipeline.execute(context)

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Handler execution failed')
      expect(result.error?.step).toBe('throwing')
      expect(result.error?.details).toContain('Handler failed')
    })
  })

  describe('assertContextHasProperty', () => {
    it('should pass when property exists', () => {
      const context: OrchestrationContext = createMockContext({
        testProp: 'value',
      })

      expect(() => {
        assertContextHasProperty(context, 'testProp')
      }).not.toThrow()
    })

    it('should throw when property missing', () => {
      const context = createMockContext()

      expect(() => {
        assertContextHasProperty(context, 'missing')
      }).toThrow("Expected context to have property 'missing'")
    })

    it('should validate property value', () => {
      const context: OrchestrationContext = createMockContext({
        testProp: 'value',
      })

      expect(() => {
        assertContextHasProperty(context, 'testProp', 'value')
      }).not.toThrow()

      expect(() => {
        assertContextHasProperty(context, 'testProp', 'wrong')
      }).toThrow()
    })
  })

  describe('assertContextHasError', () => {
    it('should pass when error exists', () => {
      const context: OrchestrationContext = {
        request: { messages: [] },
        error: {
          message: 'Test error',
          statusCode: 400,
        },
      }

      expect(() => {
        assertContextHasError(context)
      }).not.toThrow()
    })

    it('should throw when error missing', () => {
      const context = createMockContext()

      expect(() => {
        assertContextHasError(context)
      }).toThrow('Expected context to have an error')
    })

    it('should validate error message', () => {
      const context: OrchestrationContext = {
        request: { messages: [] },
        error: {
          message: 'Rate limit exceeded',
          statusCode: 429,
        },
      }

      expect(() => {
        assertContextHasError(context, 'Rate limit')
      }).not.toThrow()

      expect(() => {
        assertContextHasError(context, 'Not found')
      }).toThrow()
    })

    it('should validate status code', () => {
      const context: OrchestrationContext = {
        request: { messages: [] },
        error: {
          message: 'Error',
          statusCode: 400,
        },
      }

      expect(() => {
        assertContextHasError(context, undefined, 400)
      }).not.toThrow()

      expect(() => {
        assertContextHasError(context, undefined, 500)
      }).toThrow()
    })
  })

  describe('createDelayHandler', () => {
    it('should delay execution', async () => {
      const handler = createDelayHandler(100)
      const context = createMockContext()

      const start = Date.now()
      const result = await handler(context)
      const duration = Date.now() - start

      expect(duration).toBeGreaterThanOrEqual(100)
      expect(result).toEqual(context)
    })
  })
})
