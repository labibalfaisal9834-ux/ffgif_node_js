import { PrismaClient, Prisma } from '@prisma/client';
import { FriendResponse, Friendship, FriendshipStatus } from '../../domain/friend/entity.js';
import { FriendRepository } from '../../domain/friend/repository.js';
import {
  FriendshipForbiddenError,
  FriendshipNotFoundError,
} from '../../domain/friend/errors.js';

interface FriendUserRow {
  id: string;
  username: string;
  fullname?: string | null;
}

interface FriendshipWithUsersRow {
  requesterId: string;
  addresseeId: string;
  status: string;
  createdAt: Date;
  requester: FriendUserRow;
  addressee: FriendUserRow;
}

interface FriendshipWithRequesterRow {
  status: string;
  createdAt: Date;
  requester: FriendUserRow;
}

export class PostgresFriendRepository implements FriendRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(requesterId: string, addresseeId: string): Promise<Friendship> {
    const record = await (this.prisma as any).friendship.create({
      data: {
        requesterId,
        addresseeId,
        status: 'pending',
      },
    });

    return {
      id: record.id,
      requester_id: record.requesterId,
      addressee_id: record.addresseeId,
      status: record.status as FriendshipStatus,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  async exists(userA: string, userB: string): Promise<boolean> {
    const count = await (this.prisma as any).friendship.count({
      where: {
        OR: [
          { requesterId: userA, addresseeId: userB },
          { requesterId: userB, addresseeId: userA },
        ],
      },
    });
    return count > 0;
  }

  async getById(id: string): Promise<Friendship | null> {
    const record = await (this.prisma as any).friendship.findUnique({
      where: { id },
    });
    if (!record) return null;

    return {
      id: record.id,
      requester_id: record.requesterId,
      addressee_id: record.addresseeId,
      status: record.status as FriendshipStatus,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  async updateStatus(id: string, status: string, actingUserId: string): Promise<Friendship> {
    const existing = await (this.prisma as any).friendship.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new FriendshipNotFoundError();
    }
    if (existing.addresseeId !== actingUserId) {
      throw new FriendshipForbiddenError();
    }

    const record = await (this.prisma as any).friendship.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return {
      id: record.id,
      requester_id: record.requesterId,
      addressee_id: record.addresseeId,
      status: record.status as FriendshipStatus,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await (this.prisma as any).friendship.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new FriendshipNotFoundError();
    }
    if (existing.requesterId !== actingUserId && existing.addresseeId !== actingUserId) {
      throw new FriendshipForbiddenError();
    }

    await (this.prisma as any).friendship.delete({
      where: { id },
    });
  }

  async listFriends(userId: string): Promise<FriendResponse[]> {
    const records = await (this.prisma as any).friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: 'accepted',
      },
      include: {
        requester: true,
        addressee: true,
      },
    });

    return records.map((f: FriendshipWithUsersRow) => {
      const friendUser = f.requesterId === userId ? f.addressee : f.requester;
      return {
        user_id: friendUser.id,
        username: friendUser.username,
        fullname: friendUser.fullname || '',
        status: f.status,
        created_at: f.createdAt,
      };
    });
  }

  async listPendingIncoming(userId: string): Promise<FriendResponse[]> {
    const records = await (this.prisma as any).friendship.findMany({
      where: {
        addresseeId: userId,
        status: 'pending',
      },
      include: {
        requester: true,
      },
    });

    return records.map((f: FriendshipWithRequesterRow) => ({
      user_id: f.requester.id,
      username: f.requester.username,
      fullname: f.requester.fullname || '',
      status: f.status,
      created_at: f.createdAt,
    }));
  }
}
