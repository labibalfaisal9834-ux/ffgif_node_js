import { PrismaClient } from '@prisma/client';
import { UserNotFoundError, InvalidCredentialError } from '../../domain/auth/errors.js';
import { PasswordHasher } from '../auth/password_hasher.js';

export class DeleteUserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(userId: string, passwordConfirm: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    const isMatch = await this.hasher.compare(passwordConfirm, user.passwordHash || '');
    if (!isMatch) {
      throw new InvalidCredentialError();
    }

    // Rely on FK cascade for cleanup (profiles, quota, verifier, reseter, gifs, etc.)
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }
}
