import { randomBytes } from 'crypto';

/** Prisma-compatible cuid-like identifier for JSON/Oracle stores. */
export function newId(): string {
  const time = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `c${time}${random}`;
}
