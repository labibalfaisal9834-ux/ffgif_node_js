import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetProfileService } from '../../src/application/user/get_profile.service.js';
import { UpdateProfileService } from '../../src/application/user/update_profile.service.js';
import { GetQuotaService } from '../../src/application/user/get_quota.service.js';
import { ChangePasswordService } from '../../src/application/user/change_password.service.js';
import { DeleteUserService } from '../../src/application/user/delete_user.service.js';
import {
  UserNotFoundError,
  PreconditionFailedError,
} from '../../src/domain/user/errors.js';
import { InvalidCredentialError } from '../../src/domain/auth/errors.js';

describe('User Application Services', () => {
  const mockHasher = {
    hash: vi.fn().mockResolvedValue('new_hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GetProfileService', () => {
    it('should return profile with updated_at timestamp', async () => {
      const updatedAt = new Date('2026-01-01T00:00:00.000Z');
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-123',
            username: 'alice',
            fullname: 'Alice',
            email: 'alice@example.com',
            isVerified: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt,
            profile: {
              profilePic: 'https://example.com/pic.jpg',
            },
          }),
        },
      };

      const service = new GetProfileService(mockPrisma);
      const result = await service.execute('user-123');

      expect(result.username).toBe('alice');
      expect(result.updated_at).toEqual(updatedAt);
    });

    it('should throw UserNotFoundError if user is missing', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new GetProfileService(mockPrisma);
      await expect(service.execute('ghost-id')).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('UpdateProfileService', () => {
    it('should update profile when If-Match matches current updatedAt', async () => {
      const updatedAt = new Date('2026-01-01T00:00:00.000Z');
      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            user: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'user-123',
                username: 'alice',
                fullname: 'Alice',
                email: 'alice@example.com',
                isVerified: true,
                createdAt: new Date(),
                updatedAt,
                profile: {
                  profilePic: 'old.jpg',
                },
              }),
              update: vi.fn().mockResolvedValue({
                id: 'user-123',
                username: 'alice',
                fullname: 'Alice New',
                email: 'alice@example.com',
                isVerified: true,
                updatedAt: new Date(),
              }),
            },
            profile: {
              upsert: vi.fn().mockResolvedValue({
                profilePic: 'new.jpg',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = new UpdateProfileService(mockPrisma);
      const result = await service.execute(
        'user-123',
        { fullname: 'Alice New', avatar_url: 'new.jpg' },
        updatedAt.toISOString()
      );

      expect(result.fullname).toBe('Alice New');
      expect(result.avatar_url).toBe('new.jpg');
    });

    it('should throw PreconditionFailedError if If-Match does not match updatedAt', async () => {
      const currentUpdatedAt = new Date('2026-01-02T00:00:00.000Z');
      const staleUpdatedAt = new Date('2026-01-01T00:00:00.000Z');

      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            user: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'user-123',
                updatedAt: currentUpdatedAt,
                profile: {},
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = new UpdateProfileService(mockPrisma);
      await expect(
        service.execute(
          'user-123',
          { fullname: 'Alice New' },
          staleUpdatedAt.toISOString()
        )
      ).rejects.toThrow(PreconditionFailedError);
    });
  });

  describe('GetQuotaService', () => {
    it('should return user quota data', async () => {
      const mockPrisma: any = {
        quota: {
          findUnique: vi.fn().mockResolvedValue({
            id: 1,
            userId: 'user-123',
            usedBytes: BigInt(500),
            totalBytes: BigInt(1000),
            gifCount: 5,
            gifLimit: 10,
          }),
        },
      };

      const service = new GetQuotaService(mockPrisma);
      const result = await service.execute('user-123');

      expect(result?.used_bytes).toBe(500);
      expect(result?.total_bytes).toBe(1000);
      expect(result?.gif_count).toBe(5);
    });

    it('should return null if quota does not exist', async () => {
      const mockPrisma: any = {
        quota: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new GetQuotaService(mockPrisma);
      const result = await service.execute('ghost-id');
      expect(result).toBeNull();
    });
  });

  describe('ChangePasswordService', () => {
    it('should update password hash when old password matches', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-123',
            passwordHash: 'old_hashed_pw',
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      mockHasher.compare.mockResolvedValueOnce(true);

      const service = new ChangePasswordService(mockPrisma, mockHasher as any);
      await service.execute('user-123', 'oldPass', 'newPass', 'newPass');

      expect(mockHasher.hash).toHaveBeenCalledWith('newPass');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should throw InvalidCredentialError when current password is wrong', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-123',
            passwordHash: 'old_hashed_pw',
          }),
        },
      };

      mockHasher.compare.mockResolvedValueOnce(false);

      const service = new ChangePasswordService(mockPrisma, mockHasher as any);
      await expect(service.execute('user-123', 'wrongPass', 'newPass', 'newPass')).rejects.toThrow(
        InvalidCredentialError
      );
    });
  });

  describe('DeleteUserService', () => {
    it('should delete user when password matches', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-123',
            passwordHash: 'correct_pw_hash',
          }),
          delete: vi.fn().mockResolvedValue({}),
        },
      };

      mockHasher.compare.mockResolvedValueOnce(true);

      const service = new DeleteUserService(mockPrisma, mockHasher as any);
      await service.execute('user-123', 'password123');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-123' } });
    });

    it('should throw InvalidCredentialError when password is wrong', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-123',
            passwordHash: 'correct_pw_hash',
          }),
        },
      };

      mockHasher.compare.mockResolvedValueOnce(false);

      const service = new DeleteUserService(mockPrisma, mockHasher as any);
      await expect(service.execute('user-123', 'wrongPassword')).rejects.toThrow(
        InvalidCredentialError
      );
    });
  });
});
