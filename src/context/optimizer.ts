import type { ContextConfig, ContextResult, ContextSection } from './types'

function buildContext(
  topics: string[],
  isFirstMessage: boolean,
  config: ContextConfig
): ContextResult {
  const { sections, strategy } = config

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

  const systemPrompt = selectedSections.map(section => section.content).join('\n\n')

  const tokenEstimate = Math.ceil(systemPrompt.length / 4)

  return {
    systemPrompt,
    sectionsIncluded: selectedSections.map(s => s.id),
    tokenEstimate,
  }
}

/**
 * Dynamic context optimizer for token reduction.
 * Selectively loads context sections based on topics and message position.
 */
export class ContextOptimizer {
  constructor(private config: ContextConfig) {}

  build(topics: string[], isFirstMessage: boolean): ContextResult {
    return buildContext(topics, isFirstMessage, this.config)
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
