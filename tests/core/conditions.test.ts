import { describe, expect, it } from 'vitest'

import {
  and,
  hasIntent,
  hasMetadata,
  hasProperty,
  isAuthenticated,
  isFirstMessage,
  matchesPattern,
  not,
  or,
  when,
} from '../../src/core/conditions'
import type { OrchestrationContext } from '../../src/core/types'

describe('Conditional Execution Helpers', () => {
  const baseContext: OrchestrationContext = {
    request: {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { userId: '123', role: 'admin' },
    },
  }

  describe('when', () => {
    it('should create a predicate function', () => {
      const condition = when(ctx => ctx.request.messages.length > 0)
      expect(typeof condition).toBe('function')
    })

    it('should evaluate synchronous predicates', () => {
      const condition = when(ctx => ctx.request.messages.length > 0)
      expect(condition(baseContext)).toBe(true)
    })

    it('should evaluate async predicates', async () => {
      const condition = when(async ctx => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return ctx.request.messages.length > 0
      })
      expect(await condition(baseContext)).toBe(true)
    })
  })

  describe('hasIntent', () => {
    it('should return true when intent matches', () => {
      const context = { ...baseContext, intent: { intent: 'greeting' } }
      const condition = hasIntent('greeting')
      expect(condition(context)).toBe(true)
    })

    it('should return false when intent does not match', () => {
      const context = { ...baseContext, intent: { intent: 'help' } }
      const condition = hasIntent('greeting')
      expect(condition(context)).toBe(false)
    })

    it('should return false when no intent exists', () => {
      const condition = hasIntent('greeting')
      expect(condition(baseContext)).toBe(false)
    })
  })

  describe('hasMetadata', () => {
    it('should return true when metadata key exists', () => {
      const condition = hasMetadata('userId')
      expect(condition(baseContext)).toBe(true)
    })

    it('should return false when metadata key does not exist', () => {
      const condition = hasMetadata('nonexistent')
      expect(condition(baseContext)).toBe(false)
    })

    it('should return true when metadata key matches value', () => {
      const condition = hasMetadata('role', 'admin')
      expect(condition(baseContext)).toBe(true)
    })

    it('should return false when metadata key does not match value', () => {
      const condition = hasMetadata('role', 'user')
      expect(condition(baseContext)).toBe(false)
    })
  })

  describe('hasProperty', () => {
    it('should return true when property exists', () => {
      const context = { ...baseContext, customProp: 'value' }
      const condition = hasProperty('customProp')
      expect(condition(context)).toBe(true)
    })

    it('should return false when property does not exist', () => {
      const condition = hasProperty('nonexistent')
      expect(condition(baseContext)).toBe(false)
    })

    it('should return true when property matches value', () => {
      const context = { ...baseContext, customProp: 'value' }
      const condition = hasProperty('customProp', 'value')
      expect(condition(context)).toBe(true)
    })
  })

  describe('isFirstMessage', () => {
    it('should return true for first message', () => {
      const condition = isFirstMessage()
      expect(condition(baseContext)).toBe(true)
    })

    it('should return false for follow-up messages', () => {
      const context: OrchestrationContext = {
        request: {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi' },
            { role: 'user', content: 'How are you?' },
          ],
        },
      }
      const condition = isFirstMessage()
      expect(condition(context)).toBe(false)
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when userId exists', () => {
      const condition = isAuthenticated()
      expect(condition(baseContext)).toBe(true)
    })

    it('should return true when authenticated flag is true', () => {
      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Hello' }],
          metadata: { authenticated: true },
        },
      }
      const condition = isAuthenticated()
      expect(condition(context)).toBe(true)
    })

    it('should return false when no auth info', () => {
      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      }
      const condition = isAuthenticated()
      expect(condition(context)).toBe(false)
    })
  })

  describe('matchesPattern', () => {
    it('should return true when content matches pattern', () => {
      const condition = matchesPattern(/hello/i, 'content')
      expect(condition(baseContext)).toBe(true)
    })

    it('should return false when content does not match', () => {
      const condition = matchesPattern(/goodbye/i, 'content')
      expect(condition(baseContext)).toBe(false)
    })
  })

  describe('and', () => {
    it('should return true when all conditions are true', async () => {
      const condition = and(hasMetadata('userId'), isFirstMessage())
      expect(await condition(baseContext)).toBe(true)
    })

    it('should return false when any condition is false', async () => {
      const condition = and(hasMetadata('userId'), hasMetadata('nonexistent'))
      expect(await condition(baseContext)).toBe(false)
    })

    it('should short-circuit on first false', async () => {
      let secondCalled = false
      const condition = and(
        () => false,
        () => {
          secondCalled = true
          return true
        }
      )
      await condition(baseContext)
      expect(secondCalled).toBe(false)
    })
  })

  describe('or', () => {
    it('should return true when any condition is true', async () => {
      const condition = or(hasMetadata('nonexistent'), hasMetadata('userId'))
      expect(await condition(baseContext)).toBe(true)
    })

    it('should return false when all conditions are false', async () => {
      const condition = or(hasMetadata('nonexistent'), hasMetadata('alsoNonexistent'))
      expect(await condition(baseContext)).toBe(false)
    })

    it('should short-circuit on first true', async () => {
      let secondCalled = false
      const condition = or(
        () => true,
        () => {
          secondCalled = true
          return false
        }
      )
      await condition(baseContext)
      expect(secondCalled).toBe(false)
    })
  })

  describe('not', () => {
    it('should negate true to false', async () => {
      const condition = not(hasMetadata('userId'))
      expect(await condition(baseContext)).toBe(false)
    })

    it('should negate false to true', async () => {
      const condition = not(hasMetadata('nonexistent'))
      expect(await condition(baseContext)).toBe(true)
    })
  })

  describe('Complex combinations', () => {
    it('should handle nested and/or/not', async () => {
      const condition = and(
        or(hasMetadata('userId'), hasMetadata('sessionId')),
        not(hasMetadata('banned'))
      )

      expect(await condition(baseContext)).toBe(true)

      const bannedContext = {
        ...baseContext,
        request: {
          ...baseContext.request,
          metadata: { ...baseContext.request.metadata, banned: true },
        },
      }
      expect(await condition(bannedContext)).toBe(false)
    })
  })
})
