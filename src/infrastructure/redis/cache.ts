import { Redis } from 'ioredis';

export interface CacheRepository {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export class RedisCacheRepository implements CacheRepository {
  constructor(private readonly redis: Redis) {}

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.redis.set(key, value, 'EX', Math.ceil(ttlSeconds));
  }

  async get(key: string): Promise<string | null> {
    const val = await this.redis.get(key);
    return val;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
