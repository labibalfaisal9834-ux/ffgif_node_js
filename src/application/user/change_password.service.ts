import { PrismaClient } from '@prisma/client';
import { UserNotFoundError, InvalidCredentialError } from '../../domain/auth/errors.js';
import { PasswordHasher } from '../auth/password_hasher.js';

export class ChangePasswordService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(
    userId: string,
    currentPass: string,
    newPass: string,
    confirmPass: string
  ): Promise<void> {
    if (newPass !== confirmPass) {
      throw new Error('password not matched');
    }

    if (currentPass === newPass) {
      throw new Error('new password cannot be the same as current password');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    const isMatch = await this.hasher.compare(currentPass, user.passwordHash || '');
    if (!isMatch) {
      throw new InvalidCredentialError();
    }

    const newHash = await this.hasher.hash(newPass);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        updatedAt: new Date(),
      },
    });
  }
}
