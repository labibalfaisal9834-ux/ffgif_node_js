import type { Share, ShareByToken, GifTokenResponse, SharedGifResponse, ShareToken } from './entity.js';

export interface ShareRepository {
  create(share: {
    gifKey: string;
    ownerId: string;
    sharedWith: string;
    expiresAt?: Date | null;
  }): Promise<Share>;
  createByToken(share: ShareByToken): Promise<ShareToken>;
  get(userId: string): Promise<SharedGifResponse[]>;
  getByToken(token: string): Promise<GifTokenResponse | null>;
  getOwner(userId: string, key: string): Promise<string | null>;
  delete(key: string, sharedWithId: string): Promise<void>;
}
