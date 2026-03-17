import { Logger as NestLogger, LoggerService as NestLoggerService } from '@nestjs/common';
import { utilities as nestWinstonModuleUtilities, WinstonModule, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as Transport from 'winston-transport';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const consoleFormat = printf(({ level, message, context, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  const contextStr = context ? `[${context}] ` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${timestamp} ${level}: ${contextStr}${message}${stackStr}${metaString ? `\n${metaString}` : ''}`;
});

const jsonFormat = printf(({ level, message, context, timestamp, stack, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    context,
    message,
    stack,
    ...meta,
  });
});

const transports: Transport[] = [
  new winston.transports.Console({
    format: isProduction ? json() : combine(colorize({ all: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
    level: isProduction ? 'info' : 'debug',
  }),
];

if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), jsonFormat, errors({ stack: true })),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), jsonFormat),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
}

export const winstonConfig: WinstonModuleOptions = {
  transports,
  exitOnError: false,
};

export const createWinstonLogger = (context: string): winston.Logger => {
  return winston.createLogger({
    ...winstonConfig,
    defaultMeta: { context, service: process.env.SERVICE_NAME || 'idmatr' },
  });
};

export class AppLogger implements NestLoggerService {
  private readonly logger: winston.Logger;
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
    this.logger = createWinstonLogger(context);
  }

  log(message: string, ...args: unknown[]): void {
    this.logger.info(message, { args: args.length ? args : undefined });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context: context || this.context });
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, { args: args.length ? args : undefined });
  }

  debug(message: string, ...args: unknown[]): void {
    if (!isProduction) {
      this.logger.debug(message, { args: args.length ? args : undefined });
    }
  }

  verbose(message: string, ...args: unknown[]): void {
    this.logger.verbose(message, { args: args.length ? args : undefined });
  }
}

export const createLogger = (context: string): NestLoggerService => {
  if (isTest) {
    return new NestLogger(context);
  }
  return new AppLogger(context);
};

export const auditLog = (logger: NestLoggerService, action: string, details: Record<string, unknown>): void => {
  logger.log(`AUDIT [${action}]`, { action, ...details });
};

export const createAuditLogger = (service: string): winston.Logger => {
  return winston.createLogger({
    ...winstonConfig,
    defaultMeta: { service, type: 'audit' },
    transports: [
      new winston.transports.File({
        filename: 'logs/audit.log',
        format: combine(timestamp(), jsonFormat),
        maxsize: 50 * 1024 * 1024,
        maxFiles: 30,
      }),
    ],
  });
};

export { WinstonModule, nestWinstonModuleUtilities, winston };

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'secret',
  'apiKey',
  'api_key',
  'apikey',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'token',
  'jwt',
  'authorization',
  'Authorization',
  'credentials',
  'privateKey',
  'private_key',
  'publicKey',
  'public_key',
  'certificate',
  'cert',
  'key',
  'clientSecret',
  'client_secret',
  'sessionId',
  'session_id',
  'ssn',
  'socialSecurity',
  'creditCard',
  'credit_card',
];

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9\-_.~+/]+=*/gi,
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
  /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

export const sanitizeLogObject = (obj: Record<string, unknown>): Record<string, unknown> => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogObject(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

const sanitizeString = (value: string): string => {
  let sanitized = value;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
};

export const sanitizeForLogging = (...args: unknown[]): unknown[] => {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeLogObject(arg as Record<string, unknown>);
    }
    if (typeof arg === 'string') {
      return sanitizeString(arg);
    }
    return arg;
  });
};
