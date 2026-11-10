import { type Fetch, TypeSafeClient } from '@typesafe-ai/sdk'
import { describe, expect, it, vi } from 'vitest'

import { JevIntentClassifier } from '../../src/intent/jev-classifier'

const categories = ['venue', 'dress_code', 'general']
const categoryDescriptions = {
  venue: 'Where the wedding is held',
  dress_code: 'What guests should wear',
  general: 'Anything else',
}

function jevResponse(answers: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      model: 'jev-1.14.0',
      answers,
      usage: { input_tokens: 120, output_tokens: 30 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function answers(topic: string, probabilities: Record<string, number>, anyTopic: number) {
  return {
    topic: { type: 'choice', choice: topic, confidence: 0.9, probabilities },
    anyTopic: { type: 'noul', noul: anyTopic },
  }
}

function createClassifier(fetch: Fetch, overrides = {}) {
  const client = new TypeSafeClient({
    apiKey: 'test-key',
    fetch,
    compression: false,
    logLevel: 'off',
  })
  return new JevIntentClassifier({ categories, categoryDescriptions, client, ...overrides })
}

describe('JevIntentClassifier', () => {
  it('returns the picked category when a topic clearly fits', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      jevResponse(answers('dress_code', { venue: 0.04, dress_code: 0.96 }, 0.98))
    )
    const result = await createClassifier(fetch).classify('Can I wear sneakers?')

    expect(result).toMatchObject({
      intent: 'dress_code',
      confidence: 0.96,
      usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
    })
    expect(result.error).toBeUndefined()
    expect(result.reasoning).toContain('jev-1.14.0')
  })

  it('sends the message and topics as state, leaving the fallback intent out of the options', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      jevResponse(answers('venue', { venue: 0.9, dress_code: 0.1 }, 0.95))
    )
    await createClassifier(fetch, { model: 'jev-1.14.0' }).classify('Where is it?')

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    const body = JSON.parse(init?.body as string)
    expect(body.model).toBe('jev-1.14.0')
    expect(body.state).toEqual({
      message: 'Where is it?',
      topics: {
        venue: 'Where the wedding is held',
        dress_code: 'What guests should wear',
      },
    })
    expect(Object.keys(body.questions.topic.criteria)).toEqual(['venue', 'dress_code'])
    expect(body.questions.anyTopic.type).toBe('noul')
  })

  it('returns the fallback intent when no topic fits, even if the Choice is confident', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      jevResponse(answers('venue', { venue: 0.97, dress_code: 0.03 }, 0.05))
    )
    const result = await createClassifier(fetch).classify('Who won the game last night?')

    expect(result.intent).toBe('general')
    expect(result.confidence).toBeCloseTo(0.95)
    expect(result.error).toBeUndefined()
  })

  it('returns the fallback intent when the match is unsettled', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      jevResponse(answers('venue', { venue: 0.8, dress_code: 0.2 }, 0.5))
    )
    const result = await createClassifier(fetch).classify('What about that?')

    expect(result.intent).toBe('general')
    expect(result.confidence).toBeCloseTo(0.5)
  })

  it('respects a custom matchThreshold and fallbackIntent', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      jevResponse(answers('venue', { venue: 0.8, dress_code: 0.2 }, 0.6))
    )
    const lenient = await createClassifier(fetch, { matchThreshold: 0.5 }).classify('Where?')
    expect(lenient.intent).toBe('venue')

    const custom = await createClassifier(fetch, {
      categories: ['venue', 'dress_code'],
      fallbackIntent: 'other',
    }).classify('Where?')
    expect(custom.intent).toBe('other')
  })

  it('reports API failures as errors instead of answers', async () => {
    const fetch = vi.fn<Fetch>(
      async () =>
        new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    const result = await createClassifier(fetch).classify('Where is it?')

    expect(result.intent).toBe('general')
    expect(result.confidence).toBe(0)
    expect(result.error).toBeDefined()
  })

  it('reports a missing API key as an error on classify, not at construction', async () => {
    const previous = process.env.TYPESAFE_API_KEY
    delete process.env.TYPESAFE_API_KEY
    try {
      const classifier = new JevIntentClassifier({ categories, categoryDescriptions })
      const result = await classifier.classify('Where is it?')
      expect(result.error).toBeDefined()
    } finally {
      if (previous !== undefined) process.env.TYPESAFE_API_KEY = previous
    }
  })

  it('throws when only the fallback intent is configured', () => {
    expect(
      () => new JevIntentClassifier({ categories: ['general'], categoryDescriptions: {} })
    ).toThrow(/at least one intent/)
  })
})
