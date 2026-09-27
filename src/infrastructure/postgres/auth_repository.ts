import { PrismaClient, Prisma } from '@prisma/client';
import type { AuthRepository } from '../../domain/auth/repository.js';
import type { User } from '../../domain/auth/entity.js';

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

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

  async getById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
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

  async create(user: {
    username: string;
    fullname?: string;
    email: string;
    passwordHash: string;
    role?: string;
    isVerified?: boolean;
    deletedAt?: Date | null;
  }): Promise<User> {
    const record = await this.prisma.user.create({
      data: {
        username: user.username,
        fullname: user.fullname || '',
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role || 'user',
        isVerified: user.isVerified ?? false,
        deletedAt: user.deletedAt,
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

  async deleteById(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async deleteByEmail(email: string): Promise<void> {
    await this.prisma.user.delete({
      where: { email },
    });
  }

  async updatePassword(id: string, passHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: passHash },
    });
  }

  async setVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });
  }

  async upgrade(id: string, user: Partial<User>): Promise<User> {
    const record = await this.prisma.user.update({
      where: { id },
      data: {
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        isVerified: user.isVerified,
        deletedAt: user.deletedAt,
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
}
