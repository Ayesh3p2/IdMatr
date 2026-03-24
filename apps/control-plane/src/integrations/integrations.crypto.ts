import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class IntegrationsCryptoService {
  encryptJson(value: unknown) {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(ciphertext: string): T {
    return JSON.parse(this.decrypt(ciphertext)) as T;
  }

  encrypt(value: string) {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string) {
    const key = this.getKey();
    const [ivEncoded, tagEncoded, payloadEncoded] = ciphertext.split(':');

    if (!ivEncoded || !tagEncoded || !payloadEncoded) {
      throw new BadRequestException('Invalid encrypted payload');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivEncoded, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadEncoded, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private getKey() {
    const source = process.env.DATA_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
    if (!source) {
      throw new InternalServerErrorException('DATA_ENCRYPTION_KEY or JWT_SECRET is required for integration encryption');
    }

    return createHash('sha256').update(source).digest();
  }
}
