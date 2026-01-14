import type { ContextConfig, ContextResult, ContextSection } from './types'

function buildContext(
  topics: string[],
  isFirstMessage: boolean,
  config: ContextConfig,
  tone?: string
): ContextResult {
  const { sections, strategy, toneInstructions } = config

  const useFullContext =
    (isFirstMessage && strategy?.firstMessage !== 'selective') ||
    (!isFirstMessage && strategy?.followUp === 'full')

  let selectedSections: ContextSection[]

  if (useFullContext) {
    selectedSections = sections
  } else {
    selectedSections = sections.filter(section => {
      if (section.alwaysInclude) return true

      if (!section.topics || section.topics.length === 0) return false

      return section.topics.some(topic => topics.includes(topic))
    })

    selectedSections.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  let systemPrompt = selectedSections.map(section => section.content).join('\n\n')

  if (tone && toneInstructions?.[tone]) {
    systemPrompt += '\n\n' + toneInstructions[tone]
  }

  // Calculate token estimates
  const tokenEstimate = Math.ceil(systemPrompt.length / 4)

  // Calculate what tokens WOULD be if all sections were loaded (for savings calculation)
  const allSectionsPrompt = sections.map(section => section.content).join('\n\n')
  const maxTokenEstimate = Math.ceil(allSectionsPrompt.length / 4)

  return {
    systemPrompt,
    sectionsIncluded: selectedSections.map(s => s.id),
    totalSections: sections.length,
    tokenEstimate,
    maxTokenEstimate,
  }
}

/**
 * Dynamic context optimizer for token reduction.
 * Selectively loads context sections based on topics and message position.
 */
export class ContextOptimizer {
  constructor(private config: ContextConfig) {}

  build(topics: string[], isFirstMessage: boolean, tone?: string): ContextResult {
    return buildContext(topics, isFirstMessage, this.config, tone)
  }

  addSection(section: ContextSection): void {
    this.config.sections.push(section)
  }

  removeSection(id: string): void {
    this.config.sections = this.config.sections.filter(s => s.id !== id)
  }

  getSections(): ContextSection[] {
    return [...this.config.sections]
  }
}
