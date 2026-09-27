export interface Share {
  id: string;
  gifKey: string;
  ownerId: string;
  sharedWith: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface ShareByToken {
  gifKey: string;
  token: string;
  email: string;
  expiresAt?: Date | null;
  createdAt?: Date;
}

export interface ShareToken {
  gifKey: string;
  token: string;
  email: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface GifTokenResponse {
  gif_key: string;
  name: string;
  url: string;
  thumbnail_url: string;
  expires_at?: Date | null;
  created_at: Date;
}

export interface SharedGifResponse {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string;
  gif_key: string;
  owner_id: string;
  shared_with: string;
  expires_at?: Date | null;
}
