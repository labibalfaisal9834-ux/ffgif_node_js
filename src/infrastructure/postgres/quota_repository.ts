import { PrismaClient, Prisma } from '@prisma/client';
import { QuotaRepository } from '../../domain/user/repository.js';
import { Quota } from '../../domain/user/entity.js';

export class PostgresQuotaRepository implements QuotaRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(quota: {
    userId: string;
    usedBytes?: bigint;
    totalBytes?: bigint;
    gifCount?: number;
    gifLimit?: number;
  }): Promise<Quota> {
    const record = await this.prisma.quota.create({
      data: {
        userId: quota.userId,
        usedBytes: quota.usedBytes ?? BigInt(0),
        totalBytes: quota.totalBytes ?? BigInt(1073741824),
        gifCount: quota.gifCount ?? 0,
        gifLimit: quota.gifLimit ?? 100,
      },
    });
    return record;
  }

  async getQuota(userId: string): Promise<Quota | null> {
    const record = await this.prisma.quota.findUnique({
      where: { userId },
    });
    return record;
  }

  async incrementGifCount(userId: string, addedBytes: bigint): Promise<void> {
    await this.prisma.quota.update({
      where: { userId },
      data: {
        usedBytes: { increment: addedBytes },
        gifCount: { increment: 1 },
      },
    });
  }

  async decrementGifCount(userId: string, freedBytes: bigint): Promise<void> {
    await this.prisma.quota.update({
      where: { userId },
      data: {
        usedBytes: { decrement: freedBytes },
        gifCount: { decrement: 1 },
      },
    });
  }
}
