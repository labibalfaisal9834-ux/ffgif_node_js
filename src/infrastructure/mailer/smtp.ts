import nodemailer, { Transporter } from 'nodemailer';
import { Config, getConfig } from '../../config/env.js';

export interface EmailSender {
  sendVerificationToken(email: string, token: string): Promise<void>;
  sendResetPassword(email: string, token: string): Promise<void>;
  sendResetNotification(email: string): Promise<void>;
  sendShareNotification(email: string, token: string): Promise<void>;
}

export function verifyAccountBody(token: string): string {
  const url = `http://127.0.0.1:8080/auth/verify?token=${token}`;
  return `
    <h1>Welcome To FFgif</h1>
    <p>Click the link below to verify your account.</p>
    <button>
      <a href="${url}">Verify my account</a>
    </button>
    <p>This link expires in 30 minutes.</p>
  `;
}

export function sendPasswordResetBody(token: string): string {
  const url = `http://127.0.0.1:8080/auth/reset?token=${token}`;
  return `
    <h1>FFgif Password Reset</h1>
    <p>Click the link below to reset your password.</p>
    <button>
      <a href="${url}">reset password</a>
    </button>
    <p>This link expires in 15 minutes.</p>
  `;
}

export function sendShareBody(token: string): string {
  const url = `http://127.0.0.1:8080/s/${token}`;
  return `
    <h1>FFgif Gif Share</h1>
    <p>Click the link below to download the shared GIF.</p>
    <button>
      <a href="${url}">GIF</a>
    </button>
  `;
}

export class SmtpMailer implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configOverride?: Config['smtp']) {
    const smtpConfig = configOverride || getConfig().smtp;
    this.from = smtpConfig.user;
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
  }

  async sendVerificationToken(email: string, token: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Verify your account',
      html: verifyAccountBody(token),
    });
  }

  async sendResetPassword(email: string, token: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Reset Password',
      html: sendPasswordResetBody(token),
    });
  }

  async sendResetNotification(email: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Reset Password',
      html: `<h1>Alert, your password has been reset</h1>`,
    });
  }

  async sendShareNotification(email: string, token: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Share gif',
      html: sendShareBody(token),
    });
  }
}
