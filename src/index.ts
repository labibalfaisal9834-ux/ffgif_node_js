import { getConfig } from './config/env.js';
import { buildServer } from './transport/http/server.js';

async function main() {
  const cnf = getConfig();
  const server = buildServer(cnf);

  try {
    const address = await server.listen({
      port: cnf.port,
      host: cnf.addr,
    });
    console.log(`[HTTP] Starting Server at ${address}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal error during startup:', err);
    process.exit(1);
  });
}

export { main };
