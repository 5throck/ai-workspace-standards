/**
 * @version 1.0.0
 * Mock caching layer for MCP OpenAPI calls
 */

function log(msg: string): void {
  // MCP servers communicate via stdout — use stderr for cache logs
  process.stderr.write(`[MCPCache] ${msg}\n`);
}

export class MCPCache {
  private localCache: Map<string, { value: any; expiresAt: number }> = new Map();
  private useRedis: boolean;

  constructor(options: { useRedis?: boolean } = {}) {
    this.useRedis = options.useRedis ?? false;
  }

  async get(key: string): Promise<any | null> {
    if (this.useRedis) {
      // Mock Redis get
      log(`Fetching ${key} from Redis`);
      return null; // Return null to simulate cache miss for now
    } else {
      const item = this.localCache.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        this.localCache.delete(key);
        return null;
      }
      log(`Fetching ${key} from Local Cache`);
      return item.value;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (this.useRedis) {
      // Mock Redis set
      log(`Setting ${key} in Redis with TTL ${ttlSeconds}s`);
    } else {
      log(`Setting ${key} in Local Cache with TTL ${ttlSeconds}s`);
      this.localCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000
      });
    }
  }

  async invalidate(key: string): Promise<void> {
    if (this.useRedis) {
      log(`Invalidating ${key} in Redis`);
    } else {
      log(`Invalidating ${key} in Local Cache`);
      this.localCache.delete(key);
    }
  }
}

export const mcpCache = new MCPCache({ useRedis: process.env.USE_REDIS === 'true' });
