export interface Gif {
  key: string;
  name?: string | null;
  userId: string;
  status: string;
  persist: boolean;
  download: number;
  fileSizeBytes: bigint;
  width: number;
  height: number;
  durationSeconds: number;
  isPublic: boolean;
  url: string;
  thumbnailKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GifResponse {
  key: string;
  name: string;
  status: string;
  persist: boolean;
  url: string;
  thumbnail_url: string;
  download: number;
  file_size_bytes: number;
  width: number;
  height: number;
  duration_seconds: number;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LastUpload {
  id: number;
  userId: string;
  fileKey: string;
  fileName?: string | null;
  contentType: string;
  sizeBytes?: bigint | null;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  uploadedAt: Date;
  deletedAt?: Date | null;
  updatedAt: Date;
}

export interface LastUploadResponse {
  user_id: string;
  key: string;
  filename: string;
  content_type: string;
  size_bytes?: number;
  duration_sec?: number;
  uploaded_at: Date;
  thumbnail_url?: string;
}

export interface Job {
  id: string;
  userId: string;
  type: string;
  status: string;
  progress: number;
  errorMessage?: string | null;
  resultKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
