/**
 * Shared utilities for examples
 */
import type { AIProvider } from '../src'

const MODEL_EXAMPLES: Record<AIProvider, string[]> = {
  anthropic: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  ollama: ['llama3.2', 'deepseek-r1', 'qwen2.5', 'or run "ollama list"'],
}

export interface EnvConfig {
  aiProvider: AIProvider
  aiModel: string
  intentProvider: AIProvider
  intentModel: string
}

export interface ProviderCredentials {
  apiKey?: string
  baseURL?: string
}

export function getEnvConfig(): EnvConfig {
  const aiProvider = process.env.AI_PROVIDER as AIProvider
  const aiModel = process.env.AI_MODEL
  const intentProvider = (process.env.INTENT_PROVIDER ?? aiProvider) as AIProvider
  const intentModel = process.env.INTENT_MODEL ?? aiModel

  if (!aiProvider) {
    console.error('❌ Error: AI_PROVIDER is required\n')
    console.log('Add to .env file: AI_PROVIDER=anthropic|openai|ollama\n')
    process.exit(1)
  }

  if (!aiModel) {
    console.error('❌ Error: AI_MODEL is required\n')
    console.log('Add to .env file with your chosen model:\n')
    console.log('  AI_MODEL=your-model-name\n')
    console.log('Examples by provider:')
    Object.entries(MODEL_EXAMPLES).forEach(([provider, examples]) => {
      const displayName = provider.charAt(0).toUpperCase() + provider.slice(1)
      console.log(`  ${displayName}: ${examples.join(', ')}`)
    })
    console.log()
    process.exit(1)
  }

  return {
    aiProvider,
    aiModel: aiModel as string,
    intentProvider,
    intentModel: intentModel as string,
  }
}

export function getProviderCredentials(provider: AIProvider): ProviderCredentials {
  let apiKey: string | undefined
  let baseURL: string | undefined

  if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('❌ Error: ANTHROPIC_API_KEY is required for Anthropic provider')
      console.log('Add to .env file: ANTHROPIC_API_KEY=your-key\n')
      process.exit(1)
    }
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('❌ Error: OPENAI_API_KEY is required for OpenAI provider')
      console.log('Add to .env file: OPENAI_API_KEY=your-key\n')
      process.exit(1)
    }
  } else if (provider === 'ollama') {
    apiKey = process.env.OLLAMA_API_KEY // Optional for cloud
    baseURL = process.env.OLLAMA_BASE_URL
    if (!baseURL) {
      console.error('❌ Error: OLLAMA_BASE_URL is required for Ollama provider')
      console.log('Add to .env file:')
      console.log('  Local:  OLLAMA_BASE_URL=http://localhost:11434')
      console.log('  Cloud:  OLLAMA_BASE_URL=https://ollama.com')
      console.log('          OLLAMA_API_KEY=your-key\n')
      process.exit(1)
    }
  }

  return { apiKey, baseURL }
}

export function getSimpleEnvConfig(): { provider: AIProvider; model: string } {
  const provider = process.env.AI_PROVIDER as AIProvider
  const model = process.env.AI_MODEL

  if (!provider) {
    console.error('❌ Error: AI_PROVIDER is required\n')
    console.log('Choose a provider and add to .env file:\n')
    console.log('Anthropic: AI_PROVIDER=anthropic')
    console.log('OpenAI:    AI_PROVIDER=openai')
    console.log('Ollama:    AI_PROVIDER=ollama\n')
    process.exit(1)
  }

  if (!model) {
    console.error('❌ Error: AI_MODEL is required\n')
    console.log('Add to .env file with your chosen model:\n')
    console.log('  AI_MODEL=your-model-name\n')
    console.log('Examples by provider:')
    Object.entries(MODEL_EXAMPLES).forEach(([provider, examples]) => {
      const displayName = provider.charAt(0).toUpperCase() + provider.slice(1)
      console.log(`  ${displayName}: ${examples.join(', ')}`)
    })
    console.log()
    process.exit(1)
  }

  return { provider, model: model as string }
}
