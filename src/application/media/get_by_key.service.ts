import { PrismaClient } from '@prisma/client';
import { GifResponse } from '../../domain/media/entity.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';

export class GetByKeyService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, key: string): Promise<GifResponse> {
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

    const gif = await gifRepo.getByKey(key);
    if (!gif) {
      throw new GifNotFoundError();
    }

    return gif;
  }
}
