import { PrismaClient } from '@prisma/client';
import { ShareNotFoundError, ShareForbiddenError } from '../../domain/share/errors.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';

export class DeleteShareService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, gifKey: string, shareWithId: string): Promise<void> {
    const shareRepo = new PostgresShareRepository(this.prisma);
    const owner = await shareRepo.getOwner(shareWithId, gifKey);
    if (!owner) {
      throw new ShareNotFoundError();
    }

    if (owner !== userId) {
      throw new ShareForbiddenError();
    }

    await shareRepo.delete(gifKey, shareWithId);
  }
}
