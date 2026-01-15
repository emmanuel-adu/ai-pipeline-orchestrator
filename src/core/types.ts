export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | Array<{ type?: string; text?: string; [key: string]: unknown }>
  [key: string]: unknown
}

/**
 * Core orchestration context that flows through the pipeline.
 *
 * This interface is designed to be extensible - you can add custom properties
 * to the context and TypeScript will allow them thanks to the index signature.
 *
 * @example Basic extension (runtime only)
 * ```typescript
 * const context: OrchestrationContext = {
 *   request: { messages: [...] },
 *   customField: 'value',  // Allowed by index signature
 *   userId: '123',         // Allowed by index signature
 * }
 * ```
 *
 * @example Type-safe extension (recommended)
 * ```typescript
 * interface MyContext extends OrchestrationContext {
 *   userId: string
 *   isAdmin: boolean
 *   tools?: Record<string, unknown>
 * }
 *
 * const handler = async (context: MyContext): Promise<MyContext> => {
 *   // TypeScript knows about userId, isAdmin, tools
 *   if (context.isAdmin) {
 *     // ...
 *   }
 *   return context
 * }
 * ```
 */
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

  // Allow custom properties to be added to context
  [key: string]: unknown
}

/**
 * Handler function that processes orchestration context.
 *
 * Handlers receive context, perform their logic, and return updated context.
 * They can add new properties, modify existing ones, or set errors to stop the pipeline.
 *
 * @example Basic handler
 * ```typescript
 * const handler: OrchestrationHandler = async (context) => {
 *   return {
 *     ...context,
 *     processed: true
 *   }
 * }
 * ```
 *
 * @example Type-safe handler with custom context
 * ```typescript
 * interface MyContext extends OrchestrationContext {
 *   userId: string
 * }
 *
 * const handler = async (context: MyContext): Promise<MyContext> => {
 *   return {
 *     ...context,
 *     userName: await getUserName(context.userId)
 *   }
 * }
 * ```
 */
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
