import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function leftPad(value: string, length: number, padChar = '0') {
  return value.length >= length ? value : `${padChar.repeat(length - value.length)}${value}`;
}

function decodeBase32(secret: string): Buffer {
  const normalized = secret.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid TOTP secret');
    }
    bits += leftPad(idx.toString(2), 5);
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function encodeBase32(buffer: Buffer) {
  let bits = '';
  for (const byte of buffer.values()) {
    bits += leftPad(byte.toString(2), 8);
  }

  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (!chunk) continue;
    output += BASE32_ALPHABET[parseInt(leftPad(chunk, 5), 2)];
  }

  return output;
}

export function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function buildTotpOtpAuthUrl(label: string, secret: string, issuer = 'IDMatr') {
  const safeLabel = encodeURIComponent(label);
  const safeIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${safeIssuer}:${safeLabel}?secret=${secret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function generateCounterBuffer(counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  return buffer;
}

function generateTotpCode(secret: string, epochMs = Date.now(), stepSeconds = 30) {
  const key = decodeBase32(secret);
  const counter = Math.floor(epochMs / 1000 / stepSeconds);
  const hmac = crypto.createHmac('sha1', key).update(generateCounterBuffer(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);

  return leftPad((code % 1_000_000).toString(), 6);
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  const now = Date.now();
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotpCode(secret, now + offset * 30_000);
    if (candidate === code) {
      return true;
    }
  }

  return false;
}
