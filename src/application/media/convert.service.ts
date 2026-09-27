import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { GifOwnerMismatchError } from '../../domain/media/errors.js';
import { QuotaExceededError } from '../../domain/user/errors.js';
import { CacheRepository } from '../../infrastructure/redis/cache.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';
import { ConvertMediaInput } from '../../transport/http/schemas/media.schema.js';

export interface ConvertResult {
  id: string;
  status: string;
}

export class ConvertService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheRepository,
    private readonly rabbitmq: RabbitMQClient
  ) {}

  async execute(userId: string, input: ConvertMediaInput): Promise<ConvertResult> {
    const { upload_key, start_time, end_time, width, fps, loop } = input;

    if (upload_key.includes(':') && !upload_key.startsWith(`${userId}:`)) {
      throw new GifOwnerMismatchError();
    }

    const quota = await this.prisma.quota.findUnique({
      where: { userId },
    });

    if (quota && quota.gifLimit > 0 && quota.gifCount >= quota.gifLimit) {
      throw new QuotaExceededError('gif creation limit reached');
    }

    const jobId = uuidv4();
    const status = 'queued';
    const ttl = 300; // 5 minutes

    // Set literal Redis tracking keys matching reference-go
    await this.cache.set(`messaage_queue_owner:job_id:${jobId}`, userId, ttl);
    await this.cache.set(`messaage_queue:job_id:${jobId}`, status, ttl);
    await this.cache.set(`messaage_queue_gif:job_id:${jobId}`, status, ttl);

    // Publish to RabbitMQ process.queue
    try {
      await this.rabbitmq.publishVideo({
        user_id: userId,
        job_id: jobId,
        upload_key,
        start_time,
        end_time,
        width,
        fps,
        loop,
        retries: 0,
      });
    } catch (err) {
      await this.cache.set(`messaage_queue:job_id:${jobId}`, 'failed', ttl);
      await this.cache.set(`messaage_queue_gif:job_id:${jobId}`, 'failed', ttl);
      throw err;
    }

    return {
      id: jobId,
      status,
    };
  }
}
