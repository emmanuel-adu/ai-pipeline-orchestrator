/**
 * Shared utilities for examples
 */

export type ProviderType = 'anthropic' | 'openai' | 'deepseek' | 'ollama'

export interface EnvConfig {
  aiProvider: ProviderType
  aiModel: string
  intentProvider: ProviderType
  intentModel: string
}

export interface ProviderCredentials {
  apiKey?: string
  baseURL?: string
}

export function getEnvConfig(): EnvConfig {
  const aiProvider = process.env.AI_PROVIDER as ProviderType
  const aiModel = process.env.AI_MODEL
  const intentProvider = (process.env.INTENT_PROVIDER ?? aiProvider) as ProviderType
  const intentModel = process.env.INTENT_MODEL ?? aiModel

  if (!aiProvider) {
    console.error('❌ Error: AI_PROVIDER is required\n')
    console.log('Add to .env file: AI_PROVIDER=anthropic|openai|deepseek|ollama\n')
    process.exit(1)
  }

  if (!aiModel) {
    console.error('❌ Error: AI_MODEL is required\n')
    console.log('Add to .env file with your chosen model:\n')
    console.log('  AI_MODEL=your-model-name\n')
    console.log('Examples by provider:')
    console.log('  Anthropic: claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022')
    console.log('  OpenAI:    gpt-4o-mini, gpt-4o')
    console.log('  DeepSeek:  deepseek-chat (cloud API)')
    console.log('  Ollama:    Run "ollama list" to see your installed models\n')
    process.exit(1)
  }

  return {
    aiProvider,
    aiModel: aiModel as string,
    intentProvider,
    intentModel: intentModel as string,
  }
}

export function getProviderCredentials(provider: ProviderType): ProviderCredentials {
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
  } else if (provider === 'deepseek') {
    apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('❌ Error: DEEPSEEK_API_KEY is required for DeepSeek provider')
      console.log('Add to .env file: DEEPSEEK_API_KEY=your-key\n')
      process.exit(1)
    }
  } else if (provider === 'ollama') {
    baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  }

  return { apiKey, baseURL }
}

export function getSimpleEnvConfig(): { provider: ProviderType; model: string } {
  const provider = process.env.AI_PROVIDER as ProviderType
  const model = process.env.AI_MODEL

  if (!provider) {
    console.error('❌ Error: AI_PROVIDER is required\n')
    console.log('Choose a provider and add to .env file:\n')
    console.log('Anthropic: AI_PROVIDER=anthropic')
    console.log('OpenAI:    AI_PROVIDER=openai')
    console.log('DeepSeek:  AI_PROVIDER=deepseek')
    console.log('Ollama:    AI_PROVIDER=ollama\n')
    process.exit(1)
  }

  if (!model) {
    console.error('❌ Error: AI_MODEL is required\n')
    console.log('Add to .env file with your chosen model:\n')
    console.log('  AI_MODEL=your-model-name\n')
    console.log('Examples by provider:')
    console.log('  Anthropic: claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022')
    console.log('  OpenAI:    gpt-4o-mini, gpt-4o')
    console.log('  DeepSeek:  deepseek-chat (cloud API)')
    console.log('  Ollama:    Run "ollama list" to see your installed models\n')
    process.exit(1)
  }

  return { provider, model: model as string }
}
