import { GifRepository } from '../../domain/media/repository.js';
import { GifResponse } from '../../domain/media/entity.js';

export interface GifListResult {
  data: GifResponse[];
  total: number;
  page: number;
  limit: number;
}

export class GetGifsService {
  constructor(private readonly gifRepo: GifRepository) {}

  async execute(
    userId: string,
    status?: string,
    page = 1,
    limit = 20
  ): Promise<GifListResult> {
    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 20 : limit;
    const offset = (safePage - 1) * safeLimit;

    const data = await this.gifRepo.get(userId, status, safeLimit, offset);

    return {
      data,
      total: data.length,
      page: safePage,
      limit: safeLimit,
    };
  }
}
