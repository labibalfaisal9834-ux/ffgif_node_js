import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateShareService } from '../../src/application/share/create.service.js';
import { CreateByTokenService } from '../../src/application/share/create_by_token.service.js';
import { GetSharesService } from '../../src/application/share/get.service.js';
import { GetByTokenService } from '../../src/application/share/get_by_token.service.js';
import { DownloadByTokenService } from '../../src/application/share/download_by_token.service.js';
import { DeleteShareService } from '../../src/application/share/delete.service.js';
import {
  InvalidExpiryError,
  ShareNotFoundError,
  ShareForbiddenError,
} from '../../src/domain/share/errors.js';
import { UserNotFoundError } from '../../src/domain/auth/errors.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../src/domain/media/errors.js';
import { getTokenHash } from '../../src/application/auth/token_util.js';

describe('Share Application Services', () => {
  const mockStorage = {
    download: vi.fn().mockResolvedValue('https://minio.local/presigned-share-url'),
  };

  const mockRabbitmq = {
    publishEmail: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CreateShareService', () => {
    it('should create direct share when input is valid', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'recipient-123',
            email: 'bob@example.com',
          }),
        },
        gif: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'owner-123',
          }),
        },
        share: {
          upsert: vi.fn().mockResolvedValue({
            id: 'share-1',
            gifKey: 'gif-1',
            ownerId: 'owner-123',
            sharedWith: 'recipient-123',
          }),
        },
      };

      const service = new CreateShareService(mockPrisma);
      const futureExpiry = new Date(Date.now() + 100000);

      await service.execute('owner-123', 'gif-1', 'bob@example.com', futureExpiry);
      expect(mockPrisma.share.upsert).toHaveBeenCalled();
    });

    it('should throw InvalidExpiryError if expiry is in past', async () => {
      const mockPrisma: any = {};
      const service = new CreateShareService(mockPrisma);
      const pastExpiry = new Date(Date.now() - 10000);

      await expect(
        service.execute('owner-123', 'gif-1', 'bob@example.com', pastExpiry)
      ).rejects.toThrow(InvalidExpiryError);
    });

    it('should throw UserNotFoundError if recipient is not found', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new CreateShareService(mockPrisma);
      const futureExpiry = new Date(Date.now() + 100000);

      await expect(
        service.execute('owner-123', 'gif-1', 'unknown@example.com', futureExpiry)
      ).rejects.toThrow(UserNotFoundError);
    });

    it('should throw GifOwnerMismatchError if caller does not own gif', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'recipient-123',
            email: 'bob@example.com',
          }),
        },
        gif: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'different-owner',
          }),
        },
      };

      const service = new CreateShareService(mockPrisma);
      const futureExpiry = new Date(Date.now() + 100000);

      await expect(
        service.execute('caller-123', 'gif-1', 'bob@example.com', futureExpiry)
      ).rejects.toThrow(GifOwnerMismatchError);
    });
  });

  describe('CreateByTokenService', () => {
    it('should create token share with hashed token and publish email with raw token', async () => {
      const mockPrisma: any = {
        gif: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'owner-123',
          }),
        },
        shareToken: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      };

      const service = new CreateByTokenService(mockPrisma, mockRabbitmq as any);
      const futureExpiry = new Date(Date.now() + 100000);

      const rawToken = await service.execute('owner-123', 'gif-1', 'friend@example.com', futureExpiry);

      expect(rawToken).toBeDefined();
      expect(mockPrisma.shareToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            token: getTokenHash(rawToken),
            email: 'friend@example.com',
          }),
        })
      );
      expect(mockRabbitmq.publishEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'friend@example.com',
          token: rawToken,
          name: 'share',
        })
      );
    });
  });

  describe('GetSharesService', () => {
    it('should return shared gifs for user', async () => {
      const mockPrisma: any = {
        share: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'share-1',
              gifKey: 'gif-1',
              ownerId: 'owner-123',
              sharedWith: 'recipient-123',
              gif: { name: 'Shared Gif', url: 'url-1', thumbnailKey: 'thumb-1' },
            },
          ]),
        },
      };

      const service = new GetSharesService(mockPrisma);
      const result = await service.execute('recipient-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shared Gif');
    });
  });

  describe('GetByTokenService', () => {
    it('should find share by hashed token and return gif details', async () => {
      const rawToken = 'sample-share-token';
      const tokenHash = getTokenHash(rawToken);

      const mockPrisma: any = {
        shareToken: {
          findFirst: vi.fn().mockResolvedValue({
            gifKey: 'gif-1',
            email: 'friend@example.com',
            expiresAt: new Date(Date.now() + 100000),
            createdAt: new Date(),
            gif: { name: 'Token Gif', url: 'url-1', thumbnailKey: 'thumb-1' },
          }),
        },
      };

      const service = new GetByTokenService(mockPrisma);
      const result = await service.execute(rawToken);

      expect(result.gif_key).toBe('gif-1');
      expect(result.name).toBe('Token Gif');
      expect(mockPrisma.shareToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ token: tokenHash }),
        })
      );
    });

    it('should throw ShareNotFoundError if token is invalid', async () => {
      const mockPrisma: any = {
        shareToken: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new GetByTokenService(mockPrisma);
      await expect(service.execute('invalid-token')).rejects.toThrow(ShareNotFoundError);
    });
  });

  describe('DownloadByTokenService', () => {
    it('should find by hashed token, increment download and return download URL', async () => {
      const rawToken = 'sample-share-token';
      const tokenHash = getTokenHash(rawToken);

      const mockPrisma: any = {
        shareToken: {
          findFirst: vi.fn().mockResolvedValue({
            gifKey: 'gif-1',
            email: 'friend@example.com',
            expiresAt: new Date(Date.now() + 100000),
            createdAt: new Date(),
            gif: { name: 'Token Gif', url: 'url-1' },
          }),
        },
        gif: {
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const service = new DownloadByTokenService(mockPrisma, mockStorage as any);
      const url = await service.execute(rawToken);

      expect(url).toBe('https://minio.local/presigned-share-url');
      expect(mockPrisma.gif.update).toHaveBeenCalledWith({
        where: { key: 'gif-1' },
        data: { download: { increment: 1 } },
      });
    });
  });

  describe('DeleteShareService', () => {
    it('should delete share when caller owns it', async () => {
      const mockPrisma: any = {
        share: {
          findFirst: vi.fn().mockResolvedValue({
            ownerId: 'owner-123',
          }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const service = new DeleteShareService(mockPrisma);
      await service.execute('owner-123', 'gif-1', 'recipient-123');

      expect(mockPrisma.share.deleteMany).toHaveBeenCalledWith({
        where: { gifKey: 'gif-1', sharedWith: 'recipient-123' },
      });
    });

    it('should throw ShareNotFoundError if share does not exist', async () => {
      const mockPrisma: any = {
        share: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new DeleteShareService(mockPrisma);
      await expect(
        service.execute('owner-123', 'gif-1', 'recipient-123')
      ).rejects.toThrow(ShareNotFoundError);
    });

    it('should throw ShareForbiddenError if caller is not owner', async () => {
      const mockPrisma: any = {
        share: {
          findFirst: vi.fn().mockResolvedValue({
            ownerId: 'someone-else',
          }),
        },
      };

      const service = new DeleteShareService(mockPrisma);
      await expect(
        service.execute('caller-123', 'gif-1', 'recipient-123')
      ).rejects.toThrow(ShareForbiddenError);
    });
  });
});
