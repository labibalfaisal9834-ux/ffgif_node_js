import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { uploadMediaSchema, convertMediaSchema, updateGifSchema } from '../schemas/media.schema.js';
import { UploadService } from '../../../application/media/upload.service.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { getStorageRepository } from '../../../infrastructure/minio/storage_repo.js';
import { RedisCacheRepository } from '../../../infrastructure/redis/cache.js';
import { getRedisClientSync } from '../../../infrastructure/redis/client.js';
import { authGuard } from '../plugins/auth_guard.js';
import { QuotaExceededError, PreconditionFailedError } from '../../../domain/user/errors.js';
import { InvalidFileExtensionError, GifNotFoundError, GifOwnerMismatchError, ThumbnailNotFoundError, LastVideoNotFoundError } from '../../../domain/media/errors.js';

export const mediaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const storageRepo = getStorageRepository();
  const cacheRepo = new RedisCacheRepository(getRedisClientSync());
  const uploadService = new UploadService(prisma, storageRepo, cacheRepo);

  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    // GET /gifs/me
    protectedScope.get('/gifs/me', async (request, reply) => {
      const query = request.query as { filter?: string; status?: string; page?: string; limit?: string };
      const userId = request.authUser.sub;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const filter = query.filter || query.status;

      try {
        const { GetGifsService } = await import('../../../application/media/get_gifs.service.js');
        const { PostgresGifRepository } = await import('../../../infrastructure/postgres/gif_repository.js');
        const gifRepo = new PostgresGifRepository(prisma);
        const getGifsService = new GetGifsService(gifRepo);

        const result = await getGifsService.execute(userId, filter, page, limit);
        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          error_code: 'INTERNAL_ERROR',
          message: 'internal server error',
          status: 500,
        });
      }
    });

    // GET /gifs/user/:userId
    protectedScope.get('/gifs/user/:userId', async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const query = request.query as { filter?: string; status?: string; page?: string; limit?: string };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const filter = query.filter || query.status;

      try {
        const { GetGifsService } = await import('../../../application/media/get_gifs.service.js');
        const { PostgresGifRepository } = await import('../../../infrastructure/postgres/gif_repository.js');
        const gifRepo = new PostgresGifRepository(prisma);
        const getGifsService = new GetGifsService(gifRepo);

        const result = await getGifsService.execute(userId, filter, page, limit);
        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          error_code: 'INTERNAL_ERROR',
          message: 'internal server error',
          status: 500,
        });
      }
    });

    // GET /gifs/me/recents (registered before /gifs/me/:key)
    protectedScope.get('/gifs/me/recents', async (request, reply) => {
      const userId = request.authUser.sub;
      try {
        const { GetRecentsService } = await import('../../../application/media/get_recents.service.js');
        const { PostgresGifRepository } = await import('../../../infrastructure/postgres/gif_repository.js');
        const gifRepo = new PostgresGifRepository(prisma);
        const getRecentsService = new GetRecentsService(gifRepo);

        const result = await getRecentsService.execute(userId);
        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          error_code: 'INTERNAL_ERROR',
          message: 'internal server error',
          status: 500,
        });
      }
    });

    // POST /gifs/me/recents/:key/save (registered before /gifs/me/:key)
    protectedScope.post('/gifs/me/recents/:key/save', async (request, reply) => {
      const { key } = request.params as { key: string };
      const userId = request.authUser.sub;

      try {
        const { SaveService } = await import('../../../application/media/save.service.js');
        const saveService = new SaveService(prisma);
        await saveService.execute(userId, key);
        return reply.status(204).send();
      } catch (err: any) {
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

    // GET /gifs/me/:key
    protectedScope.get('/gifs/me/:key', async (request, reply) => {
      const { key } = request.params as { key: string };
      const userId = request.authUser.sub;

      try {
        const { GetByKeyService } = await import('../../../application/media/get_by_key.service.js');
        const getByKeyService = new GetByKeyService(prisma);
        const result = await getByKeyService.execute(userId, key);
        return reply.status(200).send(result);
      } catch (err: any) {
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

    // PATCH /gifs/me/:key
    protectedScope.patch('/gifs/me/:key', async (request, reply) => {
      const { key } = request.params as { key: string };
      const userId = request.authUser.sub;
      const parseResult = updateGifSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'field required',
          status: 422,
        });
      }

      const ifMatch = request.headers['if-match'];

      try {
        const { UpdateGifService } = await import('../../../application/media/update_gif.service.js');
        const updateGifService = new UpdateGifService(prisma);
        const result = await updateGifService.execute(userId, key, parseResult.data, ifMatch);
        return reply.status(200).send(result);
      } catch (err: any) {
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
            message: 'Gif Owner mismatch',
            status: 403,
          });
        }
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
    });

    // DELETE /gifs/me/:key
    protectedScope.delete('/gifs/me/:key', async (request, reply) => {
      const { key } = request.params as { key: string };
      const userId = request.authUser.sub;

      try {
        const { DeleteGifService } = await import('../../../application/media/delete_gif.service.js');
        const deleteGifService = new DeleteGifService(prisma, storageRepo);
        await deleteGifService.execute(userId, key);
        return reply.status(200).send({
          gif_key: key,
          status: 'deleted',
        });
      } catch (err: any) {
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

    // GET /uploads/:key/stream
    protectedScope.get('/uploads/:key/stream', async (request, reply) => {
      const { key } = request.params as { key: string };
      const userId = request.authUser.sub;

      try {
        const { StreamService } = await import('../../../application/media/stream.service.js');
        const streamService = new StreamService(storageRepo);
        const result = await streamService.execute(userId, key);
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

    // GET /uploads/last
    protectedScope.get('/uploads/last', async (request, reply) => {
      const userId = request.authUser.sub;

      try {
        const { LastVideoService } = await import('../../../application/media/last_video.service.js');
        const { PostgresLastVideoRepository } = await import('../../../infrastructure/postgres/last_upload_repository.js');
        const lastVideoRepo = new PostgresLastVideoRepository(prisma);
        const lastVideoService = new LastVideoService(lastVideoRepo);

        const result = await lastVideoService.execute(userId);
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err instanceof LastVideoNotFoundError) {
          return reply.status(404).send({
            error_code: 'LAST_VIDEO_NOT_FOUND',
            message: 'last video not found',
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
    });

    // POST /jobs
    protectedScope.post('/jobs', async (request, reply) => {
      const parseResult = convertMediaSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'field required',
          status: 422,
        });
      }

      const userId = request.authUser.sub;
      try {
        const { ConvertService } = await import('../../../application/media/convert.service.js');
        const { getRabbitMQClient } = await import('../../../infrastructure/rabbitmq/client.js');
        const convertService = new ConvertService(prisma, cacheRepo, getRabbitMQClient());

        const result = await convertService.execute(userId, parseResult.data);
        return reply.status(202).send({ job_id: result.id });
      } catch (err: any) {
        if (err instanceof GifOwnerMismatchError) {
          return reply.status(403).send({
            error_code: 'GIF_FORBIDDEN',
            message: 'Gif Owner mismatch',
            status: 403,
          });
        }
        if (err instanceof QuotaExceededError) {
          return reply.status(403).send({
            error_code: 'QUOTA_EXCEEDED',
            message: err.message,
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

    // GET /jobs/:jobId/status
    protectedScope.get('/jobs/:jobId/status', async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const userId = request.authUser.sub;

      try {
        const { ConversionStatusService } = await import('../../../application/media/conversion_status.service.js');
        const conversionStatusService = new ConversionStatusService(cacheRepo);
        const result = await conversionStatusService.execute(userId, jobId);
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
