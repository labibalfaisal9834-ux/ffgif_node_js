import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { Config, getConfig } from '../../config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { mediaRoutes } from './routes/media.routes.js';

export function buildServer(configOverride?: Config): FastifyInstance {
  const cnf = configOverride || getConfig();

  const app = Fastify({
    logger: {
      level: cnf.environment === 'development' ? 'info' : 'warn',
      transport:
        cnf.environment === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // CORS setup
  app.register(cors, {
    origin: cnf.minio.allowedOrigins,
    credentials: true,
  });

  // JWT setup
  app.register(fastifyJwt, {
    secret: cnf.jwtSecret,
    sign: {
      expiresIn: '24h',
      algorithm: 'HS256',
    },
  });

  // Health check endpoint
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Register domain routes
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(mediaRoutes);

  return app;
}
