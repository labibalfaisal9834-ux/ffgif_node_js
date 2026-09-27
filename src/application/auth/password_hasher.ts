import bcrypt from 'bcrypt';
import { getConfig } from '../../config/env.js';

export class PasswordHasher {
  private readonly pepper: string;
  private readonly cost: number;

  constructor(pepper?: string, cost?: number) {
    const cnf = getConfig();
    this.pepper = pepper ?? cnf.hashPepper;
    this.cost = cost ?? cnf.bcryptCost;
  }

  async hash(password: string): Promise<string> {
    const salted = password + this.pepper;
    return bcrypt.hash(salted, this.cost);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    const salted = password + this.pepper;
    return bcrypt.compare(salted, hash);
  }
}
