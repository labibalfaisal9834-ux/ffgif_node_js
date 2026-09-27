import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getRedisClientSync } from '../../../infrastructure/redis/client.js';

export interface JwtPayload {
  full_name: string;
  email?: string;
  role: string;
  sub: string;
  iss?: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: JwtPayload;
    rawToken: string;
  }
}

const authGuardPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.header('WWW-Authenticate', 'Bearer realm="ffgif", error="invalid_request"');
      return reply.status(401).send({
        error_code: 'AUTH_INVALID_CREDENTIALS',
        message: 'authorization header missing',
        status: 401,
      });
    }

    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    let decoded: JwtPayload;
    try {
      decoded = fastify.jwt.verify<JwtPayload>(token);
    } catch (err: any) {
      const isExpired = err.message?.includes('expired') || err.code === 'FAST_JWT_EXPIRED';
      reply.header(
        'WWW-Authenticate',
        `Bearer realm="ffgif", error="invalid_token", error_description="${isExpired ? 'token expired' : 'invalid token'}"`
      );
      return reply.status(401).send({
        error_code: 'AUTH_INVALID_CREDENTIALS',
        message: 'invalid token',
        status: 401,
      });
    }

    // Check Redis token blocklist
    try {
      const redis = getRedisClientSync();
      const isBlocklisted = await redis.get(`token_blocklist:${token}`);
      if (isBlocklisted) {
        reply.header(
          'WWW-Authenticate',
          'Bearer realm="ffgif", error="invalid_token", error_description="token on blocklist"'
        );
        return reply.status(401).send({
          error_code: 'AUTH_INVALID_CREDENTIALS',
          message: 'token on blocklist',
          status: 401,
        });
      }
    } catch (err: any) {
      if (err.message && err.message.includes('blocklist')) {
        reply.header(
          'WWW-Authenticate',
          'Bearer realm="ffgif", error="invalid_token", error_description="unable to verify token status"'
        );
        return reply.status(401).send({
          error_code: 'AUTH_INVALID_CREDENTIALS',
          message: 'unable to verify token status',
          status: 401,
        });
      }
    }

    request.authUser = decoded;
    request.rawToken = token;
  });
};

export const authGuard = fp(authGuardPlugin);
