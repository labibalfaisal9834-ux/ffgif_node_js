import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export function getTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): { token: string; tokenHash: string } {
  const token = uuidv4();
  const tokenHash = getTokenHash(token);
  return { token, tokenHash };
}
