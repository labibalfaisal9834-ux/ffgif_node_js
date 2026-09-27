import { LastVideoRepository } from '../../domain/media/repository.js';
import { LastUploadResponse } from '../../domain/media/entity.js';
import { LastVideoNotFoundError } from '../../domain/media/errors.js';

export class LastVideoService {
  constructor(private readonly lastVideoRepo: LastVideoRepository) {}

  async execute(userId: string): Promise<LastUploadResponse> {
    const lastVideo = await this.lastVideoRepo.getLastVideo(userId);
    if (!lastVideo) {
      throw new LastVideoNotFoundError();
    }
    return lastVideo;
  }
}
