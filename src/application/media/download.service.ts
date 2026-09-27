import { PrismaClient } from '@prisma/client';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';

export class DownloadService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: MinioStorageRepository
  ) {}

  async execute(userId: string, key: string): Promise<string> {
    const gifRepo = new PostgresGifRepository(this.prisma);
    const shareRepo = new PostgresShareRepository(this.prisma);

    const ownerId = await gifRepo.getOwner(key);
    if (!ownerId) {
      throw new GifNotFoundError();
    }

    const sharedOwnerId = await shareRepo.getOwner(userId, key);

    if (ownerId !== userId && sharedOwnerId !== ownerId) {
      throw new GifOwnerMismatchError();
    }

    await gifRepo.incrementDownload(key);

    return this.storage.download(key, 300);
  }
}
