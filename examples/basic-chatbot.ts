import {
  ContextOptimizer,
  createContextHandler,
  createIntentHandler,
  createModerationHandler,
  executeOrchestration,
  IntentClassifier,
  type OrchestrationContext,
} from 'ai-pipeline-orchestrator'

const intentClassifier = new IntentClassifier({
  patterns: [
    { category: 'greeting', keywords: ['hello', 'hi', 'hey'] },
    { category: 'help', keywords: ['help', 'support', 'assist'] },
    { category: 'info', keywords: ['information', 'tell me about', 'what is'] },
  ],
  metadata: {
    tones: {
      greeting: 'friendly',
      help: 'helpful',
      info: 'informative',
    },
  },
})

const contextOptimizer = new ContextOptimizer({
  sections: [
    {
      id: 'core',
      name: 'Core Instructions',
      content: 'You are a helpful assistant. Be concise and friendly.',
      alwaysInclude: true,
    },
    {
      id: 'help',
      name: 'Help Guide',
      content: 'Help topics: account, billing, technical support.',
      topics: ['help'],
    },
  ],
  strategy: {
    firstMessage: 'full',
    followUp: 'selective',
  },
})

async function main() {
  const context: OrchestrationContext = {
    request: {
      messages: [
        {
          role: 'user',
          content: 'Hello! I need help with my account.',
        },
      ],
    },
  }

  const result = await executeOrchestration(context, [
    {
      name: 'moderation',
      handler: createModerationHandler(),
    },
    {
      name: 'intent',
      handler: createIntentHandler({ classifier: intentClassifier }),
    },
    {
      name: 'context',
      handler: createContextHandler({
        optimizer: contextOptimizer,
        getTopics: ctx => {
          const intent = ctx.intent as { metadata?: { topics?: string[] } }
          return intent?.metadata?.topics || []
        },
      }),
    },
  ])

  if (result.success) {
    console.log('Intent:', result.context.intent)
    console.log('Context:', result.context.promptContext)
  } else {
    console.error('Error:', result.error)
  }
}

main()
