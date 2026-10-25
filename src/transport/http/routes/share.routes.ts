import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ShareController } from '../controllers/share.controller.js';
import { authGuard } from '../plugins/auth_guard.js';

export const shareRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new ShareController();

  // Protected share routes
  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    protectedScope.post('/gifs/me/:key/shares', controller.createShare);
    protectedScope.get('/gifs/me/shares', controller.getShares);
    protectedScope.delete('/gifs/me/:key/shares/:shareWithId', controller.deleteShare);
    protectedScope.post('/s', controller.createShareByToken);
  });

  // Public share routes
  fastify.get('/s/:token', controller.getByToken);
  fastify.get('/s/:token/download', controller.downloadByToken);
};
