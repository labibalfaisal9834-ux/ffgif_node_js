import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { InvalidFileExtensionError } from '../../domain/media/errors.js';
import { QuotaExceededError } from '../../domain/user/errors.js';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';
import { CacheRepository } from '../../infrastructure/redis/cache.js';

export interface UploadResult {
  upload_url: string;
  key: string;
  expires_in: number;
}

export class UploadService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: MinioStorageRepository,
    private readonly cache: CacheRepository
  ) {}

  async execute(userId: string, filename: string): Promise<UploadResult> {
    const ext = path.extname(filename);
    if (!ext || ext === '.') {
      throw new InvalidFileExtensionError();
    }

    const quota = await this.prisma.quota.findUnique({
      where: { userId },
    });

    if (quota && quota.totalBytes > BigInt(0) && quota.usedBytes >= quota.totalBytes) {
      throw new QuotaExceededError();
    }

    const key = `${userId}:${uuidv4()}${ext}`;
    const expiresIn = 300; // 5 minutes

    const presignedUrl = await this.storage.create(key, expiresIn);

    // Set Redis uploading status
    await this.cache.set(`uploading:${key}`, 'uploading', expiresIn);

    return {
      upload_url: presignedUrl,
      key,
      expires_in: expiresIn,
    };
  }
}
