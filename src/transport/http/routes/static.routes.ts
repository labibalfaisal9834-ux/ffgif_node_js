import fastifyStatic from '@fastify/static';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';

export const staticRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const staticDir = path.resolve(
    process.cwd(),
    process.env.STATIC_DIR || (fs.existsSync(path.resolve(process.cwd(), 'public')) ? 'public' : 'dist')
  );

  if (!fs.existsSync(staticDir)) {
    return;
  }

  await fastify.register(fastifyStatic, {
    root: staticDir,
    prefix: '/',
    wildcard: false,
  });

  fastify.setNotFoundHandler(async (request, reply) => {
    const rawPath = request.url.split('?')[0];

    // Attempt clean URL with .html extension (e.g. /friends -> /friends.html)
    const cleanPath = rawPath.replace(/^\//, '').replace(/\/$/, '');
    if (cleanPath) {
      const candidateHtml = path.join(staticDir, `${cleanPath}.html`);
      if (fs.existsSync(candidateHtml)) {
        return reply.type('text/html').sendFile(`${cleanPath}.html`);
      }
    }

    // Attempt SPA root fallback index.html for non-API routes
    const isApiRoute =
      rawPath.startsWith('/auth') ||
      rawPath.startsWith('/users') ||
      rawPath.startsWith('/gifs') ||
      rawPath.startsWith('/friends') ||
      rawPath.startsWith('/s/') ||
      rawPath === '/health';

    const indexHtml = path.join(staticDir, 'index.html');
    if (!isApiRoute && fs.existsSync(indexHtml)) {
      return reply.type('text/html').sendFile('index.html');
    }

    return reply.status(404).send({
      error_code: 'NOT_FOUND',
      message: 'resource not found',
      status: 404,
    });
  });
};
