import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { signupSchema, loginSchema, resendVerifySchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import { SignupService } from '../../../application/auth/signup.service.js';
import { UserExistsError, InvalidCredentialError, UserNotVerifiedError, UserNotFoundError, UserAlreadyVerifiedError, InvalidTokenError, ResetTokenFetchFailedError } from '../../../domain/auth/errors.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { getRabbitMQClient } from '../../../infrastructure/rabbitmq/client.js';
import { PasswordHasher } from '../../../application/auth/password_hasher.js';
import { authGuard } from '../plugins/auth_guard.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const hasher = new PasswordHasher();
  const rabbitmq = getRabbitMQClient();
  const signupService = new SignupService(prisma, rabbitmq, hasher);

  // POST /auth/signup
  fastify.post('/auth/signup', async (request, reply) => {
    const parseResult = signupSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    try {
      const res = await signupService.execute(parseResult.data);
      reply.header('Location', `/users/${res.id}`);
      return reply.status(201).send('user created');
    } catch (err: any) {
      if (err instanceof UserExistsError) {
        return reply.status(409).send({
          error_code: 'AUTH_USER_EXISTS',
          message: 'email exists',
          status: 409,
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error_code: 'INTERNAL_ERROR',
        message: 'internal server error',
        status: 500,
      });
    }
  });
};
