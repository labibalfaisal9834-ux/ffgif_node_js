import { AuthRepository, VerifierRepository } from '../../domain/auth/repository.js';
import { UserNotFoundError, UserAlreadyVerifiedError, VerifierTokenCreateFailedError } from '../../domain/auth/errors.js';
import { generateToken } from './token_util.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';

export class ResendVerifyService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly verifierRepo: VerifierRepository,
    private readonly rabbitmq: RabbitMQClient
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.authRepo.getByEmail(email);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (user.isVerified) {
      throw new UserAlreadyVerifiedError();
    }

    const oldVerifier = await this.verifierRepo.getById(user.id);
    if (oldVerifier) {
      await this.verifierRepo.delete(oldVerifier.id);
    }

    const { token, tokenHash } = generateToken();

    const created = await this.verifierRepo.create({
      userId: user.id,
      tokenHash,
    });

    if (!created) {
      throw new VerifierTokenCreateFailedError();
    }

    try {
      await this.rabbitmq.publishEmail({
        to: user.email,
        name: 'resend-verify',
        token,
      });
    } catch (err) {
      console.error('[ResendVerifyService] Failed to publish email:', err);
    }
  }
}
