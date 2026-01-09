export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | Array<{ type?: string; text?: string; [key: string]: unknown }>
  [key: string]: unknown
}

export interface OrchestrationContext {
  request: {
    messages: Message[]
    metadata?: Record<string, unknown>
  }

  error?: {
    message: string
    statusCode: number
    retryAfter?: number
    step?: string
    details?: string
  }

  [key: string]: unknown
}

export type OrchestrationHandler = (context: OrchestrationContext) => Promise<OrchestrationContext>

export interface OrchestrationStep {
  name: string
  handler: OrchestrationHandler
  enabled?: boolean
}

export interface OrchestrationResult {
  success: boolean
  context: OrchestrationContext
  error?: {
    message: string
    statusCode: number
    retryAfter?: number
    step?: string
    details?: string
  }
}
