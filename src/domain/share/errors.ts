import { DomainError } from '../auth/errors.js';

export class ShareNotFoundError extends DomainError {
  constructor() {
    super('share not found', 'SHARE_NOT_FOUND');
  }
}

export class ShareForbiddenError extends DomainError {
  constructor() {
    super('forbidden', 'SHARE_FORBIDDEN');
  }
}

export class InvalidExpiryError extends DomainError {
  constructor() {
    super('expiry must be in the future', 'VALIDATION_FAILED');
  }
}

export class InvalidShareTokenError extends DomainError {
  constructor() {
    super('invalid or expired share token', 'SHARE_NOT_FOUND');
  }
}
