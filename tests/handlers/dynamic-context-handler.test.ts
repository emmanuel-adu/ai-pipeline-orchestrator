import { describe, expect, it, vi } from 'vitest'

import { TTLCache } from '../../src/context/cache'
import type { ContextLoader } from '../../src/context/loader'
import type { ContextSection } from '../../src/context/types'
import type { OrchestrationContext } from '../../src/core/types'
import { createDynamicContextHandler } from '../../src/handlers/dynamic-context-handler'

describe('createDynamicContextHandler', () => {
  const mockSections: ContextSection[] = [
    {
      id: 'core',
      name: 'Core',
      content: 'Core instructions',
      alwaysInclude: true,
      priority: 10,
    },
    {
      id: 'greeting',
      name: 'Greeting',
      content: 'Greeting instructions',
      topics: ['greeting'],
      priority: 5,
    },
    {
      id: 'help',
      name: 'Help',
      content: 'Help instructions',
      topics: ['help'],
      priority: 5,
    },
  ]

  const mockLoader: ContextLoader = {
    load: vi.fn(async _options => mockSections),
  }

  it('should load contexts dynamically', async () => {
    const handler = createDynamicContextHandler({
      loader: mockLoader,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect(mockLoader.load).toHaveBeenCalled()
    expect(result.promptContext).toBeDefined()
    expect((result.promptContext as any).systemPrompt).toContain('Core instructions')
  })

  it('should use cache when provided', async () => {
    const cache = new TTLCache<ContextSection[]>(60000)
    const loadSpy = vi.fn(async _options => mockSections)
    const loaderWithSpy: ContextLoader = {
      load: loadSpy,
    }

    const handler = createDynamicContextHandler({
      loader: loaderWithSpy,
      cache,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    // First call
    await handler(context)
    expect(loadSpy).toHaveBeenCalledTimes(1)

    // Second call should use cache
    await handler(context)
    expect(loadSpy).toHaveBeenCalledTimes(1) // Still 1, not called again
  })

  it('should support variant selection', async () => {
    const loadSpy = vi.fn(async options => {
      if (options.variant === 'variant-a') {
        return [{ id: 'a', name: 'A', content: 'Variant A', alwaysInclude: true, priority: 10 }]
      }
      return [{ id: 'b', name: 'B', content: 'Variant B', alwaysInclude: true, priority: 10 }]
    })

    const loaderWithVariants: ContextLoader = {
      load: loadSpy,
    }

    const handler = createDynamicContextHandler({
      loader: loaderWithVariants,
      getVariant: () => 'variant-a',
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect(loadSpy).toHaveBeenCalledWith({ topics: [], variant: 'variant-a', isFirstMessage: true })
    expect((result.promptContext as any).systemPrompt).toContain('Variant A')
    expect((result.promptContext as any).variant).toBe('variant-a')
  })

  it('should call onVariantUsed when variant is used', async () => {
    const onVariantUsedSpy = vi.fn()

    const handler = createDynamicContextHandler({
      loader: mockLoader,
      getVariant: () => 'test-variant',
      onVariantUsed: onVariantUsedSpy,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    await handler(context)

    expect(onVariantUsedSpy).toHaveBeenCalledWith({
      variant: 'test-variant',
      topics: [],
    })
  })

  it('should pass topics to loader', async () => {
    const loadSpy = vi.fn(async _options => mockSections)
    const loaderWithSpy: ContextLoader = {
      load: loadSpy,
    }

    const handler = createDynamicContextHandler({
      loader: loaderWithSpy,
      getTopics: () => ['greeting', 'help'],
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    await handler(context)

    expect(loadSpy).toHaveBeenCalledWith({
      topics: ['greeting', 'help'],
      variant: undefined,
      isFirstMessage: true,
    })
  })

  it('should filter sections based on topics for follow-up messages', async () => {
    const handler = createDynamicContextHandler({
      loader: mockLoader,
      getTopics: () => ['greeting'],
      isFirstMessage: () => false, // Follow-up message
    })

    const context: OrchestrationContext = {
      request: {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
          { role: 'user', content: 'Hello again' },
        ],
      },
    }

    const result = await handler(context)

    expect((result.promptContext as any).sectionsIncluded).toContain('core')
    expect((result.promptContext as any).sectionsIncluded).toContain('greeting')
    expect((result.promptContext as any).sectionsIncluded).not.toContain('help')
  })

  it('should include all sections for first message', async () => {
    const handler = createDynamicContextHandler({
      loader: mockLoader,
      getTopics: () => ['greeting'],
      isFirstMessage: () => true,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect((result.promptContext as any).sectionsIncluded).toContain('core')
    expect((result.promptContext as any).sectionsIncluded).toContain('greeting')
    expect((result.promptContext as any).sectionsIncluded).toContain('help')
  })

  it('should sort sections by priority', async () => {
    const sectionsWithPriority: ContextSection[] = [
      { id: 'low', name: 'Low', content: 'Low priority', topics: ['test'], priority: 1 },
      { id: 'high', name: 'High', content: 'High priority', topics: ['test'], priority: 10 },
      { id: 'mid', name: 'Mid', content: 'Mid priority', topics: ['test'], priority: 5 },
    ]

    const loaderWithPriority: ContextLoader = {
      load: async _options => sectionsWithPriority,
    }

    const handler = createDynamicContextHandler({
      loader: loaderWithPriority,
      getTopics: () => ['test'],
      isFirstMessage: () => false,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Test' }],
      },
    }

    const result = await handler(context)
    const sections = (result.promptContext as any).sectionsIncluded

    expect(sections[0]).toBe('high')
    expect(sections[1]).toBe('mid')
    expect(sections[2]).toBe('low')
  })

  it('should calculate token estimates', async () => {
    const handler = createDynamicContextHandler({
      loader: mockLoader,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect((result.promptContext as any).tokenEstimate).toBeGreaterThan(0)
    expect((result.promptContext as any).maxTokenEstimate).toBeGreaterThan(0)
  })

  it('should handle loader errors gracefully', async () => {
    const failingLoader: ContextLoader = {
      load: async _options => {
        throw new Error('Database connection failed')
      },
    }

    const handler = createDynamicContextHandler({
      loader: failingLoader,
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect(result.error).toBeDefined()
    expect(result.error?.message).toContain('Failed to build context')
  })

  it('should use custom output key', async () => {
    const handler = createDynamicContextHandler({
      loader: mockLoader,
      outputKey: 'customContext',
    })

    const context: OrchestrationContext = {
      request: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }

    const result = await handler(context)

    expect(result.customContext).toBeDefined()
    expect((result.customContext as any).systemPrompt).toBeDefined()
  })
})
