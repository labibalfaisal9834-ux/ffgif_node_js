import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  signupSchema,
  loginSchema,
  resendVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import { SignupService } from '../../../application/auth/signup.service.js';
import { LoginService } from '../../../application/auth/login.service.js';
import { VerifyService } from '../../../application/auth/verify.service.js';
import { ResendVerifyService } from '../../../application/auth/resend_verify.service.js';
import { ForgotPasswordService } from '../../../application/auth/forgot_password.service.js';
import { ResetPasswordService } from '../../../application/auth/reset_password.service.js';
import { LogoutService } from '../../../application/auth/logout.service.js';
import { PasswordHasher } from '../../../application/auth/password_hasher.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { PostgresAuthRepository } from '../../../infrastructure/postgres/auth_repository.js';
import { PostgresVerifierRepository } from '../../../infrastructure/postgres/verifier_repository.js';
import { PostgresReseterRepository } from '../../../infrastructure/postgres/reseter_repository.js';
import { getRabbitMQClient } from '../../../infrastructure/rabbitmq/client.js';
import { RedisCacheRepository } from '../../../infrastructure/redis/cache.js';
import { getRedisClientSync } from '../../../infrastructure/redis/client.js';
import {
  UserExistsError,
  InvalidCredentialError,
  UserNotVerifiedError,
  UserNotFoundError,
  UserAlreadyVerifiedError,
  InvalidTokenError,
  ResetTokenFetchFailedError,
} from '../../../domain/auth/errors.js';

export class AuthController {
  private signupService: SignupService;
  private loginService: LoginService;
  private verifyService: VerifyService;
  private resendVerifyService: ResendVerifyService;
  private forgotPasswordService: ForgotPasswordService;
  private resetPasswordService: ResetPasswordService;
  private logoutService: LogoutService;

  constructor(private readonly fastify: FastifyInstance) {
    const hasher = new PasswordHasher();
    const rabbitmq = getRabbitMQClient();
    const authRepo = new PostgresAuthRepository(prisma);
    const verifierRepo = new PostgresVerifierRepository(prisma);
    const reseterRepo = new PostgresReseterRepository(prisma);
    const cacheRepo = new RedisCacheRepository(getRedisClientSync());

    this.signupService = new SignupService(prisma, rabbitmq, hasher);
    this.loginService = new LoginService(authRepo, hasher);
    this.verifyService = new VerifyService(prisma);
    this.resendVerifyService = new ResendVerifyService(authRepo, verifierRepo, rabbitmq);
    this.forgotPasswordService = new ForgotPasswordService(authRepo, reseterRepo, rabbitmq);
    this.resetPasswordService = new ResetPasswordService(prisma, rabbitmq, hasher);
    this.logoutService = new LogoutService(cacheRepo);
  }

  signup = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = signupSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    try {
      const res = await this.signupService.execute(parseResult.data);
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
  };

  verify = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'token is empty',
        status: 400,
      });
    }

    try {
      await this.verifyService.execute(query.token);
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
  };

  resendVerify = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = resendVerifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    try {
      await this.resendVerifyService.execute(parseResult.data.email);
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
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'Bad request',
        status: 422,
      });
    }

    try {
      const { user } = await this.loginService.execute(parseResult.data);

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

      const token = this.fastify.jwt.sign(claims);

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
  };

  forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = forgotPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    try {
      await this.forgotPasswordService.execute(parseResult.data.email);
      return reply.status(202).send({ msg: 'check mail' });
    } catch (err: any) {
      if (err instanceof UserNotFoundError) {
        // Silently succeed to prevent user enumeration
        return reply.status(202).send({ msg: 'check mail' });
      }
      if (err instanceof UserNotVerifiedError) {
        return reply.status(403).send({
          error_code: 'AUTH_USER_NOT_VERIFIED',
          message: 'user is not varified',
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
  };

  getResetToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'Bad request',
        status: 400,
      });
    }

    try {
      const token = await this.resetPasswordService.getResetToken(query.token);
      return reply.status(200).send({ token });
    } catch (err: any) {
      if (err instanceof ResetTokenFetchFailedError) {
        return reply.status(410).send({
          error_code: 'AUTH_RESET_TOKEN_INVALID',
          message: 'expired or invalid token',
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
  };

  resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = resetPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    try {
      await this.resetPasswordService.resetPassword(
        parseResult.data.token,
        parseResult.data.password,
        parseResult.data.confirm_password
      );
      return reply.status(200).send('ok');
    } catch (err: any) {
      if (err instanceof ResetTokenFetchFailedError) {
        return reply.status(410).send({
          error_code: 'AUTH_RESET_TOKEN_INVALID',
          message: 'invalid or expired token',
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
  };

  logout = async (request: any, reply: FastifyReply) => {
    try {
      await this.logoutService.execute(request.rawToken, request.authUser.exp);
      return reply.status(200).send('logout');
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error_code: 'INTERNAL_ERROR',
        message: 'internal server error',
        status: 500,
      });
    }
  };
}
