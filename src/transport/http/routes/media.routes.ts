import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { MediaController } from '../controllers/media.controller.js';
import { authGuard } from '../plugins/auth_guard.js';

export const mediaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new MediaController();

  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    // Gifs routes
    protectedScope.get('/gifs/me', controller.getMyGifs);
    protectedScope.get('/gifs/user/:userId', controller.getUserGifs);
    protectedScope.get('/gifs/me/recents', controller.getRecents);
    protectedScope.post('/gifs/me/recents/:key/save', controller.saveRecent);
    protectedScope.get('/gifs/me/:key', controller.getByKey);
    protectedScope.get('/gifs/me/:key/download', controller.downloadByKey);
    protectedScope.get('/gifs/me/:key/thumbnail', controller.getThumbnailByKey);
    protectedScope.patch('/gifs/me/:key', controller.updateGif);
    protectedScope.delete('/gifs/me/:key', controller.deleteGif);

    // Uploads routes
    protectedScope.post('/uploads', controller.upload);
    protectedScope.get('/uploads/:key/status', controller.getUploadStatus);
    protectedScope.get('/uploads/:key/stream', controller.streamUpload);
    protectedScope.get('/uploads/last', controller.getLastUpload);

    // Jobs routes
    protectedScope.post('/jobs', controller.createJob);
    protectedScope.get('/jobs/:jobId/status', controller.getJobStatus);
  });
};
