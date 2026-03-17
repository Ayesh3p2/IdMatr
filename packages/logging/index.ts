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
