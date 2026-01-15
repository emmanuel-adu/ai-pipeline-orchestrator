import { executeOrchestration, type OrchestrationHandler, type OrchestrationSteps } from '../src'

const enrichUserData: OrchestrationHandler = async ctx => {
  console.log('Fetching user profile...')
  await new Promise(resolve => setTimeout(resolve, 100))
  return { ...ctx, userProfile: { name: 'John', role: 'admin' } }
}

const enrichPreferences: OrchestrationHandler = async ctx => {
  console.log('Fetching user preferences...')
  await new Promise(resolve => setTimeout(resolve, 100))
  return { ...ctx, preferences: { theme: 'dark', language: 'en' } }
}

const enrichPermissions: OrchestrationHandler = async ctx => {
  console.log('Fetching permissions...')
  await new Promise(resolve => setTimeout(resolve, 100))
  return { ...ctx, permissions: ['read', 'write', 'delete'] }
}

const processRequest: OrchestrationHandler = async ctx => {
  console.log('Processing request with all data...')
  console.log('User:', (ctx as any).userProfile)
  console.log('Preferences:', (ctx as any).preferences)
  console.log('Permissions:', (ctx as any).permissions)
  return ctx
}

const steps: OrchestrationSteps = [
  [
    { name: 'userData', handler: enrichUserData },
    { name: 'preferences', handler: enrichPreferences },
    { name: 'permissions', handler: enrichPermissions },
  ],
  { name: 'process', handler: processRequest },
]

const context = {
  request: {
    messages: [{ role: 'user' as const, content: 'Hello' }],
  },
}

console.log('Starting parallel execution example...\n')
const start = Date.now()

executeOrchestration(context, steps).then(result => {
  const duration = Date.now() - start
  console.log(`\nCompleted in ${duration}ms (parallel saves ~200ms!)`)
  console.log('Success:', result.success)
})
