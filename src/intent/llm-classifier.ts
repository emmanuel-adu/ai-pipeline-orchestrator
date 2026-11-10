import type { AsyncIntentClassifier, AsyncIntentResult } from './types'

import { z } from 'zod'

import { createModel, type ProviderConfig } from '../providers'

export interface LLMClassifierConfig extends ProviderConfig {
  categories: string[]
  categoryDescriptions: Record<string, string>
  promptTemplate?: (message: string, categories: string, descriptions: string) => string
  temperature?: number
}

async function classifyWithLLM(
  message: string,
  config: LLMClassifierConfig
): Promise<AsyncIntentResult> {
  try {
    const { generateObject } = await import('ai')

    const schema = z.object({
      intent: z.enum(config.categories as [string, ...string[]]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional(),
    })

    const categoryList = config.categories
      .map(cat => `- ${cat}: ${config.categoryDescriptions[cat] || ''}`)
      .join('\n')

    const prompt = config.promptTemplate
      ? config.promptTemplate(message, config.categories.join(', '), categoryList)
      : buildDefaultPrompt(message, categoryList)

    const model = await createModel(config)

    const result = await generateObject({
      model,
      schema,
      prompt,
      temperature: config.temperature ?? 0.3,
    })

    const usage = await result.usage

    return {
      ...result.object,
      usage,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'LLM classification failed'
    return {
      intent: 'general',
      confidence: 0,
      reasoning: errorMessage,
      error: errorMessage,
    }
  }
}

function buildDefaultPrompt(message: string, categoryList: string): string {
  return `Classify this message into ONE of these intent categories:

${categoryList}

User message: "${message}"

Return the most likely intent, confidence (0-1), and brief reasoning.`
}

/**
 * LLM-based intent classifier.
 * More accurate than keyword matching but requires API calls.
 */
export class LLMIntentClassifier implements AsyncIntentClassifier {
  constructor(private config: LLMClassifierConfig) {}

  async classify(message: string): Promise<AsyncIntentResult> {
    return classifyWithLLM(message, this.config)
  }
}
