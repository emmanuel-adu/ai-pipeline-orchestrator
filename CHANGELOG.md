# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-09

### Added
- Initial release of ai-pipeline-orchestrator
- Sequential orchestration pipeline with error propagation
- Hybrid intent classification (keyword → LLM fallback)
- Dynamic context optimization for 30-50% token reduction
- Multi-provider support (Anthropic, OpenAI, DeepSeek, Ollama)
- Content moderation handler with pattern matching
- Rate limiting handler with pluggable limiter interface
- Streaming and non-streaming AI handlers
- Interactive chat CLI demo showcasing all features
- Full TypeScript support with exported types
- ESM and CommonJS builds

### Features
- **IntentClassifier**: Fast, free keyword-based intent detection
- **LLMIntentClassifier**: Accurate LLM-based classification with structured output
- **TextLLMIntentClassifier**: Text-based classification for legacy models
- **ContextOptimizer**: Smart context loading based on topics/intent
- **Rate Limiting**: Pluggable interface for any rate limiting solution
- **Content Moderation**: Pattern-based spam and profanity detection
- **Streaming Support**: Real-time AI response streaming
- **Token Tracking**: Detailed token usage breakdown across models

### Supported Providers
- Anthropic Claude (3.5 Haiku, 3.5 Sonnet)
- OpenAI GPT (4o, 4o-mini)
- DeepSeek (cloud API)
- Ollama (local models via ai-sdk-ollama)

### Dependencies
- Zero production dependencies except Zod (validation)
- Peer dependencies: AI SDK 5, provider packages (all optional)
- Clean installation with no dependency conflicts

[0.1.0]: https://github.com/emmanuel-adu/ai-pipeline-orchestrator/releases/tag/v0.1.0
