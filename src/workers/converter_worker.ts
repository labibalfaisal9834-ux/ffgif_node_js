import amqplib from 'amqplib';
import { RabbitMQClient } from '../infrastructure/rabbitmq/client.js';
import { QUEUES } from '../infrastructure/rabbitmq/constants.js';
import { RunConversionService, VideoMessagePayload } from '../application/media/run_conversion.service.js';
import { getRetryCount } from './email_worker.js';

export class ConverterWorker {
  private readonly maxRetries = 2;

  constructor(
    private readonly rabbitmq: RabbitMQClient,
    private readonly conversionService: RunConversionService
  ) {}

  async run(name = 'convert-worker', concurrency = 2): Promise<void> {
    console.log(`[ConverterWorker] Started with concurrency ${concurrency}`);
    await this.rabbitmq.consume(QUEUES.PROCESS, name, concurrency, async (msg, ch) => {
      await this.handle(msg, ch);
    });
  }

  async handle(d: amqplib.ConsumeMessage, ch: amqplib.Channel): Promise<void> {
    let msg: VideoMessagePayload;
    try {
      msg = JSON.parse(d.content.toString()) as VideoMessagePayload;
    } catch (err) {
      console.error('[ConverterWorker] Invalid video message JSON:', err);
      ch.nack(d, false, false);
      return;
    }

    console.log(`[ConverterWorker] Converting video key=${msg.key} user_id=${msg.user_id} job_id=${msg.job_id}`);

    try {
      await this.conversionService.execute(msg);
      ch.ack(d, false);
      console.log(`[ConverterWorker] Video converted successfully job_id=${msg.job_id}`);
    } catch (err) {
      console.error(`[ConverterWorker] Video conversion failed job_id=${msg.job_id}:`, err);
      const retries = getRetryCount(d.properties.headers);
      if (retries < this.maxRetries) {
        ch.nack(d, false, true);
      } else {
        ch.nack(d, false, false);
      }
    }
  }
}
