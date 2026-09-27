import { Gif, GifResponse, LastUpload, LastUploadResponse } from './entity.js';

export interface GifUpdateRequest {
  name?: string;
  status?: string;
  persist?: boolean;
  isPublic?: boolean;
}

export interface GifRepository {
  create(gif: Omit<Gif, 'createdAt' | 'updatedAt'>): Promise<void>;
  get(userId: string, status?: string, limit?: number, offset?: number): Promise<GifResponse[]>;
  getByKey(key: string, forUpdate?: boolean): Promise<GifResponse | null>;
  getRecents(userId: string): Promise<GifResponse[]>;
  delete(key: string): Promise<void>;
  update(key: string, req: GifUpdateRequest): Promise<GifResponse>;
  saveRecent(key: string): Promise<void>;
  getOwner(key: string): Promise<string | null>;
  incrementDownload(key: string): Promise<void>;
}

export interface LastVideoRepository {
  create(upload: Omit<LastUpload, 'id' | 'uploadedAt' | 'updatedAt' | 'deletedAt'>): Promise<void>;
  getLastVideo(userId: string): Promise<LastUploadResponse | null>;
}
