/**
 * Custom Context Example - Extending OrchestrationContext
 *
 * This example demonstrates how to extend OrchestrationContext
 * with custom properties in a type-safe way.
 *
 * Use cases:
 * - Adding user authentication data
 * - Including request metadata
 * - Storing tool definitions
 * - Tracking custom metrics
 */
import { executeOrchestration, type OrchestrationContext, type OrchestrationHandler } from '../src'

// 1. Define your custom context interface
interface MyAppContext extends OrchestrationContext {
  // User authentication
  userId?: string
  userEmail?: string
  isAdmin: boolean

  // Application-specific data
  tools?: Record<string, unknown>
  sessionId?: string

  // Custom metrics
  startTime?: number
  handlerTimings?: Record<string, number>
}

// 2. Create type-safe handlers using your custom context
const authenticationHandler = async (context: MyAppContext): Promise<MyAppContext> => {
  // Simulate extracting user info from request
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
  // Register tools based on user permissions
  const tools: Record<string, unknown> = {}

  // Public tools
  tools.getWeather = { description: 'Get weather information' }

  // Admin-only tools
  if (context.isAdmin) {
    tools.getAnalytics = { description: 'Get system analytics' }
    tools.manageUsers = { description: 'Manage user accounts' }
  }

  return {
    ...context,
    tools,
  }
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

// 3. Execute orchestration with custom context
async function main() {
  // Create initial context with custom properties
  const initialContext: MyAppContext = {
    request: {
      messages: [{ role: 'user', content: 'Hello! What can you help me with?' }],
      metadata: {
        userEmail: 'admin@example.com',
        ipAddress: '127.0.0.1',
      },
    },
    isAdmin: false, // Will be set by authentication handler
  }

  // Execute orchestration with custom handlers
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

  // Access custom properties with type safety
  const finalContext = result.context as MyAppContext
  console.log('\nFinal Context:')
  console.log('- User ID:', finalContext.userId)
  console.log('- Is Admin:', finalContext.isAdmin)
  console.log('- Available Tools:', Object.keys(finalContext.tools || {}))
  console.log('- Session ID:', finalContext.sessionId)
  console.log('- Processing Time:', Date.now() - (finalContext.startTime || 0), 'ms')
}

// Helper Functions
function getUserId(email: string): string {
  // Simulate database lookup
  return `user_${email.split('@')[0]}`
}

function checkIfAdmin(email?: string): boolean {
  // Simulate admin check
  return email?.includes('admin') ?? false
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

// ============================================================================
// Alternative: Runtime-only extension (no type safety)
// ============================================================================

async function runtimeOnlyExample() {
  const context: OrchestrationContext = {
    request: {
      messages: [{ role: 'user', content: 'test' }],
    },
    // These are allowed by index signature but not type-checked
    userId: '123',
    customData: { foo: 'bar' },
  }

  const handler: OrchestrationHandler = async ctx => {
    // Access custom properties (type: unknown)
    const userId = ctx.userId as string
    console.log('User ID:', userId)

    return {
      ...ctx,
      processed: true,
    }
  }

  await executeOrchestration(context, [{ name: 'custom', handler }])
}

// Run the example
if (require.main === module) {
  main().catch(console.error)
}
