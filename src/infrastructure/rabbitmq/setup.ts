import amqplib from 'amqplib';
import { QUEUES, getDeadQueue } from './constants.js';
import { Config, getConfig } from '../../config/env.js';

export async function setupRabbitMQTopology(
  channel: amqplib.Channel,
  minioConfig?: Config['minio']
): Promise<void> {
  const cnf = minioConfig || getConfig().minio;

  // 1. Email Queue + Dead Queue
  await channel.assertQueue(getDeadQueue(QUEUES.EMAIL), {
    durable: true,
    autoDelete: false,
    exclusive: false,
  });

  await channel.assertQueue(QUEUES.EMAIL, {
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': getDeadQueue(QUEUES.EMAIL),
    },
  });

  // 2. Process Queue + Dead Queue
  await channel.assertQueue(getDeadQueue(QUEUES.PROCESS), {
    durable: true,
    autoDelete: false,
    exclusive: false,
  });

  await channel.assertQueue(QUEUES.PROCESS, {
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': getDeadQueue(QUEUES.PROCESS),
    },
  });

  // 3. Save Queue + Dead Queue
  await channel.assertQueue(getDeadQueue(QUEUES.SAVE), {
    durable: true,
    autoDelete: false,
    exclusive: false,
  });

  await channel.assertQueue(QUEUES.SAVE, {
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': getDeadQueue(QUEUES.SAVE),
    },
  });

  // 4. Save Retry Queue (1000ms TTL dead-letter back to SaveQueue) + Dead Queue
  await channel.assertQueue(getDeadQueue(QUEUES.SAVE_RETRY), {
    durable: true,
    autoDelete: false,
    exclusive: false,
  });

  await channel.assertQueue(QUEUES.SAVE_RETRY, {
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: {
      'x-message-ttl': 1000,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': QUEUES.SAVE,
    },
  });

  // 5. Upload Process Queue (Bound to Fanout Exchange) + Dead Queue
  await channel.assertExchange(cnf.exchangeQueue, 'fanout', {
    durable: true,
    autoDelete: false,
  });

  await channel.assertQueue(getDeadQueue(QUEUES.UPLOAD_PROCESS), {
    durable: true,
    autoDelete: false,
    exclusive: false,
  });

  const uploadQueue = await channel.assertQueue(QUEUES.UPLOAD_PROCESS, {
    durable: true,
    autoDelete: false,
    exclusive: false,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': getDeadQueue(QUEUES.UPLOAD_PROCESS),
    },
  });

  await channel.bindQueue(uploadQueue.queue, cnf.exchangeQueue, '');

  console.log('[RabbitMQ] RabbitMQ topology setup complete');
}
