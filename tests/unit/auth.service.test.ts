import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignupService } from '../../src/application/auth/signup.service.js';
import { LoginService } from '../../src/application/auth/login.service.js';
import { LogoutService } from '../../src/application/auth/logout.service.js';
import { VerifyService } from '../../src/application/auth/verify.service.js';
import { ResendVerifyService } from '../../src/application/auth/resend_verify.service.js';
import { ForgotPasswordService } from '../../src/application/auth/forgot_password.service.js';
import { ResetPasswordService } from '../../src/application/auth/reset_password.service.js';
import {
  UserExistsError,
  InvalidCredentialError,
  UserNotVerifiedError,
  InvalidTokenError,
  UserNotFoundError,
  UserAlreadyVerifiedError,
  ResetTokenFetchFailedError,
} from '../../src/domain/auth/errors.js';
import { getTokenHash } from '../../src/application/auth/token_util.js';

describe('Auth Application Services', () => {
  const mockHasher = {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  };

  const mockRabbitmq = {
    publishEmail: vi.fn().mockResolvedValue(undefined),
  };

  const mockCache = {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SignupService', () => {
    it('should successfully create user, verifier, profile, quota and publish email', async () => {
      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            user: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({
                id: 'user-123',
                username: 'alice',
                fullname: 'Alice Wonder',
                email: 'alice@example.com',
                passwordHash: 'hashed_password',
                role: 'user',
                isVerified: false,
              }),
            },
            verifier: {
              create: vi.fn().mockResolvedValue({}),
            },
            profile: {
              create: vi.fn().mockResolvedValue({}),
              upsert: vi.fn().mockResolvedValue({}),
            },
            quota: {
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        }),
      };

      const service = new SignupService(mockPrisma, mockRabbitmq as any, mockHasher as any);
      const result = await service.execute({
        username: 'alice',
        fullname: 'Alice Wonder',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result).toEqual({ id: 'user-123' });
      expect(mockRabbitmq.publishEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          name: 'signup',
        })
      );
    });

    it('should throw UserExistsError if email is already registered', async () => {
      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            user: {
              findUnique: vi.fn().mockResolvedValue({ id: 'existing-id' }),
            },
          };
          return callback(tx);
        }),
      };

      const service = new SignupService(mockPrisma, mockRabbitmq as any, mockHasher as any);
      await expect(
        service.execute({
          username: 'alice',
          fullname: 'Alice Wonder',
          email: 'alice@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(UserExistsError);
    });
  });

  describe('LoginService', () => {
    it('should login and return user when credentials are valid', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'alice@example.com',
          fullname: 'Alice',
          passwordHash: 'hashed_pw',
          isVerified: true,
          role: 'user',
        }),
      };

      mockHasher.compare.mockResolvedValueOnce(true);

      const service = new LoginService(mockAuthRepo as any, mockHasher as any);
      const result = await service.execute({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.user.id).toBe('user-123');
    });

    it('should throw InvalidCredentialError if user is not found', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue(null),
      };

      const service = new LoginService(mockAuthRepo as any, mockHasher as any);
      await expect(
        service.execute({
          email: 'alice@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(InvalidCredentialError);
    });

    it('should throw InvalidCredentialError on password mismatch', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'alice@example.com',
          fullname: 'Alice',
          passwordHash: 'hashed_pw',
          isVerified: true,
          role: 'user',
        }),
      };

      mockHasher.compare.mockResolvedValueOnce(false);

      const service = new LoginService(mockAuthRepo as any, mockHasher as any);
      await expect(
        service.execute({
          email: 'alice@example.com',
          password: 'wrong_password',
        })
      ).rejects.toThrow(InvalidCredentialError);
    });

    it('should throw UserNotVerifiedError if user is not verified', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'alice@example.com',
          fullname: 'Alice',
          passwordHash: 'hashed_pw',
          isVerified: false,
          role: 'user',
        }),
      };

      mockHasher.compare.mockResolvedValueOnce(true);

      const service = new LoginService(mockAuthRepo as any, mockHasher as any);
      await expect(
        service.execute({
          email: 'alice@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(UserNotVerifiedError);
    });
  });

  describe('LogoutService', () => {
    it('should set token in blocklist with remaining TTL', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 1200;

      const service = new LogoutService(mockCache as any);
      await service.execute('sample_jwt_token', futureExp);

      expect(mockCache.set).toHaveBeenCalledWith(
        'token_blocklist:sample_jwt_token',
        '1',
        expect.any(Number)
      );
    });

    it('should skip blocklist write if token is already expired', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100;

      const service = new LogoutService(mockCache as any);
      await service.execute('sample_jwt_token', pastExp);

      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('VerifyService', () => {
    it('should verify user and delete verifier record on valid token', async () => {
      const rawToken = 'raw-token-123';
      const tokenHash = getTokenHash(rawToken);

      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            verifier: {
              findFirst: vi.fn().mockResolvedValue({
                id: 1,
                userId: 'user-123',
                tokenHash,
                expireAt: new Date(Date.now() + 100000),
              }),
              delete: vi.fn().mockResolvedValue({}),
            },
            user: {
              update: vi.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        }),
      };

      const service = new VerifyService(mockPrisma);
      await service.execute(rawToken);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw InvalidTokenError on invalid or expired token', async () => {
      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            verifier: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          };
          return callback(tx);
        }),
      };

      const service = new VerifyService(mockPrisma);
      await expect(service.execute('invalid-token')).rejects.toThrow(InvalidTokenError);
    });
  });

  describe('ResendVerifyService', () => {
    it('should delete old verifier, create new token, and publish email', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'bob@example.com',
          isVerified: false,
        }),
      };

      const mockVerifierRepo = {
        getById: vi.fn().mockResolvedValue({ id: 1 }),
        delete: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({ id: 2 }),
      };

      const service = new ResendVerifyService(
        mockAuthRepo as any,
        mockVerifierRepo as any,
        mockRabbitmq as any
      );
      await service.execute('bob@example.com');

      expect(mockRabbitmq.publishEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'bob@example.com',
          name: 'resend-verify',
        })
      );
    });

    it('should throw UserNotFoundError if user does not exist', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue(null),
      };
      const mockVerifierRepo = {
        getById: vi.fn().mockResolvedValue(null),
      };

      const service = new ResendVerifyService(
        mockAuthRepo as any,
        mockVerifierRepo as any,
        mockRabbitmq as any
      );
      await expect(service.execute('ghost@example.com')).rejects.toThrow(UserNotFoundError);
    });

    it('should throw UserAlreadyVerifiedError if user is already verified', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'bob@example.com',
          isVerified: true,
        }),
      };
      const mockVerifierRepo = {
        getById: vi.fn().mockResolvedValue(null),
      };

      const service = new ResendVerifyService(
        mockAuthRepo as any,
        mockVerifierRepo as any,
        mockRabbitmq as any
      );
      await expect(service.execute('bob@example.com')).rejects.toThrow(UserAlreadyVerifiedError);
    });
  });

  describe('ForgotPasswordService', () => {
    it('should create reseter token and publish email', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'charlie@example.com',
          isVerified: true,
        }),
      };
      const mockReseterRepo = {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      };

      const service = new ForgotPasswordService(
        mockAuthRepo as any,
        mockReseterRepo as any,
        mockRabbitmq as any
      );
      await service.execute('charlie@example.com');

      expect(mockRabbitmq.publishEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'charlie@example.com',
          name: 'forgot-password',
        })
      );
    });

    it('should throw UserNotFoundError when email is not found', async () => {
      const mockAuthRepo = {
        getByEmail: vi.fn().mockResolvedValue(null),
      };
      const mockReseterRepo = {
        create: vi.fn().mockResolvedValue(null),
      };

      const service = new ForgotPasswordService(
        mockAuthRepo as any,
        mockReseterRepo as any,
        mockRabbitmq as any
      );
      await expect(service.execute('unknown@example.com')).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('ResetPasswordService', () => {
    it('should update password and publish email', async () => {
      const rawToken = 'valid-reset-token';
      const tokenHash = getTokenHash(rawToken);

      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            reseter: {
              findFirst: vi.fn().mockResolvedValue({
                id: 1,
                userId: 'user-123',
                tokenHash,
                used: false,
                expireAt: new Date(Date.now() + 60000),
              }),
              delete: vi.fn().mockResolvedValue({}),
            },
            user: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'user-123',
                email: 'charlie@example.com',
              }),
              update: vi.fn().mockResolvedValue({
                id: 'user-123',
                email: 'charlie@example.com',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = new ResetPasswordService(mockPrisma, mockRabbitmq as any, mockHasher as any);
      await service.resetPassword(rawToken, 'newPassword123', 'newPassword123');

      expect(mockHasher.hash).toHaveBeenCalledWith('newPassword123');
      expect(mockRabbitmq.publishEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'charlie@example.com',
          name: 'reset-password',
        })
      );
    });

    it('should throw ResetTokenFetchFailedError on expired or invalid token', async () => {
      const mockPrisma: any = {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx: any = {
            reseter: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          };
          return callback(tx);
        }),
      };

      const service = new ResetPasswordService(mockPrisma, mockRabbitmq as any, mockHasher as any);
      await expect(service.resetPassword('invalid-token', 'newPassword123', 'newPassword123')).rejects.toThrow(
        ResetTokenFetchFailedError
      );
    });
  });
});
