/**
 * Prisma Context Loader Adapters
 *
 * USAGE:
 *   npm install @prisma/client && npx prisma init
 *   import { BasicPrismaContextLoader } from 'ai-pipeline-orchestrator/adapters/prisma'
 *
 * SCHEMA:
 *   model ChatContext {
 *     id           String   @id @default(cuid())
 *     name         String
 *     content      String   @db.Text
 *     topics       String[]
 *     alwaysInclude Boolean @default(false)
 *     priority     Int      @default(5)
 *     variant      String?
 *     active       Boolean  @default(true)
 *   }
 */
import type { ContextLoader, ContextLoadOptions, ContextSection } from '../context'

type PrismaClient = any

export class BasicPrismaContextLoader implements ContextLoader {
  constructor(private prisma: PrismaClient) {}

  async load(options: ContextLoadOptions): Promise<ContextSection[]> {
    const { topics = [], variant } = options

    const contexts = await this.prisma.chatContext.findMany({
      where: {
        active: true,
        ...(variant ? { variant } : {}),
        ...(topics.length > 0 ? { topics: { hasSome: topics } } : {}),
      },
      orderBy: { priority: 'desc' },
    })

    return contexts.map((ctx: any) => ({
      id: ctx.id,
      name: ctx.name,
      content: ctx.content,
      topics: ctx.topics,
      alwaysInclude: ctx.alwaysInclude,
      priority: ctx.priority,
    }))
  }
}

/**
 * Loader with in-memory caching
 */
export class CachedPrismaContextLoader implements ContextLoader {
  private cache = new Map<string, { sections: ContextSection[]; expiresAt: number }>()
  private readonly cacheTTL: number

  constructor(
    private prisma: PrismaClient,
    options?: { cacheTTL?: number }
  ) {
    this.cacheTTL = options?.cacheTTL ?? 5 * 60 * 1000
  }

  async load(options: ContextLoadOptions): Promise<ContextSection[]> {
    const cacheKey = this.getCacheKey(options)
    const now = Date.now()

    const cached = this.cache.get(cacheKey)
    if (cached && now < cached.expiresAt) {
      return cached.sections
    }

    const sections = await this.loadFromDatabase(options)
    this.cache.set(cacheKey, { sections, expiresAt: now + this.cacheTTL })

    return sections
  }

  private async loadFromDatabase(options: ContextLoadOptions): Promise<ContextSection[]> {
    const { topics = [], variant, isFirstMessage } = options

    if (isFirstMessage) {
      const contexts = await this.prisma.chatContext.findMany({
        where: { active: true, ...(variant ? { variant } : {}) },
        orderBy: { priority: 'desc' },
      })
      return contexts.map(this.mapToContextSection)
    }

    const contexts = await this.prisma.chatContext.findMany({
      where: {
        active: true,
        ...(variant ? { variant } : {}),
        OR: [
          { alwaysInclude: true },
          ...(topics.length > 0 ? [{ topics: { hasSome: topics } }] : []),
        ],
      },
      orderBy: { priority: 'desc' },
    })

    return contexts.map(this.mapToContextSection)
  }

  private mapToContextSection(ctx: any): ContextSection {
    return {
      id: ctx.id,
      name: ctx.name,
      content: ctx.content,
      topics: ctx.topics,
      alwaysInclude: ctx.alwaysInclude,
      priority: ctx.priority,
    }
  }

  private getCacheKey(options: ContextLoadOptions): string {
    const { topics = [], variant, isFirstMessage } = options
    return `${variant || 'default'}_${isFirstMessage ? 'first' : 'followup'}_${topics.sort().join(',')}`
  }

  clearCache(): void {
    this.cache.clear()
  }
}

/**
 * Loader that merges user preferences with requested topics
 */
export class PersonalizedPrismaContextLoader implements ContextLoader {
  constructor(private prisma: PrismaClient) {}

  async load(options: ContextLoadOptions): Promise<ContextSection[]> {
    const { topics = [], variant, userId } = options

    let userPreferences: string[] = []
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      })
      userPreferences = user?.preferences || []
    }

    const allTopics = [...new Set([...topics, ...userPreferences])]

    const contexts = await this.prisma.chatContext.findMany({
      where: {
        active: true,
        ...(variant ? { variant } : {}),
        OR: [
          { alwaysInclude: true },
          ...(allTopics.length > 0 ? [{ topics: { hasSome: allTopics } }] : []),
        ],
      },
      orderBy: { priority: 'desc' },
    })

    return contexts.map((ctx: any) => ({
      id: ctx.id,
      name: ctx.name,
      content: ctx.content,
      topics: ctx.topics,
      alwaysInclude: ctx.alwaysInclude,
      priority: ctx.priority,
    }))
  }
}
