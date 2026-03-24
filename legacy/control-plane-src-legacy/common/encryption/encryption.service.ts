import { Injectable } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 32;

  async encrypt(text: string): Promise<{ encrypted: string; key: string }> {
    const salt = randomBytes(this.saltLength);
    const key = await this.deriveKey(salt);
    const iv = randomBytes(this.ivLength);
    
    const cipher = createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return {
      encrypted: combined.toString('base64'),
      key: salt.toString('base64') // Store salt as key for decryption
    };
  }

  async decrypt(encryptedData: string, key: string): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64');
    const salt = combined.slice(0, this.saltLength);
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
    const tag = combined.slice(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength
    );
    const encrypted = combined.slice(
      this.saltLength + this.ivLength + this.tagLength
    );
    
    const derivedKey = await this.deriveKey(salt);
    
    const decipher = createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async deriveKey(salt: Buffer): Promise<Buffer> {
    const password = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    
    return new Promise((resolve, reject) => {
      scrypt(password, salt, this.keyLength, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  generateKey(): string {
    return randomBytes(this.saltLength).toString('base64');
  }
}
