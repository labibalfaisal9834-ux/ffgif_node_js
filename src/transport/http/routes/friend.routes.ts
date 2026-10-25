import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { FriendController } from '../controllers/friend.controller.js';
import { authGuard } from '../plugins/auth_guard.js';

export const friendRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const controller = new FriendController();

  // Protected friend routes
  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    protectedScope.post('/friends/requests', controller.sendRequest);
    protectedScope.get('/friends/requests', controller.listPendingRequests);
    protectedScope.patch('/friends/requests/:id', controller.acceptRequest);
    protectedScope.delete('/friends/requests/:id', controller.rejectRequest);
    protectedScope.get('/friends', controller.listFriends);
    protectedScope.delete('/friends/:id', controller.removeFriend);
  });
};
