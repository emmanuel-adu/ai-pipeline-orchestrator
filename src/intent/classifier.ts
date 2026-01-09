import type { IntentConfig, IntentPattern, IntentResult } from './types'

function detectIntent(
  message: string,
  config: IntentConfig
): IntentResult {
  const lowerMessage = message.toLowerCase()
  const { patterns, metadata } = config

  const intentScores: Array<{
    intent: string
    score: number
    keywords: string[]
  }> = []

  for (const { category, keywords } of patterns) {
    let score = 0
    const matchedKeywords: string[] = []

    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        const wordCount = keyword.split(' ').length
        score += wordCount
        matchedKeywords.push(keyword)
      }
    }

    if (score > 0) {
      intentScores.push({
        intent: category,
        score,
        keywords: matchedKeywords,
      })
    }
  }

  intentScores.sort((a, b) => b.score - a.score)

  const bestResult = intentScores[0]
  const secondBestResult = intentScores[1]

  if (!bestResult) {
    return {
      intent: 'general',
      confidence: 0,
      matchedKeywords: [],
    }
  }

  const bestScore = bestResult.score
  const secondBestScore = secondBestResult?.score || 0
  const margin = bestScore - secondBestScore
  const confidence = Math.min(margin / Math.max(bestScore, 1), 1)

  const result: IntentResult = {
    intent: bestResult.intent,
    confidence,
    matchedKeywords: bestResult.keywords,
  }

  if (metadata) {
    result.metadata = {}
    if (metadata.deepLinks?.[bestResult.intent]) {
      result.metadata.deepLink = metadata.deepLinks[bestResult.intent]
    }
    if (metadata.tones?.[bestResult.intent]) {
      result.metadata.tone = metadata.tones[bestResult.intent]
    }
    if (metadata.requiresAuth?.includes(bestResult.intent)) {
      result.metadata.requiresAuth = true
    }
  }

  return result
}

/**
 * Keyword-based intent classifier using pattern matching.
 * Fast and free - no LLM calls required.
 */
export class IntentClassifier {
  constructor(private config: IntentConfig) {}

  classify(message: string): IntentResult {
    return detectIntent(message, this.config)
  }

  addPattern(pattern: IntentPattern): void {
    this.config.patterns.push(pattern)
  }

  removePattern(category: string): void {
    this.config.patterns = this.config.patterns.filter(
      (p) => p.category !== category
    )
  }

  getPatterns(): IntentPattern[] {
    return [...this.config.patterns]
  }
}
