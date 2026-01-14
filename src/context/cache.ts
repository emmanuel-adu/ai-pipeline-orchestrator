/**
 * Simple in-memory cache with TTL support.
 * Thread-safe for async operations.
 */
export class TTLCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>()
  private pendingLoads = new Map<string, Promise<T>>()

  constructor(private ttlMs: number) {}

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const pending = this.pendingLoads.get(key)
    if (pending) {
      return pending
    }

    const loadPromise = loader()
    this.pendingLoads.set(key, loadPromise)

    try {
      const value = await loadPromise
      this.cache.set(key, {
        value,
        expiresAt: Date.now() + this.ttlMs,
      })
      this.pendingLoads.delete(key)
      return value
    } catch (error) {
      this.pendingLoads.delete(key)
      throw error
    }
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.pendingLoads.clear()
  }

  size(): number {
    return this.cache.size
  }
}
