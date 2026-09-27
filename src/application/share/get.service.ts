import { PrismaClient } from '@prisma/client';
import type { SharedGifResponse } from '../../domain/share/entity.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';

export class GetSharesService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string): Promise<SharedGifResponse[]> {
    const shareRepo = new PostgresShareRepository(this.prisma);
    return shareRepo.get(userId);
  }
}
