import { PrismaClient, Prisma } from '@prisma/client';
import type { GifRepository, GifUpdateRequest } from '../../domain/media/repository.js';
import type { Gif, GifResponse } from '../../domain/media/entity.js';

interface GifRow {
  key: string;
  name?: string | null;
  status: string;
  persist: boolean;
  url: string;
  thumbnailKey?: string | null;
  download: number;
  fileSizeBytes: bigint | number;
  width: number;
  height: number;
  durationSeconds: any;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PostgresGifRepository implements GifRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(gif: Omit<Gif, 'createdAt' | 'updatedAt'>): Promise<void> {
    await (this.prisma as any).gif.create({
      data: {
        key: gif.key,
        name: gif.name || '',
        userId: gif.userId,
        status: gif.status || 'private',
        persist: gif.persist ?? false,
        download: gif.download ?? 0,
        fileSizeBytes: gif.fileSizeBytes ?? BigInt(0),
        width: gif.width ?? 0,
        height: gif.height ?? 0,
        durationSeconds: gif.durationSeconds ?? 0,
        isPublic: gif.isPublic ?? false,
        url: gif.url || '',
        thumbnailKey: gif.thumbnailKey || '',
      },
    });
  }

  async get(userId: string, status?: string, limit = 20, offset = 0): Promise<GifResponse[]> {
    const records = await (this.prisma as any).gif.findMany({
      where: {
        userId,
        status: status ? status : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return records.map((r: GifRow) => ({
      key: r.key,
      name: r.name || '',
      status: r.status,
      persist: r.persist,
      url: r.url,
      thumbnail_url: r.thumbnailKey || '',
      download: r.download,
      file_size_bytes: Number(r.fileSizeBytes),
      width: r.width,
      height: r.height,
      duration_seconds: Number(r.durationSeconds),
      is_public: r.isPublic,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  async getByKey(key: string, _forUpdate = false): Promise<GifResponse | null> {
    const r = await (this.prisma as any).gif.findUnique({
      where: { key },
    });
    if (!r) return null;

    return {
      key: r.key,
      name: r.name || '',
      status: r.status,
      persist: r.persist,
      url: r.url,
      thumbnail_url: r.thumbnailKey || '',
      download: r.download,
      file_size_bytes: Number(r.fileSizeBytes),
      width: r.width,
      height: r.height,
      duration_seconds: Number(r.durationSeconds),
      is_public: r.isPublic,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  }

  async getRecents(userId: string): Promise<GifResponse[]> {
    const records = await (this.prisma as any).gif.findMany({
      where: {
        userId,
        OR: [{ status: 'recent' }, { persist: false }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return records.map((r: GifRow) => ({
      key: r.key,
      name: r.name || '',
      status: r.status,
      persist: r.persist,
      url: r.url,
      thumbnail_url: r.thumbnailKey || '',
      download: r.download,
      file_size_bytes: Number(r.fileSizeBytes),
      width: r.width,
      height: r.height,
      duration_seconds: Number(r.durationSeconds),
      is_public: r.isPublic,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  async delete(key: string): Promise<void> {
    await (this.prisma as any).gif.delete({
      where: { key },
    });
  }

  async update(key: string, req: GifUpdateRequest): Promise<GifResponse> {
    const r = await (this.prisma as any).gif.update({
      where: { key },
      data: {
        name: req.name !== undefined ? req.name : undefined,
        status: req.status !== undefined ? req.status : undefined,
        persist: req.persist !== undefined ? req.persist : undefined,
        isPublic: req.isPublic !== undefined ? req.isPublic : undefined,
        updatedAt: new Date(),
      },
    });

    return {
      key: r.key,
      name: r.name || '',
      status: r.status,
      persist: r.persist,
      url: r.url,
      thumbnail_url: r.thumbnailKey || '',
      download: r.download,
      file_size_bytes: Number(r.fileSizeBytes),
      width: r.width,
      height: r.height,
      duration_seconds: Number(r.durationSeconds),
      is_public: r.isPublic,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  }

  async saveRecent(key: string): Promise<void> {
    await (this.prisma as any).gif.update({
      where: { key },
      data: {
        persist: true,
        status: 'private',
        updatedAt: new Date(),
      },
    });
  }

  async getOwner(key: string): Promise<string | null> {
    const r = await (this.prisma as any).gif.findUnique({
      where: { key },
      select: { userId: true },
    });
    return r ? r.userId : null;
  }

  async incrementDownload(key: string): Promise<void> {
    await (this.prisma as any).gif.update({
      where: { key },
      data: {
        download: { increment: 1 },
      },
    });
  }
}
