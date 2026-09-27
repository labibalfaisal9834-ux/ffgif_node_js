export interface Profile {
  id: number;
  userId: string;
  profilePic?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quota {
  id: number;
  userId: string;
  usedBytes: bigint;
  totalBytes: bigint;
  gifCount: number;
  gifLimit: number;
}
