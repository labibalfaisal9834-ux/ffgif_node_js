import amqplib from 'amqplib';
import { RabbitMQClient } from '../infrastructure/rabbitmq/client.js';
import { QUEUES } from '../infrastructure/rabbitmq/constants.js';
import { SaveMetadataService, SaveVideoMessagePayload } from '../application/media/save_metadata.service.js';
import { getRetryCount } from './email_worker.js';

export class SaveMetadataWorker {
  private readonly maxRetries = 3;

  constructor(
    private readonly rabbitmq: RabbitMQClient,
    private readonly saveMetadataService: SaveMetadataService
  ) {}

  async run(name = 'save-worker', concurrency = 5): Promise<void> {
    console.log(`[SaveMetadataWorker] Started with concurrency ${concurrency}`);
    await this.rabbitmq.consume(QUEUES.SAVE, name, concurrency, async (msg, ch) => {
      await this.handle(msg, ch);
    });
  }

  async handle(d: amqplib.ConsumeMessage, ch: amqplib.Channel): Promise<void> {
    let msg: SaveVideoMessagePayload;
    try {
      msg = JSON.parse(d.content.toString()) as SaveVideoMessagePayload;
    } catch (err) {
      console.error('[SaveMetadataWorker] Invalid save video message JSON:', err);
      ch.nack(d, false, false);
      return;
    }

    try {
      await this.saveMetadataService.execute(msg);
      ch.ack(d, false);
      console.log(`[SaveMetadataWorker] Video metadata saved key=${msg.key} user_id=${msg.user_id}`);
    } catch (err) {
      console.error(`[SaveMetadataWorker] Save metadata failed key=${msg.key} user_id=${msg.user_id}:`, err);
      const retries = getRetryCount(d.properties.headers);
      if (retries < this.maxRetries) {
        ch.nack(d, false, true);
      } else {
        ch.nack(d, false, false);
      }
    }
  }
}
