export class DomainError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super('user not found', 'AUTH_USER_NOT_FOUND');
  }
}

export class InvalidCredentialError extends DomainError {
  constructor() {
    super('invalid credential', 'AUTH_INVALID_CREDENTIALS');
  }
}

export class UserNotVerifiedError extends DomainError {
  constructor() {
    super('user not verified', 'AUTH_USER_NOT_VERIFIED');
  }
}

export class UserAlreadyVerifiedError extends DomainError {
  constructor() {
    super('user already verified', 'AUTH_USER_ALREADY_VERIFIED');
  }
}

export class UserExistsError extends DomainError {
  constructor() {
    super('user already exists', 'AUTH_USER_EXISTS');
  }
}

export class UserCreateFailedError extends DomainError {
  constructor(msg?: string) {
    super(msg || 'user create failed', 'AUTH_USER_CREATE_FAILED');
  }
}

export class VerifierTokenCreateFailedError extends DomainError {
  constructor() {
    super('verifier token create failed', 'AUTH_VERIFIER_CREATE_FAILED');
  }
}

export class InvalidTokenError extends DomainError {
  constructor() {
    super('invalid token', 'AUTH_VERIFY_TOKEN_INVALID');
  }
}

export class ResetTokenFetchFailedError extends DomainError {
  constructor() {
    super('reset token fetch failed', 'AUTH_RESET_TOKEN_INVALID');
  }
}

export class CreateResetTokenFailedError extends DomainError {
  constructor() {
    super('reset token create failed', 'AUTH_RESET_TOKEN_CREATE_FAILED');
  }
}

export class SetProfileFailedError extends DomainError {
  constructor() {
    super('set profile failed', 'SET_PROFILE_FAILED');
  }
}

export class QuotaCreateFailedError extends DomainError {
  constructor() {
    super('quota create failed', 'QUOTA_CREATE_FAILED');
  }
}

export class TokenFetchFailedError extends DomainError {
  constructor() {
    super('token fetch failed', 'TOKEN_FETCH_FAILED');
  }
}
