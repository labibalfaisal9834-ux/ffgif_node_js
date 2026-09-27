import { GifOwnerMismatchError, LastVideoNotFoundError } from '../../domain/media/errors.js';
import { CacheRepository } from '../../infrastructure/redis/cache.js';
import { LastVideoRepository } from '../../domain/media/repository.js';

export interface StatusResult {
  file_key: string;
  status: string;
}

export class StatusService {
  constructor(
    private readonly cache: CacheRepository,
    private readonly lastVideoRepo: LastVideoRepository
  ) {}

  async execute(userId: string, key: string): Promise<StatusResult> {
    if (key.includes(':') && !key.startsWith(`${userId}:`)) {
      throw new GifOwnerMismatchError();
    }

    const val = await this.cache.get(`uploading:${key}`);
    const status = val || 'failed';

    if (status !== 'ok') {
      return {
        file_key: '',
        status,
      };
    }

    const lastVideo = await this.lastVideoRepo.getLastVideo(userId);
    if (!lastVideo) {
      return {
        file_key: key,
        status: 'ok',
      };
    }

    return {
      file_key: lastVideo.key,
      status: 'ok',
    };
  }
}
