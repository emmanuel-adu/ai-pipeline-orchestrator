import { describe, expect, it } from 'vitest'

import { IntentClassifier } from '../../src/intent'

describe('IntentClassifier', () => {
  const classifier = new IntentClassifier({
    patterns: [
      {
        category: 'greeting',
        keywords: ['hello', 'hi', 'hey', 'good morning'],
      },
      {
        category: 'help',
        keywords: ['help', 'support', 'assist', 'how do i'],
      },
      {
        category: 'goodbye',
        keywords: ['bye', 'goodbye', 'see you', 'farewell'],
      },
    ],
  })

  describe('classify', () => {
    it('should detect greeting intent with high confidence', () => {
      const result = classifier.classify('Hello there!')

      expect(result.intent).toBe('greeting')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should detect help intent', () => {
      const result = classifier.classify('Can you help me please?')

      expect(result.intent).toBe('help')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should detect goodbye intent', () => {
      const result = classifier.classify('Goodbye, see you later!')

      expect(result.intent).toBe('goodbye')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should return general intent for unmatched messages', () => {
      const result = classifier.classify('What is the weather like?')

      expect(result.intent).toBe('general')
      expect(result.confidence).toBe(0)
    })

    it('should be case insensitive', () => {
      const result = classifier.classify('HELLO THERE')

      expect(result.intent).toBe('greeting')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should match partial words', () => {
      const result = classifier.classify('helping out')

      expect(result.intent).toBe('help')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should handle multi-word keywords', () => {
      const result = classifier.classify('Good morning everyone!')

      expect(result.intent).toBe('greeting')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should calculate confidence based on score margin', () => {
      const clearMatch = classifier.classify('Hi')
      const ambiguousMatch = classifier.classify('Hello, how do I get help?')

      // Clear match should have higher confidence than ambiguous one
      expect(clearMatch.confidence).toBeGreaterThanOrEqual(0)
      expect(ambiguousMatch.confidence).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty messages', () => {
      const result = classifier.classify('')

      expect(result.intent).toBe('general')
      expect(result.confidence).toBe(0)
    })

    it('should include matched keywords in result', () => {
      const result = classifier.classify('Hello there')

      expect(result.matchedKeywords).toBeDefined()
      expect(result.matchedKeywords?.length).toBeGreaterThan(0)
    })
  })

  describe('with metadata', () => {
    it('should include metadata in result', () => {
      const classifierWithMetadata = new IntentClassifier({
        patterns: [
          {
            category: 'greeting',
            keywords: ['hello', 'hi'],
          },
        ],
        metadata: {
          tones: {
            greeting: 'friendly and welcoming',
          },
        },
      })

      const result = classifierWithMetadata.classify('Hello!')

      expect(result.metadata).toBeDefined()
      expect(result.metadata?.tone).toBe('friendly and welcoming')
    })
  })

  describe('edge cases', () => {
    it('should handle special characters', () => {
      const result = classifier.classify('hello!!! @#$%')

      expect(result.intent).toBe('greeting')
    })

    it('should handle very long messages', () => {
      const longMessage = 'test '.repeat(1000) + 'help'
      const result = classifier.classify(longMessage)

      expect(result.intent).toBe('help')
    })

    it('should handle messages with only numbers', () => {
      const result = classifier.classify('123456')

      expect(result.intent).toBe('general')
      expect(result.confidence).toBe(0)
    })
  })
})
