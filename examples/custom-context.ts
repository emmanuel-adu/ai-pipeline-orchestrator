/**
 * Example: Extending OrchestrationContext with custom properties
 */
import { executeOrchestration, type OrchestrationContext, type OrchestrationHandler } from '../src'

interface MyAppContext extends OrchestrationContext {
  userId?: string
  userEmail?: string
  isAdmin: boolean
  tools?: Record<string, unknown>
  sessionId?: string
  startTime?: number
  handlerTimings?: Record<string, number>
}

const authenticationHandler = async (context: MyAppContext): Promise<MyAppContext> => {
  const userEmail = context.request.metadata?.userEmail as string | undefined

  return {
    ...context,
    userId: userEmail ? getUserId(userEmail) : undefined,
    userEmail,
    isAdmin: checkIfAdmin(userEmail),
    sessionId: generateSessionId(),
  }
}

const metricsHandler = async (context: MyAppContext): Promise<MyAppContext> => {
  return {
    ...context,
    startTime: Date.now(),
    handlerTimings: {},
  }
}

const toolRegistryHandler = async (context: MyAppContext): Promise<MyAppContext> => {
  const tools: Record<string, unknown> = {
    getWeather: { description: 'Get weather information' },
  }

  if (context.isAdmin) {
    tools.getAnalytics = { description: 'Get system analytics' }
    tools.manageUsers = { description: 'Manage user accounts' }
  }

  return { ...context, tools }
}

const loggingHandler = async (context: MyAppContext): Promise<MyAppContext> => {
  console.log('Request Context:', {
    userId: context.userId,
    isAdmin: context.isAdmin,
    toolCount: Object.keys(context.tools || {}).length,
    sessionId: context.sessionId,
  })

  return context
}

async function main() {
  const initialContext: MyAppContext = {
    request: {
      messages: [{ role: 'user', content: 'Hello! What can you help me with?' }],
      metadata: {
        userEmail: 'admin@example.com',
        ipAddress: '127.0.0.1',
      },
    },
    isAdmin: false,
  }

  const result = await executeOrchestration(initialContext, [
    { name: 'metrics', handler: metricsHandler as OrchestrationHandler },
    { name: 'authentication', handler: authenticationHandler as OrchestrationHandler },
    { name: 'toolRegistry', handler: toolRegistryHandler as OrchestrationHandler },
    { name: 'logging', handler: loggingHandler as OrchestrationHandler },
  ])

  if (!result.success) {
    console.error('Orchestration failed:', result.error)
    return
  }

  const finalContext = result.context as MyAppContext
  console.log('\nFinal Context:')
  console.log('- User ID:', finalContext.userId)
  console.log('- Is Admin:', finalContext.isAdmin)
  console.log('- Available Tools:', Object.keys(finalContext.tools || {}))
  console.log('- Session ID:', finalContext.sessionId)
  console.log('- Processing Time:', Date.now() - (finalContext.startTime || 0), 'ms')
}

function getUserId(email: string): string {
  return `user_${email.split('@')[0]}`
}

function checkIfAdmin(email?: string): boolean {
  return email?.includes('admin') ?? false
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

if (require.main === module) {
  main().catch(console.error)
}
