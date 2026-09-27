import { FriendRepository } from '../../domain/friend/repository.js';

export class RejectFriendService {
  constructor(private readonly friendRepo: FriendRepository) {}

  async execute(id: string, actingUserId: string): Promise<void> {
    await this.friendRepo.delete(id, actingUserId);
  }
}
