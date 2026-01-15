import { describe, expect, it } from 'vitest'

import type { OrchestrationContext } from '../../src/core/types'
import { createModerationHandler } from '../../src/handlers/content-moderation'

describe('createModerationHandler', () => {
  describe('spam pattern detection', () => {
    it('should accept string patterns and convert to RegExp', async () => {
      const handler = createModerationHandler({
        spamPatterns: ['(.)\\1{4,}', '[A-Z]{10,}'],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'AAAAA this is spam' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('inappropriate')
      expect((result.contentModeration as { passed: boolean }).passed).toBe(false)
    })

    it('should accept RegExp patterns directly', async () => {
      const handler = createModerationHandler({
        spamPatterns: [/(.)\1{4,}/i, /[A-Z]{10,}/],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'HELLOWORLD ALLCAPS MESSAGE' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect((result.contentModeration as { passed: boolean }).passed).toBe(false)
    })

    it('should accept mixed string and RegExp patterns', async () => {
      const handler = createModerationHandler({
        spamPatterns: ['(.)\\1{4,}', /[A-Z]{10,}/],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'aaaaa spam' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect((result.contentModeration as { passed: boolean }).passed).toBe(false)
    })

    it('should allow valid messages to pass', async () => {
      const handler = createModerationHandler({
        spamPatterns: ['(.)\\1{10,}'],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'This is a normal message' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeUndefined()
      expect((result.contentModeration as { passed: boolean }).passed).toBe(true)
    })
  })

  describe('custom rules', () => {
    it('should accept string patterns in custom rules', async () => {
      const handler = createModerationHandler({
        customRules: [
          {
            pattern: '(.)\\1{3,}',
            reason: 'Too many repeated characters',
          },
        ],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Hellooooo' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect((result.contentModeration as { passed: boolean; reason: string }).reason).toBe(
        'Too many repeated characters'
      )
    })

    it('should accept RegExp patterns in custom rules', async () => {
      const handler = createModerationHandler({
        customRules: [
          {
            pattern: /banned-word/i,
            reason: 'Contains banned word',
          },
        ],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'This has a BANNED-WORD in it' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect((result.contentModeration as { passed: boolean; reason: string }).reason).toBe(
        'Contains banned word'
      )
    })

    it('should support multiple custom rules with mixed types', async () => {
      const handler = createModerationHandler({
        customRules: [
          { pattern: 'spam', reason: 'Spam keyword' },
          { pattern: /^urgent:/i, reason: 'Urgency manipulation' },
        ],
      })

      const urgentContext: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'URGENT: Click now!' }],
        },
      }

      const urgentResult = await handler(urgentContext)
      expect((urgentResult.contentModeration as { reason: string }).reason).toBe(
        'Urgency manipulation'
      )

      const spamContext: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'This is spam content' }],
        },
      }

      const spamResult = await handler(spamContext)
      expect((spamResult.contentModeration as { reason: string }).reason).toBe('Spam keyword')
    })
  })

  describe('profanity detection', () => {
    it('should detect profanity words case-insensitively', async () => {
      const handler = createModerationHandler({
        profanityWords: ['badword', 'offensive'],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'This contains BADWORD' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('inappropriate language')
    })
  })

  describe('edge cases', () => {
    it('should handle empty configuration', async () => {
      const handler = createModerationHandler()

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Normal message' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeUndefined()
      expect((result.contentModeration as { passed: boolean }).passed).toBe(true)
    })

    it('should handle assistant messages gracefully', async () => {
      const handler = createModerationHandler({
        spamPatterns: ['spam'],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'assistant', content: 'spam spam spam' }],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeUndefined()
      expect((result.contentModeration as { passed: boolean }).passed).toBe(true)
    })

    it('should use custom output key', async () => {
      const handler = createModerationHandler({
        outputKey: 'customModeration',
        spamPatterns: [],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Test' }],
        },
      }

      const result = await handler(context)

      expect(result.customModeration).toBeDefined()
      expect((result.customModeration as { passed: boolean }).passed).toBe(true)
    })

    it('should handle array content messages', async () => {
      const handler = createModerationHandler({
        profanityWords: ['badword'],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'This has a' },
                { type: 'text', text: 'badword in it' },
              ],
            },
          ],
        },
      }

      const result = await handler(context)

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('inappropriate language')
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully and allow message through', async () => {
      // Create a rule that will throw during pattern matching
      const throwingPattern = {
        test: () => {
          throw new Error('Pattern matching failed')
        },
      } as RegExp

      const handler = createModerationHandler({
        customRules: [
          {
            pattern: throwingPattern,
            reason: 'Test',
          },
        ],
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Test message' }],
        },
      }

      const result = await handler(context)

      // Should pass despite error
      expect((result.contentModeration as { passed: boolean }).passed).toBe(true)
      expect((result.contentModeration as { error?: string }).error).toBeDefined()
    })
  })
})
