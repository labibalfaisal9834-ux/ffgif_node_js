import { Friendship } from '../../domain/friend/entity.js';
import {
  CannotFriendSelfError,
  FriendshipAlreadyExistsError,
} from '../../domain/friend/errors.js';
import { FriendRepository } from '../../domain/friend/repository.js';

export class SendRequestService {
  constructor(private readonly friendRepo: FriendRepository) {}

  async execute(requesterId: string, addresseeId: string): Promise<Friendship> {
    if (requesterId === addresseeId) {
      throw new CannotFriendSelfError();
    }

    const exists = await this.friendRepo.exists(requesterId, addresseeId);
    if (exists) {
      throw new FriendshipAlreadyExistsError();
    }

    return this.friendRepo.create(requesterId, addresseeId);
  }
}
