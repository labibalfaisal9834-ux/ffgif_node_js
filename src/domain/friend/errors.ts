import { DomainError } from '../auth/errors.js';

export class FriendshipNotFoundError extends DomainError {
  constructor(message = 'friendship request not found') {
    super(message, 'FRIENDSHIP_NOT_FOUND');
  }
}

export class FriendshipAlreadyExistsError extends DomainError {
  constructor() {
    super('friendship already exists', 'FRIENDSHIP_ALREADY_EXISTS');
  }
}

export class CannotFriendSelfError extends DomainError {
  constructor() {
    super('cannot send a friend request to yourself', 'VALIDATION_FAILED');
  }
}

export class FriendshipForbiddenError extends DomainError {
  constructor() {
    super('forbidden', 'FRIENDSHIP_FORBIDDEN');
  }
}
