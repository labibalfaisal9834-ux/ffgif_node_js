import { DomainError } from '../auth/errors.js';

export class ShareNotFoundError extends DomainError {
  constructor() {
    super('share not found', 'SHARE_NOT_FOUND');
  }
}

export class InvalidShareTokenError extends DomainError {
  constructor() {
    super('invalid or expired share token', 'SHARE_TOKEN_INVALID');
  }
}
