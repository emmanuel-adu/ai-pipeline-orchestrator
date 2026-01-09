import { z } from 'zod'

export interface LLMClassifierConfig {
  model?: string
  categories: string[]
  categoryDescriptions: Record<string, string>
  promptTemplate?: (message: string, categories: string, descriptions: string) => string
  temperature?: number
  apiKey?: string
}

async function classifyWithLLM(
  message: string,
  config: LLMClassifierConfig
): Promise<{
  intent: string
  confidence: number
  reasoning?: string
}> {
  try {
    const { createAnthropic } = await import('@ai-sdk/anthropic')
    const { generateObject } = await import('ai')

    const schema = z.object({
      intent: z.enum(config.categories as [string, ...string[]]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional(),
    })

    const categoryList = config.categories
      .map((cat) => `- ${cat}: ${config.categoryDescriptions[cat] || ''}`)
      .join('\n')

    const prompt = config.promptTemplate
      ? config.promptTemplate(message, config.categories.join(', '), categoryList)
      : buildDefaultPrompt(message, categoryList)

    const anthropic = createAnthropic({ apiKey: config.apiKey })

    const { object } = await generateObject({
      model: anthropic(config.model || 'claude-3-5-haiku-20241022'),
      schema,
      prompt,
      temperature: config.temperature ?? 0.3,
    })

    return object
  } catch (error) {
    return {
      intent: 'general',
      confidence: 0,
      reasoning: error instanceof Error ? error.message : 'LLM classification failed',
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
 * LLM-based intent classifier using Claude.
 * More accurate than keyword matching but requires API calls.
 */
export class LLMIntentClassifier {
  constructor(private config: LLMClassifierConfig) {}

  async classify(message: string): Promise<{
    intent: string
    confidence: number
    reasoning?: string
  }> {
    return classifyWithLLM(message, this.config)
  }
}
