import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sendFriendRequestSchema } from '../schemas/friend.schema.js';
import { SendRequestService } from '../../../application/friend/send_request.service.js';
import { AcceptFriendService } from '../../../application/friend/accept.service.js';
import { RejectFriendService } from '../../../application/friend/reject.service.js';
import { RemoveFriendService } from '../../../application/friend/remove.service.js';
import { ListFriendsService } from '../../../application/friend/list_friends.service.js';
import { ListPendingFriendsService } from '../../../application/friend/list_pending.service.js';
import { PostgresFriendRepository } from '../../../infrastructure/postgres/friend_repository.js';
import { prisma } from '../../../infrastructure/postgres/prisma.js';
import { authGuard } from '../plugins/auth_guard.js';
import {
  CannotFriendSelfError,
  FriendshipAlreadyExistsError,
  FriendshipForbiddenError,
  FriendshipNotFoundError,
} from '../../../domain/friend/errors.js';

export const friendRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const friendRepo = new PostgresFriendRepository(prisma);
  const sendRequestService = new SendRequestService(friendRepo);
  const acceptFriendService = new AcceptFriendService(friendRepo);
  const rejectFriendService = new RejectFriendService(friendRepo);
  const removeFriendService = new RemoveFriendService(friendRepo);
  const listFriendsService = new ListFriendsService(friendRepo);
  const listPendingFriendsService = new ListPendingFriendsService(friendRepo);

  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);

    // POST /friends/requests
    protectedScope.post('/friends/requests', async (request, reply) => {
      const userId = request.authUser.sub;
      const parseResult = sendFriendRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          error_code: 'VALIDATION_FAILED',
          message: 'field required',
          status: 422,
        });
      }

      try {
        const friendship = await sendRequestService.execute(userId, parseResult.data.addressee_id);
        return reply.status(201).send(friendship);
      } catch (err: any) {
        if (err instanceof CannotFriendSelfError) {
          return reply.status(422).send({
            error_code: 'VALIDATION_FAILED',
            message: 'cannot send a friend request to yourself',
            status: 422,
          });
        }
        if (err instanceof FriendshipAlreadyExistsError) {
          return reply.status(409).send({
            error_code: 'FRIENDSHIP_ALREADY_EXISTS',
            message: 'friendship already exists',
            status: 409,
          });
        }
        if (err instanceof FriendshipNotFoundError) {
          return reply.status(404).send({
            error_code: 'FRIENDSHIP_NOT_FOUND',
            message: 'not found',
            status: 404,
          });
        }
        if (err instanceof FriendshipForbiddenError) {
          return reply.status(403).send({
            error_code: 'FRIENDSHIP_FORBIDDEN',
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

    // GET /friends/requests
    protectedScope.get('/friends/requests', async (request, reply) => {
      const userId = request.authUser.sub;
      try {
        const results = await listPendingFriendsService.execute(userId);
        return reply.status(200).send(results);
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          error_code: 'INTERNAL_ERROR',
          message: 'internal server error',
          status: 500,
        });
      }
    });

    // PATCH /friends/requests/:id
    protectedScope.patch('/friends/requests/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.authUser.sub;

      if (!id) {
        return reply.status(400).send({
          error_code: 'BAD_REQUEST',
          message: 'friendship request id is missing',
          status: 400,
        });
      }

      try {
        const friendship = await acceptFriendService.execute(id, userId);
        return reply.status(200).send(friendship);
      } catch (err: any) {
        if (err instanceof FriendshipNotFoundError) {
          return reply.status(404).send({
            error_code: 'FRIENDSHIP_NOT_FOUND',
            message: 'friendship request not found',
            status: 404,
          });
        }
        if (err instanceof FriendshipForbiddenError) {
          return reply.status(403).send({
            error_code: 'FRIENDSHIP_FORBIDDEN',
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

    // DELETE /friends/requests/:id
    protectedScope.delete('/friends/requests/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.authUser.sub;

      if (!id) {
        return reply.status(400).send({
          error_code: 'BAD_REQUEST',
          message: 'friendship request id is missing',
          status: 400,
        });
      }

      try {
        await rejectFriendService.execute(id, userId);
        return reply.status(200).send({ msg: 'rejected' });
      } catch (err: any) {
        if (err instanceof FriendshipNotFoundError) {
          return reply.status(404).send({
            error_code: 'FRIENDSHIP_NOT_FOUND',
            message: 'friendship request not found',
            status: 404,
          });
        }
        if (err instanceof FriendshipForbiddenError) {
          return reply.status(403).send({
            error_code: 'FRIENDSHIP_FORBIDDEN',
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

    // GET /friends
    protectedScope.get('/friends', async (request, reply) => {
      const userId = request.authUser.sub;
      try {
        const results = await listFriendsService.execute(userId);
        return reply.status(200).send(results);
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          error_code: 'INTERNAL_ERROR',
          message: 'internal server error',
          status: 500,
        });
      }
    });

    // DELETE /friends/:id
    protectedScope.delete('/friends/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.authUser.sub;

      if (!id) {
        return reply.status(400).send({
          error_code: 'BAD_REQUEST',
          message: 'friendship id is missing',
          status: 400,
        });
      }

      try {
        await removeFriendService.execute(id, userId);
        return reply.status(200).send({ msg: 'removed' });
      } catch (err: any) {
        if (err instanceof FriendshipNotFoundError) {
          return reply.status(404).send({
            error_code: 'FRIENDSHIP_NOT_FOUND',
            message: 'friendship not found',
            status: 404,
          });
        }
        if (err instanceof FriendshipForbiddenError) {
          return reply.status(403).send({
            error_code: 'FRIENDSHIP_FORBIDDEN',
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
