import { PrismaClient } from '@prisma/client';
import { Quota } from '../../domain/user/entity.js';

export interface QuotaDTO {
  id: number;
  user_id: string;
  used_bytes: number;
  total_bytes: number;
  gif_count: number;
  gif_limit: number;
}

export class GetQuotaService {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string): Promise<QuotaDTO | null> {
    const quota = await this.prisma.quota.findUnique({
      where: { userId },
    });

    if (!quota) return null;

    return {
      id: quota.id,
      user_id: quota.userId,
      used_bytes: Number(quota.usedBytes),
      total_bytes: Number(quota.totalBytes),
      gif_count: quota.gifCount,
      gif_limit: quota.gifLimit,
    };
  }
}
