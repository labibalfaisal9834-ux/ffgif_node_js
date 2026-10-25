import { FastifyReply } from 'fastify';
import { createShareSchema, createShareByTokenSchema } from '../schemas/share.schema.js';
import { CreateShareService } from '../../../application/share/create.service.js';
import { GetSharesService } from '../../../application/share/get.service.js';
import { DeleteShareService } from '../../../application/share/delete.service.js';
import { CreateByTokenService } from '../../../application/share/create_by_token.service.js';
import { GetByTokenService } from '../../../application/share/get_by_token.service.js';
import { DownloadByTokenService } from '../../../application/share/download_by_token.service.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { getStorageRepository } from '../../../infrastructure/minio/storage_repo.js';
import { getRabbitMQClient } from '../../../infrastructure/rabbitmq/client.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../../domain/media/errors.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import { InvalidExpiryError, ShareForbiddenError, ShareNotFoundError } from '../../../domain/share/errors.js';

export class ShareController {
  private createShareService: CreateShareService;
  private getSharesService: GetSharesService;
  private deleteShareService: DeleteShareService;
  private createByTokenService: CreateByTokenService;
  private getByTokenService: GetByTokenService;
  private downloadByTokenService: DownloadByTokenService;

  constructor() {
    const storageRepo = getStorageRepository();
    const rabbitmq = getRabbitMQClient();

    this.createShareService = new CreateShareService(prisma);
    this.getSharesService = new GetSharesService(prisma);
    this.deleteShareService = new DeleteShareService(prisma);
    this.createByTokenService = new CreateByTokenService(prisma, rabbitmq);
    this.getByTokenService = new GetByTokenService(prisma);
    this.downloadByTokenService = new DownloadByTokenService(prisma, storageRepo);
  }

  createShare = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    const parseResult = createShareSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'validation failed',
        status: 422,
      });
    }

    const expiresAt = new Date(parseResult.data.expire_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'expiry must be in the future',
        status: 422,
      });
    }

    try {
      await this.createShareService.execute(userId, key, parseResult.data.shared_with, expiresAt);
      reply.header('Location', `/gifs/me/${key}/shares/${parseResult.data.shared_with}`);
      return reply.status(201).send('shared');
    } catch (err: any) {
      if (err instanceof InvalidExpiryError) {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'expiry must be in the future',
          status: 422,
        });
      }
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({
          error_code: 'USER_NOT_FOUND',
          message: 'user not found',
          status: 404,
        });
      }
      if (err instanceof GifNotFoundError) {
        return reply.status(404).send({
          error_code: 'GIF_NOT_FOUND',
          message: 'gif not found',
          status: 404,
        });
      }
      if (err instanceof GifOwnerMismatchError) {
        return reply.status(403).send({
          error_code: 'GIF_FORBIDDEN',
          message: 'forbidden',
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

  getShares = async (request: any, reply: FastifyReply) => {
    const userId = request.authUser.sub;

    try {
      const result = await this.getSharesService.execute(userId);
      return reply.status(200).send(result);
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error_code: 'INTERNAL_ERROR',
        message: 'internal server error',
        status: 500,
      });
    }
  };

  deleteShare = async (request: any, reply: FastifyReply) => {
    const { key, shareWithId } = request.params as { key: string; shareWithId: string };
    const userId = request.authUser.sub;

    if (!key) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'gif key is missing',
        status: 400,
      });
    }

    if (!shareWithId) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'share id is missing',
        status: 400,
      });
    }

    try {
      await this.deleteShareService.execute(userId, key, shareWithId);
      return reply.status(200).send({ msg: 'share deleted' });
    } catch (err: any) {
      if (err instanceof ShareForbiddenError) {
        return reply.status(403).send({
          error_code: 'SHARE_FORBIDDEN',
          message: 'forbidden',
          status: 403,
        });
      }
      if (err instanceof ShareNotFoundError) {
        return reply.status(404).send({
          error_code: 'SHARE_NOT_FOUND',
          message: 'not found',
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

  createShareByToken = async (request: any, reply: FastifyReply) => {
    const userId = request.authUser.sub;
    const parseResult = createShareByTokenSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'bad request',
        status: 422,
      });
    }

    const expiresAt = new Date(parseResult.data.expire_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return reply.status(422).send({
        error_code: 'VALIDATION_FAILED',
        message: 'expiry must be in the future',
        status: 422,
      });
    }

    try {
      const token = await this.createByTokenService.execute(
        userId,
        parseResult.data.gif_key,
        parseResult.data.email,
        expiresAt
      );

      reply.header('Location', `/s/${token}`);
      return reply.status(201).send({ token });
    } catch (err: any) {
      if (err instanceof InvalidExpiryError) {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'expiry must be in the future',
          status: 422,
        });
      }
      if (err instanceof GifNotFoundError) {
        return reply.status(404).send({
          error_code: 'GIF_NOT_FOUND',
          message: 'gif not found',
          status: 404,
        });
      }
      if (err instanceof GifOwnerMismatchError) {
        return reply.status(403).send({
          error_code: 'GIF_FORBIDDEN',
          message: 'forbidden',
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

  getByToken = async (request: any, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    if (!token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'token is missing',
        status: 400,
      });
    }

    try {
      const result = await this.getByTokenService.execute(token);
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err instanceof ShareNotFoundError) {
        return reply.status(404).send({
          error_code: 'SHARE_NOT_FOUND',
          message: 'share not found or expired',
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

  downloadByToken = async (request: any, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    if (!token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'token is missing',
        status: 400,
      });
    }

    try {
      const downloadUrl = await this.downloadByTokenService.execute(token);
      return reply.status(200).send({ download_url: downloadUrl });
    } catch (err: any) {
      if (err instanceof ShareNotFoundError) {
        return reply.status(404).send({
          error_code: 'SHARE_NOT_FOUND',
          message: 'share not found or expired',
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
}
