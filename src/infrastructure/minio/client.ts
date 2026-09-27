import * as Minio from 'minio';
import { Config, getConfig } from '../../config/env.js';

export function parseMinioEndpoint(endpoint: string): { endPoint: string; port: number } {
  const clean = endpoint.replace(/^https?:\/\//, '');
  const parts = clean.split(':');
  const endPoint = parts[0] || 'localhost';
  const port = parts[1] ? parseInt(parts[1], 10) : 9000;
  return { endPoint, port };
}

export function createMinioClient(minioConfig?: Config['minio']): Minio.Client {
  const cnf = minioConfig || getConfig().minio;
  const { endPoint, port } = parseMinioEndpoint(cnf.endpoint);

  return new Minio.Client({
    endPoint,
    port,
    useSSL: cnf.secure,
    accessKey: cnf.rootUser,
    secretKey: cnf.rootPass,
    region: 'us-east-1',
  });
}

export function createPublicMinioClient(minioConfig?: Config['minio']): Minio.Client {
  const cnf = minioConfig || getConfig().minio;
  const { endPoint, port } = parseMinioEndpoint(cnf.publicEndpoint);

  return new Minio.Client({
    endPoint,
    port,
    useSSL: cnf.secure,
    accessKey: cnf.presignedUser,
    secretKey: cnf.presignedPass,
    region: 'us-east-1',
  });
}

export async function setupMinioBuckets(
  client: Minio.Client,
  minioConfig?: Config['minio']
): Promise<void> {
  const cnf = minioConfig || getConfig().minio;

  // 1. Ensure temp bucket exists
  const tempExists = await client.bucketExists(cnf.tempBucket).catch(() => false);
  if (!tempExists) {
    await client.makeBucket(cnf.tempBucket, 'us-east-1');
  }

  // 2. Ensure storage bucket exists
  const storageExists = await client.bucketExists(cnf.storageBucket).catch(() => false);
  if (!storageExists) {
    await client.makeBucket(cnf.storageBucket, 'us-east-1');
  }
  console.log('[MinIO] Buckets created/verified');

  // 3. Bind bucket notification on temp bucket to RabbitMQ fanout exchange
  try {
    const notificationConfig = new Minio.NotificationConfig();
    const queueConfig = new Minio.QueueConfig('arn:minio:sqs::1:amqp');
    queueConfig.addEvent(Minio.ObjectCreatedAll);
    notificationConfig.add(queueConfig);
    await client.setBucketNotification(cnf.tempBucket, notificationConfig);
    console.log('[MinIO] Notification bound to exchange');
  } catch (err) {
    console.warn('[MinIO] Note: could not bind bucket notification (ensure MinIO AMQP is enabled):', (err as Error).message);
  }

  // 4. Set TTL lifecycle rule on temp bucket
  try {
    const lifecycleConfig = {
      Rule: [
        {
          ID: 'expire-temp-objects',
          Status: 'Enabled',
          Expiration: {
            Days: cnf.ttlDays,
          },
        },
      ],
    };
    await client.setBucketLifecycle(cnf.tempBucket, lifecycleConfig as any);
    console.log('[MinIO] Lifecycle policy set on temp bucket');
  } catch (err) {
    console.warn('[MinIO] Note: could not set bucket lifecycle:', (err as Error).message);
  }
}
