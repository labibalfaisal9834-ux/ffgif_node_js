import { FriendResponse, Friendship } from './entity.js';

export interface FriendRepository {
  create(requesterId: string, addresseeId: string): Promise<Friendship>;
  exists(userA: string, userB: string): Promise<boolean>;
  updateStatus(id: string, status: string, actingUserId: string): Promise<Friendship>;
  delete(id: string, actingUserId: string): Promise<void>;
  listFriends(userId: string): Promise<FriendResponse[]>;
  listPendingIncoming(userId: string): Promise<FriendResponse[]>;
  getById(id: string): Promise<Friendship | null>;
}
