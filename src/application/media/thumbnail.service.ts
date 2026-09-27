import { PrismaClient } from '@prisma/client';
import { GifNotFoundError, GifOwnerMismatchError, ThumbnailNotFoundError } from '../../domain/media/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';

export class ThumbnailService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: MinioStorageRepository
  ) {}

  async execute(userId: string, key: string): Promise<{ thumbnail: string }> {
    const gifRepo = new PostgresGifRepository(this.prisma);
    const ownerId = await gifRepo.getOwner(key);
    if (!ownerId) {
      throw new GifNotFoundError();
    }

    if (ownerId !== userId) {
      throw new GifOwnerMismatchError();
    }

    const gif = await gifRepo.getByKey(key, false);
    if (!gif) {
      throw new GifNotFoundError();
    }

    if (!gif.thumbnail_url) {
      throw new ThumbnailNotFoundError();
    }

    const url = await this.storage.getThumbnailURL(gif.thumbnail_url);
    return { thumbnail: url };
  }
}
