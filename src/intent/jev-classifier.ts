/**
 * Intent classifier backed by TypeSafe's Jev decision model.
 *
 * SETUP: npm install @typesafe-ai/sdk (requires Node.js 22+) and set TYPESAFE_API_KEY
 */
import type { AsyncIntentClassifier, AsyncIntentResult } from './types'

import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk'

export interface JevClassifierConfig {
  categories: string[]
  categoryDescriptions: Record<string, string>
  /**
   * Intent returned when no category fits the message. It is left out of the Jev
   * options even if listed in `categories`, because a catch-all option competes with
   * the real ones for probability. Default: 'general'.
   */
  fallbackIntent?: string
  /**
   * Minimum probability that the message fits any category before the picked category
   * is used. Below it, the classifier returns `fallbackIntent`. Default: 0.7.
   */
  matchThreshold?: number
  /**
   * Model ID. Default: 'jev-latest'. Pin a versioned ID such as 'jev-1.14.0' once your
   * thresholds are tuned, since the alias moves with each release.
   */
  model?: string
  /** Falls back to the TYPESAFE_API_KEY environment variable. */
  apiKey?: string
  /** Per-attempt timeout. Default: 5000, since this runs on the chat request path. */
  timeoutMs?: number
  /** Retries after the first attempt (429s, 5xx, connection errors). Default: 1. */
  maxRetries?: number
  /** Preconfigured client, e.g. for a custom base URL or tests. Overrides apiKey. */
  client?: TypeSafeClient
}

/**
 * Jev returns calibrated probabilities over a fixed option list instead of generated
 * text, so there is no output to parse and output tokens are free.
 *
 * Each call sends one request with two questions over the same state: a Choice that
 * picks the closest category, and a Noul that asks whether any category fits at all.
 * A Choice always picks something, so the Noul is what lets an off-topic message fall
 * through to `fallbackIntent`.
 */
export class JevIntentClassifier implements AsyncIntentClassifier {
  private readonly topics: Record<string, string>
  private readonly fallbackIntent: string
  private readonly matchThreshold: number
  private client?: TypeSafeClient

  constructor(private readonly config: JevClassifierConfig) {
    this.fallbackIntent = config.fallbackIntent ?? 'general'
    this.matchThreshold = config.matchThreshold ?? 0.7
    this.client = config.client

    const topicNames = config.categories.filter(category => category !== this.fallbackIntent)
    if (topicNames.length === 0) {
      throw new Error(
        `JevIntentClassifier: categories must include at least one intent besides '${this.fallbackIntent}'`
      )
    }
    this.topics = Object.fromEntries(
      topicNames.map(name => [name, config.categoryDescriptions[name] ?? name])
    )
  }

  async classify(message: string): Promise<AsyncIntentResult> {
    try {
      // Created lazily so a missing key or unsupported runtime surfaces as a classification
      // error the intent handler can fall back from, not a crash at import time.
      this.client ??= new TypeSafeClient({ apiKey: this.config.apiKey })

      const options = Object.fromEntries(Object.keys(this.topics).map(name => [name, null]))
      const response = await this.client.systemOne(
        {
          model: this.config.model,
          state: { message, topics: this.topics },
          questions: {
            topic: choice(
              'Which topic in `topics` is the user asking about in `message`?',
              options
            ),
            anyTopic: noul('Is the user asking about one of the topics in `topics`?', {
              true: 'The user asks about something a topic in `topics` covers.',
              false: 'The user asks about something no topic in `topics` covers.',
            }),
          },
        },
        {
          timeout: this.config.timeoutMs ?? 5000,
          retry: { maxRetries: this.config.maxRetries ?? 1 },
        }
      )

      const { topic, anyTopic } = response.answers
      const topicProbability = topic.probabilities[topic.choice] ?? 0
      const usage = {
        inputTokens: response.usage.input_tokens ?? 0,
        outputTokens: response.usage.output_tokens ?? 0,
        totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
      }
      const reasoning = `${response.model}: p(any topic fits)=${anyTopic.noul.toFixed(2)}, p(${topic.choice})=${topicProbability.toFixed(2)}`

      if (anyTopic.noul < this.matchThreshold) {
        return {
          intent: this.fallbackIntent,
          confidence: 1 - anyTopic.noul,
          reasoning,
          usage,
        }
      }

      return {
        intent: topic.choice,
        confidence: topicProbability,
        reasoning,
        usage,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        intent: this.fallbackIntent,
        confidence: 0,
        reasoning: `Jev classification failed: ${errorMessage}`,
        error: errorMessage,
      }
    }
  }
}
