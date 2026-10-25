import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { authGuard } from '../plugins/auth_guard.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new AuthController(fastify);

  // Public auth routes
  fastify.post('/auth/signup', controller.signup);
  fastify.get('/auth/verify', controller.verify);
  fastify.post('/auth/verify/resend', controller.resendVerify);
  fastify.post('/auth/login', controller.login);
  fastify.post('/auth/forgot-password', controller.forgotPassword);
  fastify.get('/auth/reset', controller.getResetToken);
  fastify.post('/auth/reset', controller.resetPassword);

  // Protected auth routes
  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);
    protectedScope.post('/auth/logout', controller.logout);
  });
};
