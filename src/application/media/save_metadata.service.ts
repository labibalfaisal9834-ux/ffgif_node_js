import { PrismaClient } from '@prisma/client';
import { MinioStorageRepository } from '../../infrastructure/minio/storage_repo.js';
import { PostgresLastVideoRepository } from '../../infrastructure/postgres/last_upload_repository.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';

export interface SaveVideoMessagePayload {
  user_id: string;
  key: string;
  filename: string;
}

export class SaveMetadataService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: MinioStorageRepository,
    private readonly rabbitmq: RabbitMQClient
  ) {}

  async execute(msg: SaveVideoMessagePayload): Promise<void> {
    let info;
    try {
      info = await this.storage.status(msg.key);
    } catch (err) {
      // Publish to retry queue on failure
      try {
        await this.rabbitmq.publishRetrySaveVideo({
          user_id: msg.user_id,
          key: msg.key,
          filename: msg.filename,
        });
      } catch (retryErr) {
        console.error('[SaveMetadataService] Failed to publish retry message:', retryErr);
      }
      throw err;
    }

    const lastVideoRepo = new PostgresLastVideoRepository(this.prisma);
    await lastVideoRepo.create({
      userId: msg.user_id,
      fileKey: msg.key,
      fileName: msg.filename,
      contentType: info.contentType,
      sizeBytes: BigInt(info.size),
    });
  }
}
