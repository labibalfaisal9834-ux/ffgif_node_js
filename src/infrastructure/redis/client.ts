import { Redis, RedisOptions } from 'ioredis';
import { getConfig } from '../../config/env.js';

let redisInstance: Redis | null = null;

export function parseRedisAddr(addr: string): { host: string; port: number } {
  const parts = addr.split(':');
  const host = parts[0] || 'localhost';
  const port = parts[1] ? parseInt(parts[1], 10) : 6379;
  return { host, port };
}

export async function createRedisClient(configOverride?: {
  addr: string;
  user?: string;
  pass?: string;
}): Promise<Redis> {
  const redisConfig = configOverride || getConfig().redis;
  const { host, port } = parseRedisAddr(redisConfig.addr);

  const options: RedisOptions = {
    host,
    port,
    username: redisConfig.user || undefined,
    password: redisConfig.pass || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  };

  const client = new Redis(options);

  try {
    await client.connect();
    await client.ping();
    console.log('[Redis] Redis connection complete');
  } catch (err) {
    throw new Error(`[Redis Panic] Failed to connect to Redis at ${redisConfig.addr}: ${(err as Error).message}`);
  }

  return client;
}

export function getRedisClientSync(): Redis {
  if (!redisInstance) {
    const redisConfig = getConfig().redis;
    const { host, port } = parseRedisAddr(redisConfig.addr);
    redisInstance = new Redis({
      host,
      port,
      username: redisConfig.user || undefined,
      password: redisConfig.pass || undefined,
      maxRetriesPerRequest: 3,
    });
  }
  return redisInstance;
}

export async function getRedisClient(): Promise<Redis> {
  if (!redisInstance) {
    redisInstance = await createRedisClient();
  }
  return redisInstance;
}
