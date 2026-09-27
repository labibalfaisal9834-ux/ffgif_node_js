import { FriendResponse } from '../../domain/friend/entity.js';
import { FriendRepository } from '../../domain/friend/repository.js';

export class ListFriendsService {
  constructor(private readonly friendRepo: FriendRepository) {}

  async execute(userId: string): Promise<FriendResponse[]> {
    return this.friendRepo.listFriends(userId);
  }
}
