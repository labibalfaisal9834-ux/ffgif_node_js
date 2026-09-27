import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { signupSchema, loginSchema, resendVerifySchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import { SignupService } from '../../../application/auth/signup.service.js';
import { LoginService } from '../../../application/auth/login.service.js';
import { UserExistsError, InvalidCredentialError, UserNotVerifiedError, UserNotFoundError, UserAlreadyVerifiedError, InvalidTokenError, ResetTokenFetchFailedError } from '../../../domain/auth/errors.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { PostgresAuthRepository } from '../../../infrastructure/postgres/auth_repository.js';
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

  // GET /auth/verify
  fastify.get('/auth/verify', async (request, reply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'token is empty',
        status: 400,
      });
    }

    try {
      const { VerifyService } = await import('../../../application/auth/verify.service.js');
      const verifyService = new VerifyService(prisma);
      await verifyService.execute(query.token);
      return reply.status(200).send('account verified');
    } catch (err: any) {
      if (err instanceof InvalidTokenError) {
        return reply.status(410).send({
          error_code: 'AUTH_VERIFY_TOKEN_INVALID',
          message: 'token expired or invalid',
          status: 410,
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

  // POST /auth/verify/resend
  fastify.post('/auth/verify/resend', async (request, reply) => {
    const parseResult = resendVerifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    try {
      const { ResendVerifyService } = await import('../../../application/auth/resend_verify.service.js');
      const { PostgresVerifierRepository } = await import('../../../infrastructure/postgres/verifier_repository.js');

      const authRepo = new PostgresAuthRepository(prisma);
      const verifierRepo = new PostgresVerifierRepository(prisma);
      const resendVerifyService = new ResendVerifyService(authRepo, verifierRepo, rabbitmq);

      await resendVerifyService.execute(parseResult.data.email);
      return reply.status(202).send({ msg: 'check mail' });
    } catch (err: any) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error_code: 'AUTH_USER_NOT_FOUND',
          message: 'user not found',
          status: 404,
        });
      }
      if (err instanceof UserAlreadyVerifiedError) {
        return reply.status(403).send({
          error_code: 'AUTH_USER_NOT_VERIFIED',
          message: 'not verified',
          status: 403,
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

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'Bad request',
        status: 422,
      });
    }

    try {
      const authRepo = new PostgresAuthRepository(prisma);
      const loginService = new LoginService(authRepo, hasher);
      const { user } = await loginService.execute(parseResult.data);

      const claims =
        user.role === 'anon'
          ? {
              full_name: user.fullname,
              role: user.role,
              sub: user.id,
              iss: 'ffgif',
            }
          : {
              full_name: user.fullname,
              email: user.email,
              role: user.role,
              sub: user.id,
              iss: 'ffgif',
            };

      const token = fastify.jwt.sign(claims);

      return reply.status(200).send({
        token,
        id: user.id,
      });
    } catch (err: any) {
      if (err instanceof UserNotVerifiedError) {
        return reply.status(403).send({
          error_code: 'AUTH_USER_NOT_VERIFIED',
          message: 'not verified',
          status: 403,
        });
      }
      if (err instanceof InvalidCredentialError) {
        reply.header(
          'WWW-Authenticate',
          `Bearer realm="ffgif", error="invalid_token", error_description="invalid credentials"`
        );
        return reply.status(401).send({
          error_code: 'AUTH_INVALID_CREDENTIALS',
          message: 'invalid credentials',
          status: 401,
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

  // Protected auth routes (wrapped with authGuard plugin)
  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    protectedScope.post('/auth/logout', async (request, reply) => {
      try {
        const { RedisCacheRepository } = await import('../../../infrastructure/redis/cache.js');
        const { getRedisClientSync } = await import('../../../infrastructure/redis/client.js');
        const { LogoutService } = await import('../../../application/auth/logout.service.js');

        const cacheRepo = new RedisCacheRepository(getRedisClientSync());
        const logoutService = new LogoutService(cacheRepo);

        await logoutService.execute(request.rawToken, request.authUser.exp);
        return reply.status(200).send('logout');
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          error_code: 'INTERNAL_ERROR',
          message: 'internal server error',
          status: 500,
        });
      }
    });
  });
};
