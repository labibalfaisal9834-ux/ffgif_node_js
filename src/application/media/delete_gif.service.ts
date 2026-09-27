import { PrismaClient } from '@prisma/client';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';

export class DeleteGifService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: MinioStorageRepository
  ) {}

  async execute(userId: string, key: string): Promise<void> {
    const gifRepo = new PostgresGifRepository(this.prisma);
    const ownerId = await gifRepo.getOwner(key);
    if (!ownerId) {
      throw new GifNotFoundError();
    }

    if (ownerId !== userId) {
      throw new GifOwnerMismatchError();
    }

    await gifRepo.delete(key);

    try {
      await this.storage.delete(key);
    } catch (err) {
      console.warn(`[DeleteGifService] Gif deleted from DB but storage deletion failed for key ${key}:`, err);
    }
  }
}
