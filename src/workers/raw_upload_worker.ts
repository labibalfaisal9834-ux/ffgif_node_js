import amqplib from 'amqplib';
import { RabbitMQClient } from '../infrastructure/rabbitmq/client.js';
import { QUEUES } from '../infrastructure/rabbitmq/constants.js';
import { CacheRepository } from '../infrastructure/redis/cache.js';
import { ProcessAndSaveService } from '../application/media/process_and_save.service.js';

export interface S3NotificationRecord {
  s3: {
    object: {
      key: string;
    };
  };
}

export interface S3NotificationMessage {
  Records?: S3NotificationRecord[];
  Err?: any;
}

export class RawUploadWorker {
  constructor(
    private readonly rabbitmq: RabbitMQClient,
    private readonly cache: CacheRepository,
    private readonly processAndSaveService: ProcessAndSaveService
  ) {}

  async run(name = 'processing-worker', concurrency = 3): Promise<void> {
    console.log(`[RawUploadWorker] Started with concurrency ${concurrency}`);
    await this.rabbitmq.consume(QUEUES.UPLOAD_PROCESS, name, concurrency, async (msg, ch) => {
      await this.handle(msg, ch);
    });
  }

  async handle(d: amqplib.ConsumeMessage, ch: amqplib.Channel): Promise<void> {
    let msg: S3NotificationMessage;
    try {
      msg = JSON.parse(d.content.toString()) as S3NotificationMessage;
    } catch (err) {
      console.error('[RawUploadWorker] Invalid notification message JSON:', err);
      ch.nack(d, false, false);
      return;
    }

    if (msg.Err || !msg.Records || msg.Records.length === 0) {
      console.error('[RawUploadWorker] Invalid notification message: empty records or error');
      ch.nack(d, false, false);
      return;
    }

    const rawRecord = msg.Records[0];
    let key = rawRecord.s3?.object?.key || (rawRecord.s3 as any)?.Object?.key;
    if (!key) {
      console.error('[RawUploadWorker] Key missing from notification message');
      ch.nack(d, false, false);
      return;
    }

    try {
      key = decodeURIComponent(key.replace(/\+/g, ' '));
    } catch (err) {
      console.error('[RawUploadWorker] Decode key failed:', key, err);
      ch.nack(d, false, false);
      return;
    }

    const uploadingKey = `uploading:${key}`;
    await this.cache.set(uploadingKey, 'processing', 5 * 60).catch(() => {});
    console.log(`[RawUploadWorker] Processing raw video key=${key}`);

    try {
      await this.processAndSaveService.execute(key);
      ch.ack(d, false);
      await this.cache.set(uploadingKey, 'ok', 5 * 60).catch(() => {});
      console.log(`[RawUploadWorker] Raw video processed successfully key=${key}`);
    } catch (err) {
      console.error(`[RawUploadWorker] Raw video processing failed key=${key}:`, err);
      await this.cache.set(uploadingKey, 'failed', 5 * 60).catch(() => {});
      ch.nack(d, false, false);
    }
  }
}
