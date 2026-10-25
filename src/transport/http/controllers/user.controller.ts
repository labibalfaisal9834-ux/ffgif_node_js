import { FastifyReply } from 'fastify';
import { updateProfileSchema, changePasswordSchema, deleteUserSchema } from '../schemas/user.schema.js';
import { GetProfileService } from '../../../application/user/get_profile.service.js';
import { UpdateProfileService } from '../../../application/user/update_profile.service.js';
import { GetQuotaService } from '../../../application/user/get_quota.service.js';
import { ChangePasswordService } from '../../../application/user/change_password.service.js';
import { DeleteUserService } from '../../../application/user/delete_user.service.js';
import { PasswordHasher } from '../../../application/auth/password_hasher.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { UserNotFoundError, InvalidCredentialError } from '../../../domain/auth/errors.js';
import { PreconditionFailedError } from '../../../domain/user/errors.js';

export class UserController {
  private getProfileService: GetProfileService;
  private updateProfileService: UpdateProfileService;
  private getQuotaService: GetQuotaService;
  private changePasswordService: ChangePasswordService;
  private deleteUserService: DeleteUserService;

  constructor() {
    const hasher = new PasswordHasher();
    this.getProfileService = new GetProfileService(prisma);
    this.updateProfileService = new UpdateProfileService(prisma);
    this.getQuotaService = new GetQuotaService(prisma);
    this.changePasswordService = new ChangePasswordService(prisma, hasher);
    this.deleteUserService = new DeleteUserService(prisma, hasher);
  }

  getMyProfile = async (request: any, reply: FastifyReply) => {
    const userId = request.authUser.sub;
    try {
      const profile = await this.getProfileService.execute(userId);
      const etag = `"${profile.updated_at.toISOString()}"`;
      reply.header('ETag', etag);
      return reply.status(200).send(profile);
    } catch (err: any) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error_code: 'AUTH_USER_NOT_FOUND',
          message: 'user not found',
          status: 404,
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

  getUserProfile = async (request: any, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const targetId = userId === 'me' ? request.authUser.sub : userId;

    try {
      const profile = await this.getProfileService.execute(targetId);
      const etag = `"${profile.updated_at.toISOString()}"`;
      reply.header('ETag', etag);
      return reply.status(200).send(profile);
    } catch (err: any) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error_code: 'AUTH_USER_NOT_FOUND',
          message: 'user not found',
          status: 404,
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

  updateProfile = async (request: any, reply: FastifyReply) => {
    const parseResult = updateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    const ifMatch = request.headers['if-match'];
    if (!ifMatch) {
      return reply.status(412).send({
        error_code: 'PRECONDITION_FAILED',
        message: 'If-Match header is empty',
        status: 412,
      });
    }

    const userId = request.authUser.sub;
    try {
      const updated = await this.updateProfileService.execute(userId, parseResult.data, ifMatch);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof PreconditionFailedError) {
        return reply.status(412).send({
          error_code: 'PRECONDITION_FAILED',
          message: 'etag not matched',
          status: 412,
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

  getMyQuota = async (request: any, reply: FastifyReply) => {
    const userId = request.authUser.sub;
    try {
      const quota = await this.getQuotaService.execute(userId);
      return reply.status(200).send(quota);
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error_code: 'INTERNAL_ERROR',
        message: 'internal server error',
        status: 500,
      });
    }
  };

  changePassword = async (request: any, reply: FastifyReply) => {
    const parseResult = changePasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    const userId = request.authUser.sub;
    try {
      await this.changePasswordService.execute(
        userId,
        parseResult.data.current_password,
        parseResult.data.password,
        parseResult.data.confirm_password
      );
      return reply.status(200).send('changed');
    } catch (err: any) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error_code: 'AUTH_USER_NOT_FOUND',
          message: 'user not found',
          status: 404,
        });
      }
      if (err instanceof InvalidCredentialError) {
        reply.header(
          'WWW-Authenticate',
          `Bearer realm="ffgif", error="invalid_token", error_description="invalid credentials"`
        );
        return reply.status(401).send({
          error_code: 'AUTH_INVALID_CREDENTIALS',
          message: 'forbidden',
          status: 401,
        });
      }
      if (err.message === 'password not matched') {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'password not matched',
          status: 422,
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

  deleteUser = async (request: any, reply: FastifyReply) => {
    const parseResult = deleteUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'field required',
        status: 422,
      });
    }

    const userId = request.authUser.sub;
    try {
      await this.deleteUserService.execute(userId, parseResult.data.password);
      return reply.status(200).send({ msg: 'user deleted' });
    } catch (err: any) {
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error_code: 'AUTH_USER_NOT_FOUND',
          message: 'user not found',
          status: 404,
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
}
