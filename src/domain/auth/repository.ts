import { User, Verifier, Reseter } from './entity.js';

export interface AuthRepository {
  getByEmail(email: string): Promise<User | null>;
  getById(id: string): Promise<User | null>;
  create(user: {
    username: string;
    fullname?: string;
    email: string;
    passwordHash: string;
    role?: string;
    isVerified?: boolean;
    deletedAt?: Date | null;
  }): Promise<User>;
  deleteById(id: string): Promise<void>;
  deleteByEmail(email: string): Promise<void>;
  updatePassword(id: string, passHash: string): Promise<void>;
  setVerified(userId: string): Promise<void>;
  upgrade(id: string, user: Partial<User>): Promise<User>;
}

export interface VerifierRepository {
  create(verifier: { userId: string; tokenHash: string; expireAt?: Date }): Promise<Verifier>;
  getByHash(tokenHash: string): Promise<Verifier | null>;
  getById(userId: string): Promise<Verifier | null>;
  delete(id: number): Promise<void>;
}

export interface ReseterRepository {
  getById(userId: string): Promise<Reseter | null>;
  create(reseter: { userId: string; tokenHash: string; expireAt?: Date }): Promise<Reseter>;
  getByToken(tokenHash: string): Promise<Reseter | null>;
  deleteById(id: number): Promise<void>;
}
