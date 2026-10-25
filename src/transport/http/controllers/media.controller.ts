import { FastifyReply } from 'fastify';
import { uploadMediaSchema, convertMediaSchema, updateGifSchema } from '../schemas/media.schema.js';
import { UploadService } from '../../../application/media/upload.service.js';
import { GetGifsService } from '../../../application/media/get_gifs.service.js';
import { GetRecentsService } from '../../../application/media/get_recents.service.js';
import { SaveService } from '../../../application/media/save.service.js';
import { GetByKeyService } from '../../../application/media/get_by_key.service.js';
import { DownloadService } from '../../../application/media/download.service.js';
import { ThumbnailService } from '../../../application/media/thumbnail.service.js';
import { UpdateGifService } from '../../../application/media/update_gif.service.js';
import { DeleteGifService } from '../../../application/media/delete_gif.service.js';
import { StatusService } from '../../../application/media/status.service.js';
import { StreamService } from '../../../application/media/stream.service.js';
import { LastVideoService } from '../../../application/media/last_video.service.js';
import { ConvertService } from '../../../application/media/convert.service.js';
import { ConversionStatusService } from '../../../application/media/conversion_status.service.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { PostgresGifRepository } from '../../../infrastructure/postgres/gif_repository.js';
import { PostgresLastVideoRepository } from '../../../infrastructure/postgres/last_upload_repository.js';
import { getStorageRepository } from '../../../infrastructure/minio/storage_repo.js';
import { RedisCacheRepository } from '../../../infrastructure/redis/cache.js';
import { getRedisClientSync } from '../../../infrastructure/redis/client.js';
import { getRabbitMQClient } from '../../../infrastructure/rabbitmq/client.js';
import { QuotaExceededError, PreconditionFailedError } from '../../../domain/user/errors.js';
import {
  InvalidFileExtensionError,
  GifNotFoundError,
  GifOwnerMismatchError,
  ThumbnailNotFoundError,
  LastVideoNotFoundError,
} from '../../../domain/media/errors.js';

export class MediaController {
  private uploadService: UploadService;
  private getGifsService: GetGifsService;
  private getRecentsService: GetRecentsService;
  private saveService: SaveService;
  private getByKeyService: GetByKeyService;
  private downloadService: DownloadService;
  private thumbnailService: ThumbnailService;
  private updateGifService: UpdateGifService;
  private deleteGifService: DeleteGifService;
  private statusService: StatusService;
  private streamService: StreamService;
  private lastVideoService: LastVideoService;
  private convertService: ConvertService;
  private conversionStatusService: ConversionStatusService;

  constructor() {
    const storageRepo = getStorageRepository();
    const cacheRepo = new RedisCacheRepository(getRedisClientSync());
    const gifRepo = new PostgresGifRepository(prisma);
    const lastVideoRepo = new PostgresLastVideoRepository(prisma);
    const rabbitmq = getRabbitMQClient();

    this.uploadService = new UploadService(prisma, storageRepo, cacheRepo);
    this.getGifsService = new GetGifsService(gifRepo);
    this.getRecentsService = new GetRecentsService(gifRepo);
    this.saveService = new SaveService(prisma);
    this.getByKeyService = new GetByKeyService(prisma);
    this.downloadService = new DownloadService(prisma, storageRepo);
    this.thumbnailService = new ThumbnailService(prisma, storageRepo);
    this.updateGifService = new UpdateGifService(prisma);
    this.deleteGifService = new DeleteGifService(prisma, storageRepo);
    this.statusService = new StatusService(cacheRepo, lastVideoRepo);
    this.streamService = new StreamService(storageRepo);
    this.lastVideoService = new LastVideoService(lastVideoRepo);
    this.convertService = new ConvertService(prisma, cacheRepo, rabbitmq);
    this.conversionStatusService = new ConversionStatusService(cacheRepo);
  }

  getMyGifs = async (request: any, reply: FastifyReply) => {
    const query = request.query as { filter?: string; status?: string; page?: string; limit?: string };
    const userId = request.authUser.sub;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const filter = query.filter || query.status;

    try {
      const result = await this.getGifsService.execute(userId, filter, page, limit);
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

  getUserGifs = async (request: any, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as { filter?: string; status?: string; page?: string; limit?: string };
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const filter = query.filter || query.status;

    try {
      const result = await this.getGifsService.execute(userId, filter, page, limit);
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

  getRecents = async (request: any, reply: FastifyReply) => {
    const userId = request.authUser.sub;
    try {
      const result = await this.getRecentsService.execute(userId);
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

  saveRecent = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      await this.saveService.execute(userId, key);
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
  };

  getByKey = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      const result = await this.getByKeyService.execute(userId, key);
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
  };

  downloadByKey = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      const url = await this.downloadService.execute(userId, key);
      return reply.status(200).send({ url });
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
  };

  getThumbnailByKey = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      const result = await this.thumbnailService.execute(userId, key);
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
      if (err instanceof ThumbnailNotFoundError) {
        return reply.status(404).send({
          error_code: 'THUMBNAIL_NOT_FOUND',
          message: 'thumbnail not found',
          status: 404,
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error_code: 'INTERNAL_ERROR',
        message: 'failed to get gif thumbnail',
        status: 500,
      });
    }
  };

  updateGif = async (request: any, reply: FastifyReply) => {
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
      const result = await this.updateGifService.execute(userId, key, parseResult.data, ifMatch);
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
  };

  deleteGif = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      await this.deleteGifService.execute(userId, key);
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
  };

  upload = async (request: any, reply: FastifyReply) => {
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
      const result = await this.uploadService.execute(userId, parseResult.data.filename);
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
  };

  getUploadStatus = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      const result = await this.statusService.execute(userId, key);
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
  };

  streamUpload = async (request: any, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const userId = request.authUser.sub;

    try {
      const result = await this.streamService.execute(userId, key);
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
  };

  getLastUpload = async (request: any, reply: FastifyReply) => {
    const userId = request.authUser.sub;

    try {
      const result = await this.lastVideoService.execute(userId);
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
  };

  createJob = async (request: any, reply: FastifyReply) => {
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
      const result = await this.convertService.execute(userId, parseResult.data);
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
  };

  getJobStatus = async (request: any, reply: FastifyReply) => {
    const { jobId } = request.params as { jobId: string };
    const userId = request.authUser.sub;

    try {
      const result = await this.conversionStatusService.execute(userId, jobId);
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
  };
}
