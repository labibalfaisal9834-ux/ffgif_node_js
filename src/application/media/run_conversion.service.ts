import { PrismaClient } from '@prisma/client';
import { CacheRepository } from '../../infrastructure/redis/cache.js';
import { VideoProcessor } from '../../infrastructure/ffmpeg/processor.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { PostgresQuotaRepository } from '../../infrastructure/postgres/quota_repository.js';

export interface VideoMessagePayload {
  job_id: string;
  user_id: string;
  key: string;
  start: number;
  end: number;
  width?: number;
  fps?: number;
  loop?: boolean;
}

export class RunConversionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheRepository,
    private readonly processor: VideoProcessor
  ) {}

  async execute(msg: VideoMessagePayload): Promise<void> {
    const key = `messaage_queue:job_id:${msg.job_id}`;
    await this.cache.set(key, 'processing', 10 * 60);

    let result;
    try {
      result = await this.processor.process(
        msg.job_id,
        msg.key,
        msg.start,
        msg.end,
        msg.width || 480,
        msg.fps || 10,
        msg.loop ?? false
      );
    } catch (err) {
      await this.cache.set(key, 'failed', 5 * 60).catch(() => {});
      throw err;
    }

    const gifKey = `messaage_queue_gif:job_id:${msg.job_id}`;
    await this.cache.set(gifKey, result.gifKey, 5 * 60);
    await this.cache.set(key, 'completed', 5 * 60);

    const gifRepo = new PostgresGifRepository(this.prisma);
    await gifRepo.create({
      key: result.gifKey,
      userId: msg.user_id,
      name: '',
      status: 'private',
      persist: false,
      url: result.gifKey,
      thumbnailKey: result.thumbKey,
      download: 0,
      fileSizeBytes: BigInt(0),
      width: msg.width || 480,
      height: 0,
      durationSeconds: msg.end - msg.start,
      isPublic: false,
    });

    const quotaRepo = new PostgresQuotaRepository(this.prisma);
    await quotaRepo.incrementGifCount(msg.user_id, BigInt(0)).catch((err) => {
      console.warn('[RunConversionService] Failed to increment quota count:', err);
    });
  }
}
