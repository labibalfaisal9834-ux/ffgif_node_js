import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UserController } from '../controllers/user.controller.js';
import { authGuard } from '../plugins/auth_guard.js';

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new UserController();

  // Protected user routes
  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    protectedScope.get('/users/me/profile', controller.getMyProfile);
    protectedScope.get('/users/:userId/profile', controller.getUserProfile);
    protectedScope.patch('/users/me/profile', controller.updateProfile);
    protectedScope.patch('/users/profile/me', controller.updateProfile);
    protectedScope.get('/users/me/quota', controller.getMyQuota);
    protectedScope.patch('/users/me/change-password', controller.changePassword);
    protectedScope.delete('/users/me', controller.deleteUser);
  });
};
