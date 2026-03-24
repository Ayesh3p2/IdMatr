import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

type EnvelopePayload = {
  version: 1;
  wrappedKey: string;
  wrappedKeyIv: string;
  wrappedKeyTag: string;
  dataIv: string;
  dataTag: string;
  ciphertext: string;
};

@Injectable()
export class EnvelopeEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const masterKey = process.env.DATA_ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error('DATA_ENCRYPTION_KEY env var is required');
    }

    this.key = Buffer.from(masterKey, 'base64');
    if (this.key.length !== 32) {
      throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes');
    }
  }

  encryptString(value: string): string {
    const dataKey = crypto.randomBytes(32);
    const dataIv = crypto.randomBytes(12);
    const dataCipher = crypto.createCipheriv('aes-256-gcm', dataKey, dataIv);
    const ciphertext = Buffer.concat([dataCipher.update(value, 'utf8'), dataCipher.final()]);
    const dataTag = dataCipher.getAuthTag();

    const wrapIv = crypto.randomBytes(12);
    const wrapCipher = crypto.createCipheriv('aes-256-gcm', this.key, wrapIv);
    const wrappedKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
    const wrappedKeyTag = wrapCipher.getAuthTag();

    const payload: EnvelopePayload = {
      version: 1,
      wrappedKey: wrappedKey.toString('base64'),
      wrappedKeyIv: wrapIv.toString('base64'),
      wrappedKeyTag: wrappedKeyTag.toString('base64'),
      dataIv: dataIv.toString('base64'),
      dataTag: dataTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };

    return JSON.stringify(payload);
  }

  decryptString(payloadRaw: string): string {
    const payload = JSON.parse(payloadRaw) as EnvelopePayload;
    const wrappedKeyIv = Buffer.from(payload.wrappedKeyIv, 'base64');
    const wrappedKeyTag = Buffer.from(payload.wrappedKeyTag, 'base64');
    const wrappedKey = Buffer.from(payload.wrappedKey, 'base64');
    const dataIv = Buffer.from(payload.dataIv, 'base64');
    const dataTag = Buffer.from(payload.dataTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const unwrapCipher = crypto.createDecipheriv('aes-256-gcm', this.key, wrappedKeyIv);
    unwrapCipher.setAuthTag(wrappedKeyTag);
    const dataKey = Buffer.concat([unwrapCipher.update(wrappedKey), unwrapCipher.final()]);

    const dataCipher = crypto.createDecipheriv('aes-256-gcm', dataKey, dataIv);
    dataCipher.setAuthTag(dataTag);
    return Buffer.concat([dataCipher.update(ciphertext), dataCipher.final()]).toString('utf8');
  }

  encryptObject(value: Record<string, any>) {
    return this.encryptString(JSON.stringify(value));
  }

  decryptObject<T = Record<string, any>>(payload: string): T {
    return JSON.parse(this.decryptString(payload)) as T;
  }
}
