import { Prisma, PrismaClient } from '@prisma/client';
import { getTokenHash } from './token_util.js';
import { PostgresVerifierRepository } from '../../infrastructure/postgres/verifier_repository.js';
import { PostgresAuthRepository } from '../../infrastructure/postgres/auth_repository.js';
import { InvalidTokenError } from '../../domain/auth/errors.js';

export class VerifyService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(token: string): Promise<void> {
    const tokenHash = getTokenHash(token);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const verifierRepo = new PostgresVerifierRepository(tx);
      const authRepo = new PostgresAuthRepository(tx);

      const verifier = await verifierRepo.getByHash(tokenHash);
      if (!verifier) {
        throw new InvalidTokenError();
      }

      await authRepo.setVerified(verifier.userId);
      await verifierRepo.delete(verifier.id);
    });
  }
}
