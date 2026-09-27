import { Profile, Quota } from './entity.js';
import { User } from '../auth/entity.js';

export interface ProfileRepository {
  getProfile(userId: string): Promise<Profile | null>;
  setProfile(profile: { userId: string; profilePic?: string }): Promise<Profile>;
  updateProfile(userId: string, profilePic: string, expectedUpdatedAt?: Date): Promise<Profile>;
}

export interface QuotaRepository {
  create(quota: { userId: string; usedBytes?: bigint; totalBytes?: bigint; gifCount?: number; gifLimit?: number }): Promise<Quota>;
  getQuota(userId: string): Promise<Quota | null>;
  incrementGifCount(userId: string, addedBytes: bigint): Promise<void>;
  decrementGifCount(userId: string, freedBytes: bigint): Promise<void>;
}

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  updateProfile(userId: string, fullname: string, expectedUpdatedAt: Date): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  changePassword(userId: string, passwordHash: string): Promise<void>;
}
