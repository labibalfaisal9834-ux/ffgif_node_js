import { PrismaClient } from '@prisma/client';
import { getConfig } from '../../config/env.js';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const config = getConfig();
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: config.postgres.databaseUrl,
        },
      },
      log: config.environment === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = getPrismaClient();
