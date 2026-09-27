import { Friendship } from '../../domain/friend/entity.js';
import { FriendRepository } from '../../domain/friend/repository.js';

export class AcceptFriendService {
  constructor(private readonly friendRepo: FriendRepository) {}

  async execute(id: string, actingUserId: string): Promise<Friendship> {
    return this.friendRepo.updateStatus(id, 'accepted', actingUserId);
  }
}
