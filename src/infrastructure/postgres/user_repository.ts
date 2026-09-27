import { PrismaClient, Prisma } from '@prisma/client';
import type { UserRepository } from '../../domain/user/repository.js';
import type { User } from '../../domain/auth/entity.js';
import { PreconditionFailedError } from '../../domain/user/errors.js';

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async getById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!record) return null;
    return {
      id: record.id,
      username: record.username,
      fullname: record.fullname || '',
      email: record.email,
      passwordHash: record.passwordHash || '',
      isVerified: record.isVerified,
      role: record.role,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  async getByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!record) return null;
    return {
      id: record.id,
      username: record.username,
      fullname: record.fullname || '',
      email: record.email,
      passwordHash: record.passwordHash || '',
      isVerified: record.isVerified,
      role: record.role,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  async updateProfile(userId: string, fullname: string, expectedUpdatedAt?: Date): Promise<User> {
    // If expectedUpdatedAt is provided, check updatedAt match
    if (expectedUpdatedAt) {
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!current || Math.abs(current.updatedAt.getTime() - expectedUpdatedAt.getTime()) > 1000) {
        throw new PreconditionFailedError();
      }
    }

    const record = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullname,
      },
    });

    return {
      id: record.id,
      username: record.username,
      fullname: record.fullname || '',
      email: record.email,
      passwordHash: record.passwordHash || '',
      isVerified: record.isVerified,
      role: record.role,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  async deleteUser(userId: string): Promise<void> {
    // Foreign keys have onDelete: Cascade in prisma schema
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async changePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
