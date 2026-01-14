import type { ContextSection } from './types'

/**
 * Interface for loading context sections dynamically.
 * Implementations can load from database, file system, or any other source.
 */
export interface ContextLoader {
  load(topics: string[], variant?: string): Promise<ContextSection[]>
}

/**
 * Simple in-memory context loader for testing or static contexts.
 */
export class StaticContextLoader implements ContextLoader {
  constructor(private sections: ContextSection[]) {}

  async load(_topics: string[], _variant?: string): Promise<ContextSection[]> {
    return this.sections
  }
}
