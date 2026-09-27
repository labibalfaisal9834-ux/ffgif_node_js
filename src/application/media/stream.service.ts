import { GifOwnerMismatchError } from '../../domain/media/errors.js';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';

export interface StreamResult {
  url: string;
  expires_in: number;
}

export class StreamService {
  constructor(private readonly storage: MinioStorageRepository) {}

  async execute(userId: string, key: string): Promise<StreamResult> {
    if (key.includes(':') && !key.startsWith(`${userId}:`)) {
      throw new GifOwnerMismatchError();
    }

    const expiresIn = 60; // 1 minute
    const presignedUrl = await this.storage.getStreamURL(key, expiresIn);

    return {
      url: presignedUrl,
      expires_in: expiresIn,
    };
  }
}
