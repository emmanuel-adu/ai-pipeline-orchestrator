export interface IntentPattern {
  category: string
  keywords: string[]
}

export interface IntentConfig {
  patterns: IntentPattern[]
  metadata?: {
    deepLinks?: Record<string, string>
    tones?: Record<string, string>
    requiresAuth?: string[]
    [key: string]: unknown
  }
}

export interface IntentResult {
  intent: string
  confidence: number
  matchedKeywords?: string[]
  metadata?: Record<string, unknown>
}

export interface AsyncIntentResult {
  intent: string
  confidence: number
  reasoning?: string
  usage?: any
  /** Set when classification itself failed, so callers can tell a failure from a real answer. */
  error?: string
}

/** Contract for classifiers that call a model, used by createIntentHandler's llmFallback. */
export interface AsyncIntentClassifier {
  classify(message: string): Promise<AsyncIntentResult>
}
