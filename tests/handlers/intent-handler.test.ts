import { describe, expect, it, vi } from 'vitest'

import type { OrchestrationContext } from '../../src/core/types'
import { createIntentHandler } from '../../src/handlers/intent-handler'
import { IntentClassifier } from '../../src/intent/classifier'

describe('createIntentHandler', () => {
  const classifier = new IntentClassifier({
    patterns: [
      { category: 'greeting', keywords: ['hello', 'hi'] },
      { category: 'help', keywords: ['help', 'support'] },
      { category: 'question', keywords: ['what', 'how'] },
    ],
    metadata: {
      tones: {
        greeting: 'Be warm and welcoming',
        help: 'Be patient and supportive',
        question: 'Be informative and thorough',
        general: 'Be helpful and friendly',
      },
      deepLinks: {
        help: '/help',
        question: '/faq',
      },
      requiresAuth: ['account'],
    },
  })

  it('should detect intent and include tone metadata', async () => {
    const handler = createIntentHandler({
      classifier,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello there!' }],
      },
    }

    const result = await handler(context)

    expect((result.intent as any).intent).toBe('greeting')
    expect((result.intent as any).metadata?.tone).toBe('Be warm and welcoming')
    expect((result.intent as any).method).toBe('keyword')
  })

  it('should include deepLink metadata when available', async () => {
    const handler = createIntentHandler({
      classifier,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'I need help' }],
      },
    }

    const result = await handler(context)

    expect((result.intent as any).intent).toBe('help')
    expect((result.intent as any).metadata?.tone).toBe('Be patient and supportive')
    expect((result.intent as any).metadata?.deepLink).toBe('/help')
  })

  describe('LLM fallback with tone metadata preservation', () => {
    it('should preserve tone metadata for LLM-detected intent', async () => {
      // Mock LLM classifier that returns a different intent
      const mockLLMClassifier = {
        classify: vi.fn(async () => ({
          intent: 'question',
          confidence: 0.9,
          reasoning: 'User is asking a mathematical question',
        })),
      }

      const handler = createIntentHandler({
        classifier,
        llmFallback: {
          enabled: true,
          classifier: mockLLMClassifier as any,
          confidenceThreshold: 0.5,
        },
      })

      // Message with low keyword confidence
      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: '23 + 44' }],
        },
      }

      const result = await handler(context)

      // Should use LLM-detected intent
      expect((result.intent as any).intent).toBe('question')
      expect((result.intent as any).method).toBe('llm')

      // Critical: Should have tone metadata for 'question', not 'general'
      expect((result.intent as any).metadata?.tone).toBe('Be informative and thorough')
      expect((result.intent as any).metadata?.deepLink).toBe('/faq')
    })

    it('should use LLM tone when keyword detected general but LLM detects specific intent', async () => {
      const mockLLMClassifier = {
        classify: vi.fn(async () => ({
          intent: 'help',
          confidence: 0.85,
          reasoning: 'User needs assistance',
        })),
      }

      const handler = createIntentHandler({
        classifier,
        llmFallback: {
          enabled: true,
          classifier: mockLLMClassifier as any,
          confidenceThreshold: 0.5,
        },
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'I am confused' }],
        },
      }

      const result = await handler(context)

      expect((result.intent as any).intent).toBe('help')
      expect((result.intent as any).method).toBe('llm')
      expect((result.intent as any).metadata?.tone).toBe('Be patient and supportive')
      expect((result.intent as any).metadata?.deepLink).toBe('/help')
    })

    it('should handle LLM intent without metadata gracefully', async () => {
      const mockLLMClassifier = {
        classify: vi.fn(async () => ({
          intent: 'unknown-intent',
          confidence: 0.8,
          reasoning: 'Unknown intent',
        })),
      }

      const handler = createIntentHandler({
        classifier,
        llmFallback: {
          enabled: true,
          classifier: mockLLMClassifier as any,
          confidenceThreshold: 0.5,
        },
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Random text' }],
        },
      }

      const result = await handler(context)

      expect((result.intent as any).intent).toBe('unknown-intent')
      expect((result.intent as any).method).toBe('llm')
      // No metadata for unknown intent
      expect((result.intent as any).metadata?.tone).toBeUndefined()
    })

    it('should call onFallback callback when using LLM', async () => {
      const onFallbackSpy = vi.fn()
      const mockLLMClassifier = {
        classify: vi.fn(async () => ({
          intent: 'question',
          confidence: 0.9,
          reasoning: 'Math question',
        })),
      }

      const handler = createIntentHandler({
        classifier,
        llmFallback: {
          enabled: true,
          classifier: mockLLMClassifier as any,
          confidenceThreshold: 0.5,
        },
        onFallback: onFallbackSpy,
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: '23 + 44' }],
        },
      }

      await handler(context)

      expect(onFallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '23 + 44',
          keywordIntent: 'general',
          llmIntent: 'question',
        })
      )
    })

    it('should not use LLM when keyword confidence is high', async () => {
      const mockLLMClassifier = {
        classify: vi.fn(async () => ({
          intent: 'question',
          confidence: 0.9,
        })),
      }

      const handler = createIntentHandler({
        classifier,
        llmFallback: {
          enabled: true,
          classifier: mockLLMClassifier as any,
          confidenceThreshold: 0.5,
        },
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'Hello there! Hi everyone!' }],
        },
      }

      await handler(context)

      // LLM should not be called because "hello" and "hi" give high confidence
      expect(mockLLMClassifier.classify).not.toHaveBeenCalled()
    })

    it('should preserve all metadata fields during LLM fallback', async () => {
      const classifierWithAuth = new IntentClassifier({
        patterns: [
          { category: 'account', keywords: ['account'] },
          { category: 'general', keywords: [] },
        ],
        metadata: {
          tones: {
            account: 'Be secure and professional',
          },
          deepLinks: {
            account: '/account',
          },
          requiresAuth: ['account'],
        },
      })

      const mockLLMClassifier = {
        classify: vi.fn(async () => ({
          intent: 'account',
          confidence: 0.95,
          reasoning: 'User wants to access account',
        })),
      }

      const handler = createIntentHandler({
        classifier: classifierWithAuth,
        llmFallback: {
          enabled: true,
          classifier: mockLLMClassifier as any,
          confidenceThreshold: 0.5,
        },
      })

      const context: OrchestrationContext = {
        request: {
          messages: [{ role: 'user', content: 'show my profile' }],
        },
      }

      const result = await handler(context)

      expect((result.intent as any).intent).toBe('account')
      expect((result.intent as any).metadata?.tone).toBe('Be secure and professional')
      expect((result.intent as any).metadata?.deepLink).toBe('/account')
      expect((result.intent as any).metadata?.requiresAuth).toBe(true)
    })
  })

  it('should handle empty messages', async () => {
    const handler = createIntentHandler({
      classifier,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'assistant', content: 'Hi' }],
      },
    }

    const result = await handler(context)

    expect((result.intent as any).intent).toBe('general')
    expect((result.intent as any).confidence).toBe(0)
  })

  it('should use custom context key', async () => {
    const handler = createIntentHandler({
      classifier,
      contextKey: 'customIntent',
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect(result.customIntent).toBeDefined()
    expect((result.customIntent as any).intent).toBe('greeting')
  })
})
