import { describe, expect, it } from 'vitest'

import { ContextOptimizer } from '../../src/context'

describe('ContextOptimizer', () => {
  const optimizer = new ContextOptimizer({
    sections: [
      {
        id: 'core',
        name: 'Core Instructions',
        content: 'You are a helpful AI assistant.',
        alwaysInclude: true,
      },
      {
        id: 'greeting',
        name: 'Greeting Guide',
        content: 'Greet users warmly.',
        topics: ['greeting', 'hello'],
      },
      {
        id: 'help',
        name: 'Help Documentation',
        content: 'Provide detailed help when asked.',
        topics: ['help', 'support'],
      },
      {
        id: 'technical',
        name: 'Technical Guide',
        content: 'Technical documentation for advanced users.',
        topics: ['technical', 'advanced'],
      },
    ],
    strategy: {
      firstMessage: 'selective',
      followUp: 'selective',
    },
  })

  describe('build', () => {
    it('should always include sections marked with alwaysInclude', () => {
      const result = optimizer.build([], true)

      expect(result.sectionsIncluded).toContain('core')
    })

    it('should include sections matching requested topics', () => {
      const result = optimizer.build(['greeting'], true)

      expect(result.sectionsIncluded).toContain('core')
      expect(result.sectionsIncluded).toContain('greeting')
      expect(result.sectionsIncluded).not.toContain('help')
    })

    it('should include multiple sections for multiple topics', () => {
      const result = optimizer.build(['greeting', 'help'], true)

      expect(result.sectionsIncluded).toContain('core')
      expect(result.sectionsIncluded).toContain('greeting')
      expect(result.sectionsIncluded).toContain('help')
    })

    it('should generate combined system prompt', () => {
      const result = optimizer.build(['greeting'], true)

      expect(result.systemPrompt).toContain('You are a helpful AI assistant.')
      expect(result.systemPrompt).toContain('Greet users warmly.')
      expect(result.systemPrompt).not.toContain('Provide detailed help')
    })

    it('should estimate token count', () => {
      const result = optimizer.build(['greeting'], true)

      expect(result.tokenEstimate).toBeGreaterThan(0)
      expect(result.tokenEstimate).toBeLessThan(result.maxTokenEstimate || Infinity)
    })

    it('should provide max token estimate', () => {
      const result = optimizer.build([], true)

      expect(result.maxTokenEstimate).toBeGreaterThan(0)
    })

    it('should indicate token savings when using selective strategy', () => {
      const full = optimizer.build(['greeting', 'help', 'technical'], true)
      const selective = optimizer.build(['greeting'], true)

      expect(selective.tokenEstimate).toBeLessThan(full.tokenEstimate)
    })

    it('should handle unknown topics gracefully', () => {
      const result = optimizer.build(['unknown-topic'], true)

      expect(result.sectionsIncluded).toContain('core')
      expect(result.sectionsIncluded).not.toContain('greeting')
    })

    it('should handle empty topics array', () => {
      const result = optimizer.build([], true)

      expect(result.sectionsIncluded).toContain('core')
      expect(result.sectionsIncluded.length).toBeGreaterThan(0)
    })

    it('should track total sections count', () => {
      const result = optimizer.build(['greeting'], true)

      expect(result.totalSections).toBe(4)
    })
  })

  describe('with full strategy', () => {
    it('should include all sections when strategy is full', () => {
      const fullOptimizer = new ContextOptimizer({
        sections: [
          {
            id: 'section1',
            content: 'Content 1',
            topics: ['topic1'],
          },
          {
            id: 'section2',
            content: 'Content 2',
            topics: ['topic2'],
          },
        ],
        strategy: {
          firstMessage: 'full',
          followUp: 'full',
        },
      })

      const result = fullOptimizer.build(['topic1'], true)

      expect(result.sectionsIncluded).toContain('section1')
      expect(result.sectionsIncluded).toContain('section2')
    })
  })

  describe('edge cases', () => {
    it('should handle optimizer with no sections', () => {
      const emptyOptimizer = new ContextOptimizer({
        sections: [],
      })

      const result = emptyOptimizer.build([], true)

      expect(result.sectionsIncluded).toHaveLength(0)
      expect(result.systemPrompt).toBe('')
    })

    it('should handle duplicate topics', () => {
      const result = optimizer.build(['greeting', 'greeting', 'hello'], true)

      expect(result.sectionsIncluded).toContain('greeting')
      // Should not include greeting twice
      const greetingCount = result.sectionsIncluded.filter(s => s === 'greeting').length
      expect(greetingCount).toBe(1)
    })

    it('should handle very long content', () => {
      const longOptimizer = new ContextOptimizer({
        sections: [
          {
            id: 'long',
            content: 'word '.repeat(10000),
            alwaysInclude: true,
          },
        ],
      })

      const result = longOptimizer.build([], true)

      expect(result.tokenEstimate).toBeGreaterThan(1000)
    })
  })

  describe('section metadata', () => {
    it('should preserve section names in result', () => {
      const result = optimizer.build(['greeting'], true)

      expect(result.sectionsIncluded).toContain('greeting')
    })

    it('should maintain section order', () => {
      const result = optimizer.build(['technical', 'greeting'], true)

      const greetingIndex = result.sectionsIncluded.indexOf('greeting')
      const technicalIndex = result.sectionsIncluded.indexOf('technical')

      expect(greetingIndex).toBeLessThan(technicalIndex)
    })
  })

  describe('tone injection', () => {
    it('should inject tone instructions when tone is provided', () => {
      const optimizerWithTones = new ContextOptimizer({
        sections: [
          {
            id: 'core',
            content: 'You are a helpful assistant.',
            alwaysInclude: true,
          },
        ],
        toneInstructions: {
          friendly: 'Be warm and conversational.',
          professional: 'Be formal and precise.',
        },
      })

      const result = optimizerWithTones.build([], true, 'friendly')

      expect(result.systemPrompt).toContain('You are a helpful assistant.')
      expect(result.systemPrompt).toContain('Be warm and conversational.')
    })

    it('should not inject tone when tone is not provided', () => {
      const optimizerWithTones = new ContextOptimizer({
        sections: [
          {
            id: 'core',
            content: 'You are a helpful assistant.',
            alwaysInclude: true,
          },
        ],
        toneInstructions: {
          friendly: 'Be warm and conversational.',
        },
      })

      const result = optimizerWithTones.build([], true)

      expect(result.systemPrompt).toContain('You are a helpful assistant.')
      expect(result.systemPrompt).not.toContain('Be warm and conversational.')
    })

    it('should not inject tone when tone does not exist in config', () => {
      const optimizerWithTones = new ContextOptimizer({
        sections: [
          {
            id: 'core',
            content: 'You are a helpful assistant.',
            alwaysInclude: true,
          },
        ],
        toneInstructions: {
          friendly: 'Be warm and conversational.',
        },
      })

      const result = optimizerWithTones.build([], true, 'nonexistent')

      expect(result.systemPrompt).toContain('You are a helpful assistant.')
      expect(result.systemPrompt).not.toContain('Be warm and conversational.')
    })

    it('should work without toneInstructions config', () => {
      const optimizerNoTones = new ContextOptimizer({
        sections: [
          {
            id: 'core',
            content: 'You are a helpful assistant.',
            alwaysInclude: true,
          },
        ],
      })

      const result = optimizerNoTones.build([], true, 'friendly')

      expect(result.systemPrompt).toBe('You are a helpful assistant.')
    })

    it('should append tone after section content', () => {
      const optimizerWithTones = new ContextOptimizer({
        sections: [
          {
            id: 'core',
            content: 'Core instructions.',
            alwaysInclude: true,
          },
          {
            id: 'greeting',
            content: 'Greeting instructions.',
            topics: ['greeting'],
          },
        ],
        toneInstructions: {
          friendly: 'Tone instructions.',
        },
      })

      const result = optimizerWithTones.build(['greeting'], true, 'friendly')

      const promptParts = result.systemPrompt.split('\n\n')
      expect(promptParts).toHaveLength(3)
      expect(promptParts[0]).toBe('Core instructions.')
      expect(promptParts[1]).toBe('Greeting instructions.')
      expect(promptParts[2]).toBe('Tone instructions.')
    })

    it('should increase token estimate when tone is injected', () => {
      const optimizerWithTones = new ContextOptimizer({
        sections: [
          {
            id: 'core',
            content: 'Core instructions.',
            alwaysInclude: true,
          },
        ],
        toneInstructions: {
          friendly: 'Be warm and conversational with users.',
        },
      })

      const withoutTone = optimizerWithTones.build([], true)
      const withTone = optimizerWithTones.build([], true, 'friendly')

      expect(withTone.tokenEstimate).toBeGreaterThan(withoutTone.tokenEstimate)
    })
  })
})
