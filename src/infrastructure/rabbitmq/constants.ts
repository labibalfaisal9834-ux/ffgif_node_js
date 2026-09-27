export const QUEUES = {
  EMAIL: 'email.queue',
  PROCESS: 'process.queue',
  SAVE: 'video.save.queue',
  SAVE_RETRY: 'save.retry.queue',
  UPLOAD_PROCESS: 'process.upload.queue',
} as const;

export function getDeadQueue(queue: string): string {
  return `${queue}.dead`;
}
