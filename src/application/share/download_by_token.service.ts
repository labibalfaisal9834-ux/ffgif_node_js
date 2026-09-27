import { PrismaClient } from '@prisma/client';
import { ShareNotFoundError } from '../../domain/share/errors.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';
import { getTokenHash } from '../auth/token_util.js';

export class DownloadByTokenService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: MinioStorageRepository
  ) {}

  async execute(token: string): Promise<string> {
    const tokenHash = getTokenHash(token);
    const shareRepo = new PostgresShareRepository(this.prisma);
    const gifRepo = new PostgresGifRepository(this.prisma);

    const share = await shareRepo.getByToken(tokenHash);
    if (!share) {
      throw new ShareNotFoundError();
    }

    await gifRepo.incrementDownload(share.gif_key);

    return this.storage.download(share.gif_key, 300);
  }
}
