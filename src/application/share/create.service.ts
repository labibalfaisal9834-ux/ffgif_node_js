import { PrismaClient } from '@prisma/client';
import { InvalidExpiryError } from '../../domain/share/errors.js';
import { UserNotFoundError } from '../../domain/auth/errors.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PostgresAuthRepository } from '../../infrastructure/postgres/auth_repository.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';

export class CreateShareService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(sharedBy: string, gifKey: string, sharedWithEmail: string, expiresAt: Date): Promise<void> {
    if (expiresAt.getTime() <= Date.now()) {
      throw new InvalidExpiryError();
    }

    const authRepo = new PostgresAuthRepository(this.prisma);
    const sharedUser = await authRepo.getByEmail(sharedWithEmail);
    if (!sharedUser) {
      throw new UserNotFoundError();
    }

    const gifRepo = new PostgresGifRepository(this.prisma);
    const owner = await gifRepo.getOwner(gifKey);
    if (!owner) {
      throw new GifNotFoundError();
    }

    if (owner !== sharedBy) {
      throw new GifOwnerMismatchError();
    }

    const shareRepo = new PostgresShareRepository(this.prisma);
    await shareRepo.create({
      gifKey,
      ownerId: sharedBy,
      sharedWith: sharedUser.id,
      expiresAt,
    });
  }
}
