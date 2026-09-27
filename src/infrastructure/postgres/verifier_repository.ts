import { PrismaClient, Prisma } from '@prisma/client';
import { VerifierRepository } from '../../domain/auth/repository.js';
import { Verifier } from '../../domain/auth/entity.js';

export class PostgresVerifierRepository implements VerifierRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(verifier: { userId: string; tokenHash: string; expireAt?: Date }): Promise<Verifier> {
    const expireAt = verifier.expireAt || new Date(Date.now() + 30 * 60 * 1000);
    const record = await this.prisma.verifier.create({
      data: {
        userId: verifier.userId,
        tokenHash: verifier.tokenHash,
        expireAt,
      },
    });
    return record;
  }

  async getByHash(tokenHash: string): Promise<Verifier | null> {
    const record = await this.prisma.verifier.findFirst({
      where: {
        tokenHash,
        expireAt: {
          gt: new Date(),
        },
      },
    });
    return record;
  }

  async getById(userId: string): Promise<Verifier | null> {
    const record = await this.prisma.verifier.findUnique({
      where: { userId },
    });
    return record;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.verifier.delete({
      where: { id },
    });
  }
}
