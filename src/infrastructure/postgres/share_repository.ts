import { PrismaClient, Prisma } from '@prisma/client';
import { Share, ShareToken } from '../../domain/share/entity.js';

export class PostgresShareRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(share: {
    gifKey: string;
    ownerId: string;
    sharedWith: string;
    expiresAt?: Date | null;
  }): Promise<Share> {
    const record = await this.prisma.share.upsert({
      where: {
        gifKey_sharedWith: {
          gifKey: share.gifKey,
          sharedWith: share.sharedWith,
        },
      },
      update: {
        expiresAt: share.expiresAt,
      },
      create: {
        gifKey: share.gifKey,
        ownerId: share.ownerId,
        sharedWith: share.sharedWith,
        expiresAt: share.expiresAt,
      },
    });

    return {
      id: record.id,
      gifKey: record.gifKey || '',
      ownerId: record.ownerId || '',
      sharedWith: record.sharedWith || '',
      expiresAt: record.expiresAt,
      createdAt: record.createdAt || new Date(),
    };
  }

  async createToken(shareToken: {
    gifKey: string;
    token: string;
    email: string;
    expiresAt?: Date | null;
  }): Promise<ShareToken> {
    const record = await this.prisma.shareToken.upsert({
      where: {
        gifKey_email: {
          gifKey: shareToken.gifKey,
          email: shareToken.email,
        },
      },
      update: {
        token: shareToken.token,
        expiresAt: shareToken.expiresAt,
      },
      create: {
        gifKey: shareToken.gifKey,
        token: shareToken.token,
        email: shareToken.email,
        expiresAt: shareToken.expiresAt,
      },
    });

    return {
      gifKey: record.gifKey,
      token: record.token,
      email: record.email,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async getByToken(tokenHash: string): Promise<ShareToken | null> {
    const record = await this.prisma.shareToken.findFirst({
      where: {
        token: tokenHash,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!record) return null;

    return {
      gifKey: record.gifKey,
      token: record.token,
      email: record.email,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async getOwner(userId: string, gifKey: string): Promise<string | null> {
    const record = await this.prisma.share.findFirst({
      where: {
        sharedWith: userId,
        gifKey,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ownerId: true },
    });
    return record?.ownerId || null;
  }

  async getShares(userId: string, limit = 20, offset = 0): Promise<Share[]> {
    const records = await this.prisma.share.findMany({
      where: {
        sharedWith: userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      gifKey: r.gifKey || '',
      ownerId: r.ownerId || '',
      sharedWith: r.sharedWith || '',
      expiresAt: r.expiresAt,
      createdAt: r.createdAt || new Date(),
    }));
  }

  async delete(ownerId: string, shareId: string): Promise<void> {
    await this.prisma.share.deleteMany({
      where: {
        id: shareId,
        ownerId,
      },
    });
  }
}
