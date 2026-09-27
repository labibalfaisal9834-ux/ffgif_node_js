import { PrismaClient } from '@prisma/client';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';

export class SaveService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, key: string): Promise<void> {
    const gifRepo = new PostgresGifRepository(this.prisma);
    const ownerId = await gifRepo.getOwner(key);
    if (!ownerId) {
      throw new GifNotFoundError();
    }

    if (ownerId !== userId) {
      throw new GifOwnerMismatchError();
    }

    await gifRepo.saveRecent(key);
  }
}
