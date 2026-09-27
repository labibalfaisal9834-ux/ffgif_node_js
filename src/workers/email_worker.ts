import amqplib from 'amqplib';
import { RabbitMQClient, EmailMessage } from '../infrastructure/rabbitmq/client.js';
import { QUEUES } from '../infrastructure/rabbitmq/constants.js';
import { EmailSender } from '../infrastructure/mailer/smtp.js';

export function getRetryCount(headers?: Record<string, any>): number {
  if (!headers || !headers['x-death']) return 0;
  const death = headers['x-death'];
  if (Array.isArray(death) && death.length > 0) {
    return Number(death[0]?.count || 0);
  }
  return 0;
}

export class EmailWorker {
  private readonly maxRetries = 3;

  constructor(
    private readonly rabbitmq: RabbitMQClient,
    private readonly mailer: EmailSender
  ) {}

  async run(name = 'email-worker', concurrency = 10): Promise<void> {
    console.log(`[EmailWorker] Started with concurrency ${concurrency}`);
    await this.rabbitmq.consume(QUEUES.EMAIL, name, concurrency, async (msg, ch) => {
      await this.handle(msg, ch);
    });
  }

  async handle(d: amqplib.ConsumeMessage, ch: amqplib.Channel): Promise<void> {
    let msg: EmailMessage;
    try {
      msg = JSON.parse(d.content.toString()) as EmailMessage;
    } catch (err) {
      console.error('[EmailWorker] Invalid email message JSON:', err);
      ch.nack(d, false, false);
      return;
    }

    console.log(`[EmailWorker] Processing email type=${msg.name} to=${msg.to}`);

    try {
      switch (msg.name) {
        case 'signup':
          await this.mailer.sendVerificationToken(msg.to, msg.token);
          break;
        case 'forgot-password':
          await this.mailer.sendResetPassword(msg.to, msg.token);
          break;
        case 'resend-verify':
          await this.mailer.sendVerificationToken(msg.to, msg.token);
          break;
        case 'reset-password':
          await this.mailer.sendResetNotification(msg.to);
          break;
        case 'share':
          await this.mailer.sendShareNotification(msg.to, msg.token);
          break;
        default:
          console.error(`[EmailWorker] Unknown email job type=${msg.name} to=${msg.to}`);
          ch.nack(d, false, false);
          return;
      }

      ch.ack(d, false);
      console.log(`[EmailWorker] Email processed successfully to=${msg.to}`);
    } catch (err) {
      console.error(`[EmailWorker] Email sending failed:`, err);
      const retries = getRetryCount(d.properties.headers);
      if (retries < this.maxRetries) {
        ch.nack(d, false, true);
      } else {
        ch.nack(d, false, false);
      }
    }
  }
}
