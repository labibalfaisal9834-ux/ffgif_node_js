import { DomainError } from '../auth/errors.js';

export class GifNotFoundError extends DomainError {
  constructor() {
    super('gif not found', 'GIF_NOT_FOUND');
  }
}

export class GifOwnerMismatchError extends DomainError {
  constructor() {
    super('Gif Owner mismatch', 'GIF_FORBIDDEN');
  }
}

export class ThumbnailNotFoundError extends DomainError {
  constructor() {
    super('thumbnail not found', 'THUMBNAIL_NOT_FOUND');
  }
}

export class LastVideoNotFoundError extends DomainError {
  constructor() {
    super('last video not found', 'LAST_VIDEO_NOT_FOUND');
  }
}

export class JobNotFoundError extends DomainError {
  constructor() {
    super('job not found', 'JOB_NOT_FOUND');
  }
}

export class InvalidFileExtensionError extends DomainError {
  constructor() {
    super('invalid file type', 'INVALID_FILE_EXTENSION');
  }
}
