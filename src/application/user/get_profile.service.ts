import { PrismaClient } from '@prisma/client';
import { UserNotFoundError } from '../../domain/auth/errors.js';

export interface UserProfileDTO {
  avatar_url: string;
  username: string;
  fullname: string;
  email: string;
  verified: boolean;
  updated_at: Date;
}

export class GetProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string): Promise<UserProfileDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    return {
      avatar_url: user.profile?.profilePic || '',
      username: user.username,
      fullname: user.fullname || '',
      email: user.email,
      verified: user.isVerified,
      updated_at: user.updatedAt,
    };
  }
}
