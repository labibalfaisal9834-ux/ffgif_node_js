import { PrismaClient } from '@prisma/client';
import { UserExistsError, UserCreateFailedError } from '../../domain/auth/errors.js';
import { PasswordHasher } from './password_hasher.js';
import { generateToken } from './token_util.js';
import { PostgresAuthRepository } from '../../infrastructure/postgres/auth_repository.js';
import { PostgresVerifierRepository } from '../../infrastructure/postgres/verifier_repository.js';
import { PostgresProfileRepository } from '../../infrastructure/postgres/profile_repository.js';
import { PostgresQuotaRepository } from '../../infrastructure/postgres/quota_repository.js';
import { RabbitMQClient } from '../../infrastructure/rabbitmq/client.js';

export interface SignupInput {
  email: string;
  username: string;
  fullname: string;
  password: string;
}

export interface SignupResult {
  id: string;
}

export class SignupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbitmq: RabbitMQClient,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(input: SignupInput): Promise<SignupResult> {
    const passwordHash = await this.hasher.hash(input.password);

    // One Postgres transaction using Prisma's $transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
      const authRepo = new PostgresAuthRepository(tx);
      const verifierRepo = new PostgresVerifierRepository(tx);
      const profileRepo = new PostgresProfileRepository(tx);
      const quotaRepo = new PostgresQuotaRepository(tx);

      const existingUser = await authRepo.getByEmail(input.email);
      if (existingUser) {
        throw new UserExistsError();
      }

      const createdUser = await authRepo.create({
        username: input.username,
        fullname: input.fullname,
        email: input.email,
        passwordHash,
        role: 'user',
        isVerified: false,
      });

      if (!createdUser) {
        throw new UserCreateFailedError();
      }

      const { token, tokenHash } = generateToken();

      await verifierRepo.create({
        userId: createdUser.id,
        tokenHash,
      });

      await profileRepo.setProfile({
        userId: createdUser.id,
        profilePic: '',
      });

      await quotaRepo.create({
        userId: createdUser.id,
      });

      return {
        userId: createdUser.id,
        email: createdUser.email,
        token,
      };
    });

    // Publish the signup email to RabbitMQ AFTER the transaction commits
    try {
      await this.rabbitmq.publishEmail({
        to: txResult.email,
        name: 'signup',
        token: txResult.token,
      });
    } catch (err) {
      console.error('[SignupService] Failed to publish signup email to RabbitMQ:', err);
    }

    return { id: txResult.userId };
  }
}
