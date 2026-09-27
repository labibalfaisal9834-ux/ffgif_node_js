import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/transport/http/server.js';
import { prisma } from '../../src/infrastructure/postgres/prisma.js';
import { getRedisClientSync } from '../../src/infrastructure/redis/client.js';
import { generateToken } from '../../src/application/auth/token_util.js';

describe('Auth Flow Integration Test (Signup -> Verify -> Login -> Get Profile)', () => {
  const app = buildServer();
  const testEmail = `integration_${Date.now()}@example.com`;
  const testUsername = `user_${Date.now()}`.slice(0, 20);
  const testPassword = 'Password123!';
  const { token: verifyToken, tokenHash: verifyTokenHash } = generateToken();

  let isDbAvailable = false;

  beforeAll(async () => {
    await app.ready();
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;
    } catch (_) {
      console.warn('[IntegrationTest] Database server not running; skipping live DB integration assertions');
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDbAvailable) {
      try {
        await prisma.user.deleteMany({
          where: { email: testEmail },
        });
      } catch (_) {}
    }

    try {
      const redis = getRedisClientSync();
      await redis.quit().catch(() => {});
      await prisma.$disconnect().catch(() => {});
      await app.close();
    } catch (_) {}
  });

  it('should complete full signup -> verify -> login -> get-profile flow', async () => {
    if (!isDbAvailable) {
      console.log('[IntegrationTest] Skipped because live database is offline');
      return;
    }

    // 1. Signup
    const signupRes = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        username: testUsername,
        fullname: 'Integration Test User',
        email: testEmail,
        password: testPassword,
        confirm_password: testPassword,
      },
    });

    expect(signupRes.statusCode).toBe(201);
    const signupBody = JSON.parse(signupRes.body);
    expect(signupBody.id).toBeDefined();

    const userId = signupBody.id;

    // Manually ensure we have a known verify token in DB for testing GET /auth/verify
    await prisma.verifier.upsert({
      where: { userId },
      update: {
        tokenHash: verifyTokenHash,
        expireAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      create: {
        userId,
        tokenHash: verifyTokenHash,
        expireAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // 2. Verify account
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/auth/verify?token=${verifyToken}`,
    });

    expect(verifyRes.statusCode).toBe(200);

    // 3. Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.token).toBeDefined();
    const jwtToken = loginBody.token;

    // 4. Get Profile (Protected)
    const profileRes = await app.inject({
      method: 'GET',
      url: '/users/profile/me',
      headers: {
        authorization: `Bearer ${jwtToken}`,
      },
    });

    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.headers.etag).toBeDefined();

    const profileBody = JSON.parse(profileRes.body);
    expect(profileBody.username).toBe(testUsername);
    expect(profileBody.email).toBe(testEmail);
    expect(profileBody.fullname).toBe('Integration Test User');
  });
});
