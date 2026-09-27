import { AuthRepository, ReseterRepository } from '../../domain/auth/repository.js';
import { UserNotFoundError, UserNotVerifiedError, CreateResetTokenFailedError } from '../../domain/auth/errors.js';
import { generateToken } from './token_util.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';

export class ForgotPasswordService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly reseterRepo: ReseterRepository,
    private readonly rabbitmq: RabbitMQClient
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.authRepo.getByEmail(email);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.isVerified) {
      throw new UserNotVerifiedError();
    }

    const { token, tokenHash } = generateToken();

    const created = await this.reseterRepo.create({
      userId: user.id,
      tokenHash,
    });

    if (!created) {
      throw new CreateResetTokenFailedError();
    }

    try {
      await this.rabbitmq.publishEmail({
        to: user.email,
        name: 'forgot-password',
        token,
      });
    } catch (err) {
      console.error('[ForgotPasswordService] Failed to publish email:', err);
    }
  }
}
