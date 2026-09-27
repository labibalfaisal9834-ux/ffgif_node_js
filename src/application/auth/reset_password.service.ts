import { Prisma, PrismaClient } from '@prisma/client';
import { getTokenHash } from './token_util.js';
import { PasswordHasher } from './password_hasher.js';
import { PostgresReseterRepository } from '../../infrastructure/postgres/reseter_repository.js';
import { PostgresAuthRepository } from '../../infrastructure/postgres/auth_repository.js';
import { ResetTokenFetchFailedError, UserNotFoundError } from '../../domain/auth/errors.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';

export class ResetPasswordService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbitmq: RabbitMQClient,
    private readonly hasher: PasswordHasher
  ) {}

  async getResetToken(token: string): Promise<string> {
    const tokenHash = getTokenHash(token);
    const reseterRepo = new PostgresReseterRepository(this.prisma);
    const reseter = await reseterRepo.getByToken(tokenHash);
    if (!reseter) {
      throw new ResetTokenFetchFailedError();
    }
    return token;
  }

  async resetPassword(token: string, pass: string, confirmPass: string): Promise<void> {
    if (pass !== confirmPass) {
      throw new Error('password and confirm_password do not match');
    }

    const tokenHash = getTokenHash(token);
    const passHash = await this.hasher.hash(pass);

    let userEmail = '';

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const reseterRepo = new PostgresReseterRepository(tx);
      const authRepo = new PostgresAuthRepository(tx);

      const oldToken = await reseterRepo.getByToken(tokenHash);
      if (!oldToken) {
        throw new ResetTokenFetchFailedError();
      }

      const user = await authRepo.getById(oldToken.userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      userEmail = user.email;

      await authRepo.updatePassword(user.id, passHash);
      await reseterRepo.deleteById(oldToken.id);
    });

    try {
      await this.rabbitmq.publishEmail({
        to: userEmail,
        name: 'reset-password',
        token: '',
      });
    } catch (err) {
      console.error('[ResetPasswordService] Failed to publish reset confirmation email:', err);
    }
  }
}
