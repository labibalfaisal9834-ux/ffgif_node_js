import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Config, getConfig } from '../../config/env.js';

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

  // Health check endpoint
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  return app;
}
