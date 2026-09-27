import { PrismaClient, Prisma } from '@prisma/client';
import { ReseterRepository } from '../../domain/auth/repository.js';
import { Reseter } from '../../domain/auth/entity.js';

export class PostgresReseterRepository implements ReseterRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async getById(userId: string): Promise<Reseter | null> {
    const record = await this.prisma.reseter.findFirst({
      where: {
        userId,
        expireAt: {
          gt: new Date(),
        },
      },
    });
    return record;
  }

  async create(reseter: { userId: string; tokenHash: string; expireAt?: Date }): Promise<Reseter> {
    const expireAt = reseter.expireAt || new Date(Date.now() + 15 * 60 * 1000);
    const record = await this.prisma.reseter.upsert({
      where: { userId: reseter.userId },
      update: {
        tokenHash: reseter.tokenHash,
        used: false,
        expireAt,
      },
      create: {
        userId: reseter.userId,
        tokenHash: reseter.tokenHash,
        used: false,
        expireAt,
      },
    });
    return record;
  }

  async getByToken(tokenHash: string): Promise<Reseter | null> {
    const record = await this.prisma.reseter.findFirst({
      where: {
        tokenHash,
        expireAt: {
          gt: new Date(),
        },
      },
    });
    return record;
  }

  async deleteById(id: number): Promise<void> {
    await this.prisma.reseter.delete({
      where: { id },
    });
  }
}
