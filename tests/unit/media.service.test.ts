import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from '../../src/application/media/upload.service.js';
import { StatusService } from '../../src/application/media/status.service.js';
import { StreamService } from '../../src/application/media/stream.service.js';
import { LastVideoService } from '../../src/application/media/last_video.service.js';
import { ConvertService } from '../../src/application/media/convert.service.js';
import { ConversionStatusService } from '../../src/application/media/conversion_status.service.js';
import { GetGifsService } from '../../src/application/media/get_gifs.service.js';
import { GetByKeyService } from '../../src/application/media/get_by_key.service.js';
import { GetRecentsService } from '../../src/application/media/get_recents.service.js';
import { UpdateGifService } from '../../src/application/media/update_gif.service.js';
import { DeleteGifService } from '../../src/application/media/delete_gif.service.js';
import { SaveService } from '../../src/application/media/save.service.js';
import { ThumbnailService } from '../../src/application/media/thumbnail.service.js';
import { DownloadService } from '../../src/application/media/download.service.js';
import {
  GifOwnerMismatchError,
  ThumbnailNotFoundError,
  LastVideoNotFoundError,
} from '../../src/domain/media/errors.js';

describe('Media Application Services', () => {
  const mockStorage = {
    create: vi.fn().mockResolvedValue('https://minio.local/presigned-put-url'),
    download: vi.fn().mockResolvedValue('https://minio.local/presigned-get-url'),
    getStreamURL: vi.fn().mockResolvedValue('https://minio.local/stream-url'),
    getThumbnailURL: vi.fn().mockResolvedValue('https://minio.local/thumb-url'),
    delete: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ size: 1024, contentType: 'video/mp4', uploadedAt: new Date() }),
  };

  const mockCache = {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockRabbitmq = {
    publishVideo: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UploadService', () => {
    it('should generate presigned PUT url and set Redis uploading status', async () => {
      const mockPrisma: any = {
        quota: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'user-123',
            usedBytes: BigInt(100),
            totalBytes: BigInt(10000),
          }),
        },
      };

      const service = new UploadService(mockPrisma, mockStorage as any, mockCache as any);
      const result = await service.execute('user-123', 'video.mp4');

      expect(result.upload_url).toBe('https://minio.local/presigned-put-url');
      expect(result.key).toContain('user-123:');
      expect(mockCache.set).toHaveBeenCalledWith(
        `uploading:${result.key}`,
        'uploading',
        300
      );
    });
  });

  describe('StatusService', () => {
    it('should return upload status from redis', async () => {
      mockCache.get.mockResolvedValueOnce('processing');
      const mockLastVideoRepo = {
        getLastVideo: vi.fn().mockResolvedValue(null),
      };

      const service = new StatusService(mockCache as any, mockLastVideoRepo as any);
      const result = await service.execute('user-123', 'user-123:video.mp4');

      expect(result.status).toBe('processing');
    });

    it('should throw GifOwnerMismatchError if key belongs to another user', async () => {
      const mockLastVideoRepo = {
        getLastVideo: vi.fn().mockResolvedValue(null),
      };

      const service = new StatusService(mockCache as any, mockLastVideoRepo as any);
      await expect(service.execute('user-123', 'user-456:video.mp4')).rejects.toThrow(
        GifOwnerMismatchError
      );
    });
  });

  describe('StreamService', () => {
    it('should return stream URL if user is owner of last upload', async () => {
      const service = new StreamService(mockStorage as any);
      const result = await service.execute('user-123', 'user-123:video.mp4');

      expect(result.url).toBe('https://minio.local/stream-url');
    });
  });

  describe('LastVideoService', () => {
    it('should return last uploaded video', async () => {
      const mockLastVideoRepo = {
        getLastVideo: vi.fn().mockResolvedValue({
          user_id: 'user-123',
          key: 'user-123:video.mp4',
          filename: 'video.mp4',
          content_type: 'video/mp4',
          size_bytes: 1024,
          uploaded_at: new Date(),
        }),
      };

      const service = new LastVideoService(mockLastVideoRepo as any);
      const result = await service.execute('user-123');

      expect(result.key).toBe('user-123:video.mp4');
    });

    it('should throw LastVideoNotFoundError if no video found', async () => {
      const mockLastVideoRepo = {
        getLastVideo: vi.fn().mockResolvedValue(null),
      };

      const service = new LastVideoService(mockLastVideoRepo as any);
      await expect(service.execute('user-123')).rejects.toThrow(LastVideoNotFoundError);
    });
  });

  describe('ConvertService', () => {
    it('should enqueue job, write redis tracking keys and publish to rabbitmq', async () => {
      const mockPrisma: any = {
        lastUpload: {
          findFirst: vi.fn().mockResolvedValue({
            userId: 'user-123',
            fileKey: 'user-123:video.mp4',
          }),
        },
        quota: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'user-123',
            gifCount: 1,
            gifLimit: 10,
          }),
        },
      };

      const service = new ConvertService(mockPrisma, mockCache as any, mockRabbitmq as any);
      const result = await service.execute('user-123', {
        upload_key: 'user-123:video.mp4',
        start_time: 0,
        end_time: 5,
        width: 480,
        fps: 10,
        loop: true,
      });

      expect(result.id).toBeDefined();
      expect(mockCache.set).toHaveBeenCalledWith(
        `messaage_queue:job_id:${result.id}`,
        'queued',
        300
      );
      expect(mockRabbitmq.publishVideo).toHaveBeenCalled();
    });
  });

  describe('ConversionStatusService', () => {
    it('should return status and gif_key from Redis', async () => {
      mockCache.get
        .mockResolvedValueOnce('user-123') // owner
        .mockResolvedValueOnce('completed') // job status
        .mockResolvedValueOnce('generated-gif-key.gif'); // gif key

      const service = new ConversionStatusService(mockCache as any);
      const result = await service.execute('user-123', 'job-123');

      expect(result.status).toBe('completed');
      expect(result.gif_id).toBe('generated-gif-key.gif');
    });
  });

  describe('GetGifsService', () => {
    it('should return gifs from repository', async () => {
      const mockGifRepo = {
        get: vi.fn().mockResolvedValue([
          { key: 'gif-1', name: 'Gif One', status: 'private' },
        ]),
      };

      const service = new GetGifsService(mockGifRepo as any);
      const result = await service.execute('user-123', undefined, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].key).toBe('gif-1');
    });
  });

  describe('GetByKeyService', () => {
    it('should return gif if caller is owner', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({
            key: 'gif-1',
            userId: 'user-123',
            name: 'My Gif',
            status: 'private',
            persist: true,
            isPublic: false,
            url: 'url-1',
            thumbnailKey: 'thumb-1',
            download: 0,
            fileSizeBytes: BigInt(100),
            width: 480,
            height: 360,
            durationSeconds: 5.0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        share: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new GetByKeyService(mockPrisma);
      const result = await service.execute('user-123', 'gif-1');

      expect(result.key).toBe('gif-1');
    });

    it('should throw GifOwnerMismatchError if not owner or shared', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({
            key: 'gif-1',
            userId: 'user-456',
            isPublic: false,
          }),
        },
        share: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new GetByKeyService(mockPrisma);
      await expect(service.execute('user-123', 'gif-1')).rejects.toThrow(GifOwnerMismatchError);
    });
  });

  describe('GetRecentsService', () => {
    it('should return recent gifs', async () => {
      const mockGifRepo = {
        getRecents: vi.fn().mockResolvedValue([
          { key: 'recent-1', name: 'Recent 1', status: 'recent' },
        ]),
      };

      const service = new GetRecentsService(mockGifRepo as any);
      const result = await service.execute('user-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('DeleteGifService', () => {
    it('should delete gif from DB and storage', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({ userId: 'user-123' }),
          delete: vi.fn().mockResolvedValue({}),
        },
      };

      const service = new DeleteGifService(mockPrisma, mockStorage as any);
      await service.execute('user-123', 'gif-1');

      expect(mockPrisma.gif.delete).toHaveBeenCalledWith({ where: { key: 'gif-1' } });
      expect(mockStorage.delete).toHaveBeenCalledWith('gif-1');
    });

    it('should throw GifOwnerMismatchError on mismatch', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({ userId: 'user-456' }),
        },
      };

      const service = new DeleteGifService(mockPrisma, mockStorage as any);
      await expect(service.execute('user-123', 'gif-1')).rejects.toThrow(GifOwnerMismatchError);
    });
  });

  describe('SaveService', () => {
    it('should save recent gif as private and persistent', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({ userId: 'user-123' }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const service = new SaveService(mockPrisma);
      await service.execute('user-123', 'gif-1');

      expect(mockPrisma.gif.update).toHaveBeenCalledWith({
        where: { key: 'gif-1' },
        data: expect.objectContaining({ persist: true, status: 'private' }),
      });
    });
  });

  describe('ThumbnailService', () => {
    it('should return presigned thumbnail URL', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn()
            .mockResolvedValueOnce({ userId: 'user-123' })
            .mockResolvedValueOnce({
              key: 'gif-1',
              thumbnailKey: 'thumb-key-1.jpg',
            }),
        },
      };

      const service = new ThumbnailService(mockPrisma, mockStorage as any);
      const result = await service.execute('user-123', 'gif-1');

      expect(result.thumbnail).toBe('https://minio.local/thumb-url');
    });

    it('should throw ThumbnailNotFoundError if thumbnail is missing', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn()
            .mockResolvedValueOnce({ userId: 'user-123' })
            .mockResolvedValueOnce({
              key: 'gif-1',
              thumbnailKey: '',
            }),
        },
      };

      const service = new ThumbnailService(mockPrisma, mockStorage as any);
      await expect(service.execute('user-123', 'gif-1')).rejects.toThrow(ThumbnailNotFoundError);
    });
  });

  describe('DownloadService', () => {
    it('should increment download count and return download URL', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({ userId: 'user-123' }),
          update: vi.fn().mockResolvedValue({}),
        },
        share: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new DownloadService(mockPrisma, mockStorage as any);
      const url = await service.execute('user-123', 'gif-1');

      expect(url).toBe('https://minio.local/presigned-get-url');
      expect(mockPrisma.gif.update).toHaveBeenCalledWith({
        where: { key: 'gif-1' },
        data: { download: { increment: 1 } },
      });
    });
  });
});
