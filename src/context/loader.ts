import type { ContextSection } from './types'

export interface ContextLoadOptions {
  topics?: string[]
  variant?: string
  isFirstMessage?: boolean
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface ContextLoader {
  load(options: ContextLoadOptions): Promise<ContextSection[]>
}

export class StaticContextLoader implements ContextLoader {
  constructor(private sections: ContextSection[]) {}

  async load(_options: ContextLoadOptions): Promise<ContextSection[]> {
    return this.sections
  }
}
