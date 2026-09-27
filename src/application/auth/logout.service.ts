import { CacheRepository } from '../../infrastructure/redis/cache.js';

export class LogoutService {
  constructor(private readonly cacheRepo: CacheRepository) {}

  async execute(token: string, exp?: number): Promise<void> {
    if (!exp) return;
    const remainingMs = exp * 1000 - Date.now();
    if (remainingMs <= 0) return;

    const remainingSec = Math.ceil(remainingMs / 1000);
    const key = `token_blocklist:${token}`;
    await this.cacheRepo.set(key, '1', remainingSec);
  }
}
