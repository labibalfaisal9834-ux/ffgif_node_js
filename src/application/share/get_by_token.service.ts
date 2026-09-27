import { PrismaClient } from '@prisma/client';
import { GifTokenResponse } from '../../domain/share/entity.js';
import { ShareNotFoundError } from '../../domain/share/errors.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';
import { getTokenHash } from '../auth/token_util.js';

export class GetByTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(token: string): Promise<GifTokenResponse> {
    const tokenHash = getTokenHash(token);
    const shareRepo = new PostgresShareRepository(this.prisma);
    const result = await shareRepo.getByToken(tokenHash);
    if (!result) {
      throw new ShareNotFoundError();
    }
    return result;
  }
}
