import { PrismaClient, Prisma } from '@prisma/client';
import { LastVideoRepository } from '../../domain/media/repository.js';
import { LastUpload, LastUploadResponse } from '../../domain/media/entity.js';

export class PostgresLastVideoRepository implements LastVideoRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(upload: Omit<LastUpload, 'id' | 'uploadedAt' | 'updatedAt' | 'deletedAt'>): Promise<void> {
    await this.prisma.lastUpload.upsert({
      where: { userId: upload.userId },
      update: {
        fileKey: upload.fileKey,
        fileName: upload.fileName,
        contentType: upload.contentType,
        sizeBytes: upload.sizeBytes,
        durationSec: upload.durationSec !== undefined && upload.durationSec !== null ? new Prisma.Decimal(upload.durationSec) : undefined,
        thumbnailUrl: upload.thumbnailUrl,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId: upload.userId,
        fileKey: upload.fileKey,
        fileName: upload.fileName,
        contentType: upload.contentType,
        sizeBytes: upload.sizeBytes,
        durationSec: upload.durationSec !== undefined && upload.durationSec !== null ? new Prisma.Decimal(upload.durationSec) : undefined,
        thumbnailUrl: upload.thumbnailUrl,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getLastVideo(userId: string): Promise<LastUploadResponse | null> {
    const r = await this.prisma.lastUpload.findUnique({
      where: { userId },
    });
    if (!r) return null;

    return {
      user_id: r.userId,
      key: r.fileKey,
      filename: r.fileName || '',
      content_type: r.contentType,
      size_bytes: r.sizeBytes ? Number(r.sizeBytes) : undefined,
      duration_sec: r.durationSec ? Number(r.durationSec) : undefined,
      uploaded_at: r.uploadedAt,
      thumbnail_url: r.thumbnailUrl || undefined,
    };
  }
}
