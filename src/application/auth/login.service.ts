import { AuthRepository } from '../../domain/auth/repository.js';
import { User } from '../../domain/auth/entity.js';
import { InvalidCredentialError, UserNotVerifiedError } from '../../domain/auth/errors.js';
import { PasswordHasher } from './password_hasher.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: User;
}

export class LoginService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.authRepo.getByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialError();
    }

    if (!user.isVerified) {
      throw new UserNotVerifiedError();
    }

    const isMatch = await this.hasher.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new InvalidCredentialError();
    }

    return { user };
  }
}
