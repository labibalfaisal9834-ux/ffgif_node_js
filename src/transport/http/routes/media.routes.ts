import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { uploadMediaSchema, convertMediaSchema, updateGifSchema } from '../schemas/media.schema.js';
import { UploadService } from '../../../application/media/upload.service.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { getStorageRepository } from '../../../infrastructure/minio/storage_repo.js';
import { RedisCacheRepository } from '../../../infrastructure/redis/cache.js';
import { getRedisClientSync } from '../../../infrastructure/redis/client.js';
import { authGuard } from '../plugins/auth_guard.js';
import { QuotaExceededError } from '../../../domain/user/errors.js';
import { InvalidFileExtensionError, GifNotFoundError, GifOwnerMismatchError, ThumbnailNotFoundError, LastVideoNotFoundError } from '../../../domain/media/errors.js';

export const mediaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const storageRepo = getStorageRepository();
  const cacheRepo = new RedisCacheRepository(getRedisClientSync());
  const uploadService = new UploadService(prisma, storageRepo, cacheRepo);

  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    // POST /uploads
    protectedScope.post('/uploads', async (request, reply) => {
      const parseResult = uploadMediaSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'field required',
          status: 422,
        });
      }

      const userId = request.authUser.sub;
      try {
        const result = await uploadService.execute(userId, parseResult.data.filename);
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err instanceof QuotaExceededError) {
          return reply.status(403).send({
            error_code: 'QUOTA_EXCEEDED',
            message: 'storage quota exceeded',
            status: 403,
          });
        }
        if (err instanceof InvalidFileExtensionError) {
          return reply.status(400).send({
            error_code: 'BAD_REQUEST',
            message: 'invalid file type',
            status: 400,
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

    // GET /uploads/:key/status
    protectedScope.get('/uploads/:key/status', async (request, reply) => {
      const { key } = request.params as { key: string };
      const userId = request.authUser.sub;

      try {
        const { StatusService } = await import('../../../application/media/status.service.js');
        const { PostgresLastVideoRepository } = await import('../../../infrastructure/postgres/last_upload_repository.js');
        const lastVideoRepo = new PostgresLastVideoRepository(prisma);
        const statusService = new StatusService(cacheRepo, lastVideoRepo);

        const result = await statusService.execute(userId, key);
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err instanceof GifOwnerMismatchError) {
          return reply.status(403).send({
            error_code: 'GIF_FORBIDDEN',
            message: 'Gif Owner mismatch',
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
