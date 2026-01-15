/**
 * Upstash Rate Limiter Adapter
 *
 * SETUP: npm install @upstash/ratelimit @upstash/redis
 *
 * Note: TypeScript errors are expected until you install these packages.
 * This file is excluded from the build (see tsconfig.json).
 */
// @ts-expect-error - Optional dependencies, install only if needed
import { Ratelimit } from '@upstash/ratelimit'
// @ts-expect-error - Optional dependencies, install only if needed
import { Redis } from '@upstash/redis'

import type { RateLimiter } from '../../src'

export function createUpstashAdapter(ratelimit: Ratelimit): RateLimiter {
  return {
    async check(identifier: string) {
      const result = await ratelimit.limit(identifier)
      return {
        allowed: result.success,
        retryAfter: result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : undefined,
      }
    },
  }
}

/**
 * Adapter with in-memory fallback when Redis is unavailable
 */
export function createResilientUpstashAdapter(config: {
  redis?: Redis
  maxRequests: number
  windowSeconds: number
  prefix?: string
}): RateLimiter {
  const { redis, maxRequests, windowSeconds, prefix = '@ratelimit' } = config
  const memoryStore = new Map<string, { count: number; resetAt: number }>()

  let upstashLimiter: Ratelimit | null = null
  if (redis) {
    try {
      upstashLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(maxRequests, `${windowSeconds} s`),
        ephemeralCache: new Map(),
        analytics: false,
        prefix,
      })
    } catch (error) {
      console.warn('Failed to initialize Upstash rate limiter, using in-memory fallback:', error)
    }
  }

  return {
    async check(identifier: string) {
      if (upstashLimiter) {
        try {
          const result = await upstashLimiter.limit(identifier)
          return {
            allowed: result.success,
            retryAfter: result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : undefined,
          }
        } catch (error) {
          console.warn('Upstash rate limit check failed, using in-memory fallback:', error)
        }
      }

      const now = Date.now()
      const window = windowSeconds * 1000
      const current = memoryStore.get(identifier)

      if (!current || now > current.resetAt) {
        memoryStore.set(identifier, { count: 1, resetAt: now + window })
        return { allowed: true }
      }

      if (current.count >= maxRequests) {
        const retryAfter = Math.ceil((current.resetAt - now) / 1000)
        return { allowed: false, retryAfter }
      }

      current.count++
      return { allowed: true }
    },
  }
}
