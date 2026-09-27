import { getConfig } from '../config/env.js';
import { prisma } from '../infrastructure/postgres/prisma.js';
import { getRedisClientSync } from '../infrastructure/redis/client.js';
import { RedisCacheRepository } from '../infrastructure/redis/cache.js';
import { getRabbitMQClient } from '../infrastructure/rabbitmq/client.js';
import { getStorageRepository } from '../infrastructure/minio/storage_repo.js';
import { SmtpMailer } from '../infrastructure/mailer/smtp.js';
import { FFmpegProcessor } from '../infrastructure/ffmpeg/processor.js';
import { RunConversionService } from '../application/media/run_conversion.service.js';
import { SaveMetadataService } from '../application/media/save_metadata.service.js';
import { ProcessAndSaveService } from '../application/media/process_and_save.service.js';
import { EmailWorker } from './email_worker.js';
import { ConverterWorker } from './converter_worker.js';
import { SaveMetadataWorker } from './save_metadata_worker.js';
import { RawUploadWorker } from './raw_upload_worker.js';

async function startWorkers() {
  const cnf = getConfig();
  console.log(`[Workers] Starting workers in ${cnf.environment} mode...`);

  const redisClient = getRedisClientSync();
  const cacheRepo = new RedisCacheRepository(redisClient);
  const rabbitmq = getRabbitMQClient();
  const storageRepo = getStorageRepository();
  const mailer = new SmtpMailer();
  const processor = new FFmpegProcessor(storageRepo);

  const conversionService = new RunConversionService(prisma, cacheRepo, processor);
  const saveMetadataService = new SaveMetadataService(prisma, storageRepo, rabbitmq);
  const processAndSaveService = new ProcessAndSaveService(prisma, processor, cnf);

  const emailWorker = new EmailWorker(rabbitmq, mailer);
  const convertWorker = new ConverterWorker(rabbitmq, conversionService);
  const saveMetadataWorker = new SaveMetadataWorker(rabbitmq, saveMetadataService);
  const rawUploadWorker = new RawUploadWorker(rabbitmq, cacheRepo, processAndSaveService);

  await Promise.all([
    emailWorker.run('email-worker', 10),
    convertWorker.run('convert-worker', 2),
    saveMetadataWorker.run('save-worker', 5),
    rawUploadWorker.run('processing-worker', 3),
  ]);

  console.log('[Workers] All 4 workers running');

  const shutdown = async () => {
    console.log('[Workers] Shutting down workers...');
    await rabbitmq.close().catch(() => {});
    await redisClient.quit().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    console.log('[Workers] All workers exited cleanly');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.env.NODE_ENV !== 'test') {
  startWorkers().catch((err) => {
    console.error('[Workers] Fatal error:', err);
    process.exit(1);
  });
}

export { startWorkers };
