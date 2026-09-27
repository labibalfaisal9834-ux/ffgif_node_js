import { DomainError } from '../auth/errors.js';

export class QuotaExceededError extends DomainError {
  constructor(message = 'storage quota exceeded') {
    super(message, 'QUOTA_EXCEEDED');
  }
}

export class PreconditionFailedError extends DomainError {
  constructor(message = 'precondition failed: resource modified') {
    super(message, 'PRECONDITION_FAILED');
  }
}
