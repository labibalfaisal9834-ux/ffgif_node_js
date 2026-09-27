import { PrismaClient } from '@prisma/client';
import { VideoProcessor } from '../../infrastructure/ffmpeg/processor.js';
import { PostgresLastVideoRepository } from '../../infrastructure/postgres/last_upload_repository.js';
import { Config, getConfig } from '../../config/env.js';

export class ProcessAndSaveService {
  private readonly maxUploadBytes: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly processor: VideoProcessor,
    configOverride?: Config
  ) {
    const cnf = configOverride || getConfig();
    this.maxUploadBytes = cnf.minio.maxUploadBytes;
  }

  async execute(key: string): Promise<void> {
    if (!key) {
      throw new Error('Empty key');
    }

    const userId = key.split(':')[0];
    if (!userId) {
      throw new Error('Empty user id');
    }

    const res = await this.processor.preProcess(key);
    const size = parseInt(res.size, 10);
    if (isNaN(size)) {
      throw new Error('Invalid parsed size');
    }

    if (size > this.maxUploadBytes) {
      throw new Error(`Uploaded file exceeds max allowed size of ${this.maxUploadBytes} bytes`);
    }

    const durationNum = parseFloat(res.duration);

    const lastVideoRepo = new PostgresLastVideoRepository(this.prisma);
    await lastVideoRepo.create({
      userId,
      fileKey: res.videoKey,
      contentType: res.contentType,
      sizeBytes: BigInt(size),
      durationSec: isNaN(durationNum) ? undefined : durationNum,
      thumbnailUrl: res.thumbnailKey,
    });
  }
}
