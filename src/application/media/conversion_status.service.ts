import { GifOwnerMismatchError } from '../../domain/media/errors.js';
import { CacheRepository } from '../../infrastructure/redis/cache.js';

export interface ConversionStatusResult {
  job_id: string;
  status: string;
  gif_id: string;
}

export class ConversionStatusService {
  constructor(private readonly cache: CacheRepository) {}

  async execute(userId: string, jobId: string): Promise<ConversionStatusResult> {
    const ownerKey = `messaage_queue_owner:job_id:${jobId}`;
    const owner = await this.cache.get(ownerKey);

    if (owner && owner !== userId) {
      throw new GifOwnerMismatchError();
    }

    const mqKey = `messaage_queue:job_id:${jobId}`;
    const status = (await this.cache.get(mqKey)) || 'failed';

    const gifKey = `messaage_queue_gif:job_id:${jobId}`;
    const gifId = (await this.cache.get(gifKey)) || '';

    return {
      job_id: jobId,
      status,
      gif_id: gifId,
    };
  }
}
