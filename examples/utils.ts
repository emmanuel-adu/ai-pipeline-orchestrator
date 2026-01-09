/**
 * Shared utilities for examples
 */
import type { AIProvider } from '../src'

const MODEL_EXAMPLES: Record<AIProvider, string[]> = {
  anthropic: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  deepseek: ["deepseek-chat"],
  ollama: ['Run "ollama list" to see your installed models'],
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
    console.log('Add to .env file: AI_PROVIDER=anthropic|openai|deepseek|ollama\n')
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
  } else if (provider === 'deepseek') {
    apiKey = process.env.DEEPSEEK_API_KEY
    baseURL = process.env.DEEPSEEK_BASE_URL
    if (!apiKey) {
      console.error('❌ Error: DEEPSEEK_API_KEY is required for DeepSeek provider')
      console.log('Add to .env file: DEEPSEEK_API_KEY=your-key\n')
      process.exit(1)
    }
    if (!baseURL) {
      console.error(
        "❌ Error: DEEPSEEK_BASE_URL is required for DeepSeek provider"
      );
      console.log(
        "Add to .env file: DEEPSEEK_BASE_URL=https://api.deepseek.com\n"
      );
      process.exit(1);
    }
  } else if (provider === 'ollama') {
    baseURL = process.env.OLLAMA_BASE_URL;
    if (!baseURL) {
      console.error('❌ Error: OLLAMA_BASE_URL is required for Ollama provider')
      console.log('Add to .env file: OLLAMA_BASE_URL=http://localhost:11434\n')
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
    console.log('DeepSeek:  AI_PROVIDER=deepseek')
    console.log('Ollama:    AI_PROVIDER=ollama\n')
    process.exit(1)
  }

  if (!model) {
    console.error('❌ Error: AI_MODEL is required\n')
    console.log('Add to .env file with your chosen model:\n')
    console.log('  AI_MODEL=your-model-name\n')
    console.log('Examples by provider:')
    Object.entries(MODEL_EXAMPLES).forEach(([provider, examples]) => {
      const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
      console.log(`  ${displayName}: ${examples.join(", ")}`);
    });
    console.log()
    process.exit(1)
  };

  return { provider, model: model as string };
}
