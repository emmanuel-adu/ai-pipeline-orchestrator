import type { OrchestrationContext } from './types'

/**
 * Conditional execution helpers for dynamic handler execution
 */

export function when(predicate: (context: OrchestrationContext) => boolean | Promise<boolean>) {
  return predicate
}

export function hasIntent(intent: string) {
  return (context: OrchestrationContext) => {
    const detectedIntent = (context as any).intent?.intent
    return detectedIntent === intent
  }
}

export function hasMetadata(key: string, value?: unknown) {
  return (context: OrchestrationContext) => {
    if (value === undefined) {
      return context.request.metadata?.[key] !== undefined
    }
    return context.request.metadata?.[key] === value
  }
}

export function hasProperty(key: string, value?: unknown) {
  return (context: OrchestrationContext) => {
    if (value === undefined) {
      return (context as any)[key] !== undefined
    }
    return (context as any)[key] === value
  }
}

export function isFirstMessage() {
  return (context: OrchestrationContext) => {
    return context.request.messages.length === 1
  }
}

export function isAuthenticated() {
  return (context: OrchestrationContext) => {
    return !!(context.request.metadata?.userId || context.request.metadata?.authenticated)
  }
}

export function matchesPattern(pattern: RegExp, field: 'content' | 'metadata') {
  return (context: OrchestrationContext) => {
    if (field === 'content') {
      const lastMessage = context.request.messages[context.request.messages.length - 1]
      const content = typeof lastMessage?.content === 'string' ? lastMessage.content : ''
      return pattern.test(content)
    }
    return false
  }
}

export function and(
  ...conditions: Array<(context: OrchestrationContext) => boolean | Promise<boolean>>
) {
  return async (context: OrchestrationContext) => {
    for (const condition of conditions) {
      const result = await condition(context)
      if (!result) return false
    }
    return true
  }
}

export function or(
  ...conditions: Array<(context: OrchestrationContext) => boolean | Promise<boolean>>
) {
  return async (context: OrchestrationContext) => {
    for (const condition of conditions) {
      const result = await condition(context)
      if (result) return true
    }
    return false
  }
}

export function not(condition: (context: OrchestrationContext) => boolean | Promise<boolean>) {
  return async (context: OrchestrationContext) => {
    return !(await condition(context))
  }
}
