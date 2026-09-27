import { PrismaClient, Prisma } from '@prisma/client';
import { ProfileRepository } from '../../domain/user/repository.js';
import { Profile } from '../../domain/user/entity.js';

export class PostgresProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const record = await this.prisma.profile.findUnique({
      where: { userId },
    });
    return record;
  }

  async setProfile(profile: { userId: string; profilePic?: string }): Promise<Profile> {
    const record = await this.prisma.profile.create({
      data: {
        userId: profile.userId,
        profilePic: profile.profilePic || '',
      },
    });
    return record;
  }

  async updateProfile(userId: string, profilePic: string, _expectedUpdatedAt?: Date): Promise<Profile> {
    const record = await this.prisma.profile.upsert({
      where: { userId },
      update: { profilePic },
      create: {
        userId,
        profilePic,
      },
    });
    return record;
  }
}
