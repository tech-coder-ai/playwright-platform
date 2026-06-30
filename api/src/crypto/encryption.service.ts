import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_SALT = 'playwright-platform-secrets';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private keyMaterial = '';

  onModuleInit() {
    this.keyMaterial = process.env['SECRETS_ENCRYPTION_KEY'] ?? '';
    if (!this.keyMaterial) {
      throw new Error('SECRETS_ENCRYPTION_KEY must be set in api/.env');
    }
  }

  encrypt(plaintext: string): string {
    const key = this.deriveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const key = this.deriveKey();
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private deriveKey(): Buffer {
    if (Buffer.byteLength(this.keyMaterial, 'utf8') === 32) {
      return Buffer.from(this.keyMaterial, 'utf8');
    }
    return scryptSync(this.keyMaterial, KEY_SALT, 32);
  }
}
