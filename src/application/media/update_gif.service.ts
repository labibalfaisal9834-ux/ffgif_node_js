import { Prisma, PrismaClient } from '@prisma/client';
import { GifResponse } from '../../domain/media/entity.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PreconditionFailedError } from '../../domain/user/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { UpdateGifInput } from '../../transport/http/schemas/media.schema.js';

export class UpdateGifService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    key: string,
    data: UpdateGifInput,
    ifMatch?: string
  ): Promise<GifResponse> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const gifRepo = new PostgresGifRepository(tx);
      const ownerId = await gifRepo.getOwner(key);
      if (!ownerId) {
        throw new GifNotFoundError();
      }

      if (ownerId !== userId) {
        throw new GifOwnerMismatchError();
      }

      const existing = await gifRepo.getByKey(key);
      if (!existing) {
        throw new GifNotFoundError();
      }

      if (ifMatch) {
        const cleanIfMatch = ifMatch.replace(/^"+|"+$/g, '').trim();
        const currentIso = existing.updated_at.toISOString();
        const ifMatchDate = new Date(cleanIfMatch);
        const isDateValid = !isNaN(ifMatchDate.getTime());

        const match =
          currentIso === cleanIfMatch ||
          (isDateValid && Math.abs(existing.updated_at.getTime() - ifMatchDate.getTime()) < 1000);

        if (!match) {
          throw new PreconditionFailedError('etag not matched');
        }
      }

      const updated = await gifRepo.update(key, {
        name: data.name,
        status: data.status,
        persist: data.persist,
        isPublic: data.is_public,
      });

      return updated;
    });
  }
}
