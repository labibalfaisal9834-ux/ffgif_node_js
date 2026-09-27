import { PrismaClient } from '@prisma/client';
import { InvalidExpiryError } from '../../domain/share/errors.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../domain/media/errors.js';
import { PostgresGifRepository } from '../../infrastructure/postgres/gif_repository.js';
import { PostgresShareRepository } from '../../infrastructure/postgres/share_repository.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';
import { generateToken } from '../auth/token_util.js';

export class CreateByTokenService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbitmq: RabbitMQClient
  ) {}

  async execute(sharedBy: string, gifKey: string, sharedWithEmail: string, expiresAt: Date): Promise<string> {
    if (expiresAt.getTime() <= Date.now()) {
      throw new InvalidExpiryError();
    }

    const gifRepo = new PostgresGifRepository(this.prisma);
    const owner = await gifRepo.getOwner(gifKey);
    if (!owner) {
      throw new GifNotFoundError();
    }

    if (owner !== sharedBy) {
      throw new GifOwnerMismatchError();
    }

    const { token: rawToken, tokenHash } = generateToken();

    const shareRepo = new PostgresShareRepository(this.prisma);
    await shareRepo.createByToken({
      gifKey,
      token: tokenHash,
      email: sharedWithEmail,
      expiresAt,
    });

    try {
      await this.rabbitmq.publishEmail({
        to: sharedWithEmail,
        name: 'share',
        token: rawToken,
      });
    } catch (err) {
      console.error('[CreateByTokenService] Failed to publish share email to RabbitMQ:', err);
    }

    return rawToken;
  }
}
