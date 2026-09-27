import { GifRepository } from '../../domain/media/repository.js';
import { GifResponse } from '../../domain/media/entity.js';

export class GetRecentsService {
  constructor(private readonly gifRepo: GifRepository) {}

  async execute(userId: string): Promise<GifResponse[]> {
    return this.gifRepo.getRecents(userId);
  }
}
