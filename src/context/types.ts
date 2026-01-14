export interface ContextSection {
  id: string
  name: string
  content: string
  topics?: string[]
  alwaysInclude?: boolean
  priority?: number
}

export interface ContextStrategy {
  firstMessage: 'full' | 'selective'
  followUp: 'full' | 'selective'
}

export interface ContextConfig {
  sections: ContextSection[]
  strategy?: ContextStrategy
  toneInstructions?: Record<string, string>
}

export interface ContextResult {
  systemPrompt: string
  sectionsIncluded: string[]
  totalSections?: number
  tokenEstimate?: number
  maxTokenEstimate?: number
}
