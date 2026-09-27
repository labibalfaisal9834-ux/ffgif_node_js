import amqplib from 'amqplib';
import { QUEUES } from './constants.js';
import { setupRabbitMQTopology } from './setup.js';
import { getConfig, Config } from '../../config/env.js';

export interface EmailMessage {
  to: string;
  name: string;
  token: string;
}

export interface VideoMessage {
  user_id: string;
  job_id: string;
  upload_key: string;
  start_time: number;
  end_time: number;
  width: number;
  fps: number;
  loop: boolean;
  retries?: number;
}

export interface SaveVideoMessage {
  key: string;
  user_id: string;
  filename: string;
  retries?: number;
}

export class RabbitMQClient {
  private connection: amqplib.ChannelModel | null = null;
  private consumerChannels: Map<string, amqplib.Channel> = new Map();

  constructor(private readonly rmqConfig?: Config['rabbitmq']) {}

  async connect(): Promise<amqplib.ChannelModel> {
    if (this.connection) {
      return this.connection;
    }

    const cnf = this.rmqConfig || getConfig().rabbitmq;
    try {
      this.connection = await amqplib.connect(cnf.url);
      console.log('[RabbitMQ] Connection complete');

      // Run topology setup
      const setupChannel = await this.connection.createChannel();
      try {
        await setupRabbitMQTopology(setupChannel);
      } finally {
        await setupChannel.close();
      }

      return this.connection;
    } catch (err) {
      throw new Error(`[RabbitMQ Panic] Failed to connect to RabbitMQ at ${cnf.addr}: ${(err as Error).message}`);
    }
  }

  async publish(queue: string, payload: unknown): Promise<void> {
    const conn = await this.connect();
    const ch = await conn.createChannel();
    try {
      const content = Buffer.from(JSON.stringify(payload));
      ch.sendToQueue(queue, content, {
        contentType: 'application/json',
        persistent: true,
        timestamp: Date.now(),
      });
      console.log(`[RabbitMQ] publish() message published to ${queue}`);
    } finally {
      await ch.close();
    }
  }

  async publishEmail(msg: EmailMessage): Promise<void> {
    return this.publish(QUEUES.EMAIL, msg);
  }

  async publishVideo(msg: VideoMessage): Promise<void> {
    return this.publish(QUEUES.PROCESS, msg);
  }

  async publishSaveVideo(msg: SaveVideoMessage): Promise<void> {
    return this.publish(QUEUES.SAVE, msg);
  }

  async publishRetrySaveVideo(msg: SaveVideoMessage): Promise<void> {
    return this.publish(QUEUES.SAVE_RETRY, msg);
  }

  async consume(
    queue: string,
    consumerName: string,
    concurrency: number,
    onMessage: (msg: amqplib.ConsumeMessage, channel: amqplib.Channel) => Promise<void>
  ): Promise<void> {
    const conn = await this.connect();
    const ch = await conn.createChannel();
    this.consumerChannels.set(consumerName, ch);

    await ch.prefetch(concurrency);

    await ch.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          await onMessage(msg, ch);
        } catch (err) {
          console.error(`[RabbitMQ] Error processing message on ${queue}:`, err);
        }
      },
      { noAck: false }
    );
  }

  async closeConsumerChannel(name: string): Promise<void> {
    const ch = this.consumerChannels.get(name);
    if (ch) {
      await ch.close();
      this.consumerChannels.delete(name);
    }
  }

  async close(): Promise<void> {
    for (const [, ch] of this.consumerChannels) {
      try {
        await ch.close();
      } catch (_) {}
    }
    this.consumerChannels.clear();

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}

let rabbitMQInstance: RabbitMQClient | null = null;

export function getRabbitMQClient(): RabbitMQClient {
  if (!rabbitMQInstance) {
    rabbitMQInstance = new RabbitMQClient();
  }
  return rabbitMQInstance;
}
