import { PrismaClient } from '@prisma/client';
import { UserNotFoundError } from '../../domain/auth/errors.js';
import { PreconditionFailedError } from '../../domain/user/errors.js';
import { UserProfileDTO } from './get_profile.service.js';
import { UpdateProfileInput } from '../../transport/http/schemas/user.schema.js';

export class UpdateProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    data: UpdateProfileInput,
    ifMatch: string
  ): Promise<UserProfileDTO> {
    const cleanIfMatch = ifMatch.replace(/^"+|"+$/g, '').trim();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      if (!user) {
        throw new UserNotFoundError();
      }

      const currentIso = user.updatedAt.toISOString();
      const ifMatchDate = new Date(cleanIfMatch);
      const isDateValid = !isNaN(ifMatchDate.getTime());

      const match =
        currentIso === cleanIfMatch ||
        (isDateValid && Math.abs(user.updatedAt.getTime() - ifMatchDate.getTime()) < 1000);

      if (!match) {
        throw new PreconditionFailedError('etag not matched');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          username: data.username !== undefined ? data.username : undefined,
          fullname: data.fullname !== undefined ? data.fullname : undefined,
          email: data.email !== undefined ? data.email : undefined,
          updatedAt: new Date(),
        },
      });

      let updatedProfilePic = user.profile?.profilePic || '';
      if (data.avatar_url !== undefined) {
        const updatedProfile = await tx.profile.upsert({
          where: { userId },
          update: {
            profilePic: data.avatar_url,
            updatedAt: new Date(),
          },
          create: {
            userId,
            profilePic: data.avatar_url,
          },
        });
        updatedProfilePic = updatedProfile.profilePic || '';
      }

      return {
        avatar_url: updatedProfilePic,
        username: updatedUser.username,
        fullname: updatedUser.fullname || '',
        email: updatedUser.email,
        verified: updatedUser.isVerified,
        updated_at: updatedUser.updatedAt,
      };
    });
  }
}
