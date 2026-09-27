import * as Minio from 'minio';
import { Config, getConfig } from '../../config/env.js';
import { createMinioClient, createPublicMinioClient } from './client.js';

export interface StorageInfo {
  size: number;
  contentType: string;
  uploadedAt: Date;
}

export class MinioStorageRepository {
  private readonly client: Minio.Client;
  private readonly presignedClient: Minio.Client;
  private readonly cnf: Config['minio'];

  constructor(client?: Minio.Client, presignedClient?: Minio.Client, minioConfig?: Config['minio']) {
    this.cnf = minioConfig || getConfig().minio;
    this.client = client || createMinioClient(this.cnf);
    this.presignedClient = presignedClient || createPublicMinioClient(this.cnf);
  }

  async create(key: string, expirySeconds = 300): Promise<string> {
    return this.presignedClient.presignedPutObject(this.cnf.tempBucket, key, expirySeconds);
  }

  async download(key: string, expirySeconds = 300): Promise<string> {
    return this.presignedClient.presignedGetObject(this.cnf.storageBucket, key, expirySeconds, {
      'response-content-disposition': `attachment; filename="${key}"`,
    });
  }

  async getStreamURL(key: string, expirySeconds = 60): Promise<string> {
    return this.presignedClient.presignedGetObject(this.cnf.storageBucket, key, expirySeconds, {
      'response-content-disposition': `inline; filename="${key}"`,
    });
  }

  async getThumbnailURL(key: string): Promise<string> {
    return this.presignedClient.presignedGetObject(this.cnf.storageBucket, key, 30, {
      'response-content-type': 'image/jpeg',
      'response-cache-control': 'public, max-age=604800, immutable',
    });
  }

  async isExists(key: string): Promise<boolean> {
    try {
      const stat = await this.client.statObject(this.cnf.storageBucket, key);
      return stat.size > 0;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.cnf.storageBucket, key);
  }

  async status(key: string): Promise<StorageInfo> {
    const stat = await this.client.statObject(this.cnf.storageBucket, key);
    return {
      size: stat.size,
      contentType: (stat.metaData && stat.metaData['content-type']) || 'application/octet-stream',
      uploadedAt: stat.lastModified,
    };
  }

  async downloadLocal(key: string, destPath: string): Promise<void> {
    await this.client.fGetObject(this.cnf.storageBucket, key, destPath);
  }

  async downloadLocalRawVideo(key: string, destPath: string): Promise<void> {
    await this.client.fGetObject(this.cnf.tempBucket, key, destPath);
  }

  async upload(key: string, filePath: string, contentType: string): Promise<void> {
    let backoff = 100;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.client.fPutObject(this.cnf.storageBucket, key, filePath, {
          'Content-Type': contentType,
        });
        return;
      } catch (err) {
        lastError = err as Error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, backoff));
          backoff *= 2;
        }
      }
    }

    throw lastError || new Error('Upload failed after 3 attempts');
  }
}

let storageRepoInstance: MinioStorageRepository | null = null;

export function getStorageRepository(): MinioStorageRepository {
  if (!storageRepoInstance) {
    storageRepoInstance = new MinioStorageRepository();
  }
  return storageRepoInstance;
}
