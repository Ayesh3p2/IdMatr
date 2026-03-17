import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Encryption Service - handles AES-256-GCM encryption for sensitive data
 * Used for integration credentials, sensitive audit fields, PII
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger('Encryption');
  private readonly algorithm = 'aes-256-gcm';
  private encryptionKey: Buffer;

  constructor() {
    // Get encryption key from env or generate for testing
    const keyEnv = process.env.DATA_ENCRYPTION_KEY;

    if (!keyEnv) {
      throw new Error(
        'DATA_ENCRYPTION_KEY environment variable is required for production. ' +
        'Generate with: openssl rand -base64 32'
      );
    }

    this.encryptionKey = Buffer.from(keyEnv, 'base64');

    if (this.encryptionKey.length !== 32) {
      throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (256 bits)');
    }

    this.logger.log('Encryption service initialized with AES-256-GCM');
  }

  /**
   * Encrypt a string value
   * Returns base64-encoded string: "base64(iv):base64(authTag):base64(encrypted)"
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(12);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return combined format: iv:authTag:encrypted (all base64)
      return [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted,
      ].join(':');
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt an encrypted value
   * Expects format: "base64(iv):base64(authTag):base64(encrypted)"
   */
  decrypt(encryptedData: string): string {
    try {
      const [ivB64, authTagB64, encryptedHex] = encryptedData.split(':');

      if (!ivB64 || !authTagB64 || !encryptedHex) {
        throw new Error('Invalid encrypted data format');
      }

      // Decode components
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Decryption failed - possibly corrupted or tampered data');
    }
  }

  /**
   * Encrypt JSON object
   */
  encryptObject(obj: Record<string, any>): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to JSON object
   */
  decryptObject<T = Record<string, any>>(encrypted: string): T {
    const plaintext = this.decrypt(encrypted);
    return JSON.parse(plaintext);
  }

  /**
   * Hash sensitive value (one-way, for comparison)
   * Used for API keys, webhook signatures
   */
  hash(value: string): string {
    return crypto
      .createHash('sha256')
      .update(value + process.env.HASH_SALT || '')
      .digest('hex');
  }

  /**
   * Mask sensitive value for logging
   * Shows first 4 and last 4 chars only
   */
  mask(value: string, visibleChars: number = 4): string {
    if (value.length <= visibleChars * 2) {
      return '••••••••';
    }
    return (
      value.substring(0, visibleChars) +
      '••••••••' +
      value.substring(value.length - visibleChars)
    );
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate random password meeting security requirements
   * - 16+ chars
   * - uppercase, lowercase, numbers, symbols
   */
  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
