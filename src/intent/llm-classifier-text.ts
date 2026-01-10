import { createModel, type ProviderConfig } from '../providers'

export interface TextLLMClassifierConfig extends ProviderConfig {
  categories: string[]
  categoryDescriptions: Record<string, string>
  promptTemplate?: (message: string, categories: string, descriptions: string) => string
  temperature?: number
}

async function classifyWithTextLLM(
  message: string,
  config: TextLLMClassifierConfig
): Promise<{
  intent: string
  confidence: number
  reasoning?: string
  usage?: any
}> {
  try {
    const { generateText } = await import('ai')

    const categoryList = config.categories
      .map(cat => `- ${cat}: ${config.categoryDescriptions[cat] || ''}`)
      .join('\n')

    const prompt =
      config.promptTemplate?.(message, config.categories.join(', '), categoryList) ||
      buildDefaultPrompt(message, categoryList, config.categories)

    const model = await createModel(config)

    const result = await generateText({
      model,
      prompt,
      temperature: config.temperature ?? 0.3,
    })

    const usage = await result.usage

    // Parse the response
    const parsed = parseResponse(result.text, config.categories)

    return {
      ...parsed,
      usage,
    }
  } catch (error) {
    return {
      intent: 'general',
      confidence: 0,
      reasoning: error instanceof Error ? error.message : 'LLM classification failed',
    }
  }
}

function buildDefaultPrompt(message: string, categoryList: string, categories: string[]): string {
  return `Classify this message into ONE of these intent categories:

${categoryList}

User message: "${message}"

Respond in this exact format:
INTENT: [one of: ${categories.join(', ')}]
CONFIDENCE: [number between 0.0 and 1.0]
REASONING: [brief explanation]

Example:
INTENT: greeting
CONFIDENCE: 0.95
REASONING: User is saying hello`
}

function parseResponse(
  text: string,
  validCategories: string[]
): {
  intent: string
  confidence: number
  reasoning?: string
} {
  // Extract intent
  const intentMatch = text.match(/INTENT:\s*(\w+)/i)
  let intent = intentMatch ? intentMatch[1].toLowerCase() : 'general'

  // Validate intent is in categories
  if (!validCategories.includes(intent)) {
    intent = 'general'
  }

  // Extract confidence
  const confidenceMatch = text.match(/CONFIDENCE:\s*([\d.]+)/i)
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5

  // Extract reasoning
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?:\n|$)/i)
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined

  return {
    intent,
    confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
    reasoning,
  }
}

/**
 * Text-based LLM intent classifier.
 * Works with models that don't support structured output (like some Ollama models).
 * Uses text generation with manual parsing instead of generateObject.
 */
export class TextLLMIntentClassifier {
  constructor(private config: TextLLMClassifierConfig) {}

  async classify(message: string): Promise<{
    intent: string
    confidence: number
    reasoning?: string
    usage?: any
  }> {
    return classifyWithTextLLM(message, this.config)
  }
}
