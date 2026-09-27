import { PrismaClient, Prisma } from '@prisma/client';
import { Share, ShareToken, GifTokenResponse, SharedGifResponse } from '../../domain/share/entity.js';
import { ShareRepository } from '../../domain/share/repository.js';

interface ShareWithGifRow {
  id: string;
  gifKey?: string | null;
  ownerId?: string | null;
  sharedWith?: string | null;
  expiresAt?: Date | null;
  gif?: {
    name?: string | null;
    url?: string | null;
    thumbnailKey?: string | null;
  } | null;
}

export class PostgresShareRepository implements ShareRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(share: {
    gifKey: string;
    ownerId: string;
    sharedWith: string;
    expiresAt?: Date | null;
  }): Promise<Share> {
    const record = await (this.prisma as any).share.upsert({
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

  async createByToken(shareToken: {
    gifKey: string;
    token: string;
    email: string;
    expiresAt?: Date | null;
  }): Promise<ShareToken> {
    const record = await (this.prisma as any).shareToken.upsert({
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

  async get(userId: string): Promise<SharedGifResponse[]> {
    const records = await (this.prisma as any).share.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            sharedWith: userId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        ],
      },
      include: {
        gif: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r: ShareWithGifRow) => ({
      id: r.id,
      gif_key: r.gifKey || '',
      owner_id: r.ownerId || '',
      shared_with: r.sharedWith || '',
      expires_at: r.expiresAt,
      name: r.gif?.name || '',
      url: r.gif?.url || '',
      thumbnail_url: r.gif?.thumbnailKey || '',
    }));
  }

  async getByToken(tokenHash: string): Promise<GifTokenResponse | null> {
    const record = await (this.prisma as any).shareToken.findFirst({
      where: {
        token: tokenHash,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        gif: true,
      },
    });
    if (!record) return null;

    return {
      gif_key: record.gifKey,
      name: record.gif?.name || '',
      url: record.gif?.url || '',
      thumbnail_url: record.gif?.thumbnailKey || '',
      expires_at: record.expiresAt,
      created_at: record.createdAt,
    };
  }

  async getOwner(userId: string, gifKey: string): Promise<string | null> {
    const record = await (this.prisma as any).share.findFirst({
      where: {
        sharedWith: userId,
        gifKey,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ownerId: true },
    });
    return record?.ownerId || null;
  }

  async delete(gifKey: string, sharedWithId: string): Promise<void> {
    await (this.prisma as any).share.deleteMany({
      where: {
        gifKey,
        sharedWith: sharedWithId,
      },
    });
  }
}
