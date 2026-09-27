import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createShareSchema } from '../schemas/share.schema.js';
import { CreateShareService } from '../../../application/share/create.service.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { authGuard } from '../plugins/auth_guard.js';
import { GifNotFoundError, GifOwnerMismatchError } from '../../../domain/media/errors.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import { InvalidExpiryError, ShareForbiddenError, ShareNotFoundError } from '../../../domain/share/errors.js';

export const shareRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const createShareService = new CreateShareService(prisma);

  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    // POST /gifs/me/:key/shares
    protectedScope.post('/gifs/me/:key/shares', async (request, reply) => {
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
        await createShareService.execute(userId, key, parseResult.data.shared_with, expiresAt);
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
    });
  });
};
