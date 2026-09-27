export interface Share {
  id: string;
  gifKey: string;
  ownerId: string;
  sharedWith: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface ShareToken {
  gifKey: string;
  token: string;
  email: string;
  expiresAt?: Date | null;
  createdAt: Date;
}
