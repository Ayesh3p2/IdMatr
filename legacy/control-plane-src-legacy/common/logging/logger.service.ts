import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;
  private readonly context: string;

  constructor(context?: string) {
    this.context = context || 'Application';
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, correlationId, userId, tenantId, requestId, userAgent, ip, method, url, statusCode, responseTime, error, metadata, ...meta }) => {
        const logEntry: any = {
          timestamp,
          level,
          message,
          context: this.context,
          correlationId,
          userId,
          tenantId,
          requestId,
          userAgent,
          ip,
          method,
          url,
          statusCode,
          responseTime,
          metadata,
          ...meta,
        };

        if (error) {
          logEntry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
          };
        }

        return JSON.stringify(logEntry);
      })
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ];

    // Add file transports in production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: logFormat,
        }),
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          format: logFormat,
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || LogLevel.INFO,
      format: logFormat,
      transports,
      exitOnError: false,
    });
  }

  log(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, { ...context, error });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  verbose(message: string, context?: LogContext): void {
    this.logger.verbose(message, context);
  }

  // Structured logging methods
  logRequest(req: Request, res: any, responseTime: number): void {
    const context: LogContext = {
      correlationId: req.headers['x-correlation-id'] as string,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenantId,
      requestId: req.headers['x-request-id'] as string,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
    };

    const message = `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
    
    if (res.statusCode >= 400) {
      this.error(message, undefined, context);
    } else {
      this.log(message, context);
    }
  }

  logSecurityEvent(event: string, context: LogContext): void {
    this.warn(`SECURITY: ${event}`, {
      ...context,
      category: 'security',
      severity: 'high',
    });
  }

  logAuditEvent(action: string, resource: string, context: LogContext): void {
    this.log(`AUDIT: ${action} on ${resource}`, {
      ...context,
      category: 'audit',
      severity: 'medium',
    });
  }

  logPerformance(operation: string, duration: number, context: LogContext): void {
    const message = `PERFORMANCE: ${operation} took ${duration}ms`;
    
    if (duration > 1000) {
      this.warn(message, { ...context, category: 'performance', severity: 'medium' });
    } else {
      this.debug(message, { ...context, category: 'performance' });
    }
  }

  logBusinessEvent(event: string, context: LogContext): void {
    this.log(`BUSINESS: ${event}`, {
      ...context,
      category: 'business',
      severity: 'low',
    });
  }

  // Health check logging
  logHealthCheck(service: string, status: 'healthy' | 'unhealthy', context?: LogContext): void {
    const message = `HEALTH: ${service} is ${status}`;
    
    if (status === 'unhealthy') {
      this.error(message, undefined, { ...context, category: 'health', severity: 'high' });
    } else {
      this.debug(message, { ...context, category: 'health', severity: 'low' });
    }
  }

  // Error logging with stack trace
  logErrorWithStack(message: string, error: Error, context?: LogContext): void {
    this.error(message, error, {
      ...context,
      category: 'error',
      severity: 'critical',
    });
  }

  // Get logger instance for external use
  getLogger(): winston.Logger {
    return this.logger;
  }

  // Create child logger with additional context
  child(context: Record<string, any>): LoggerService {
    const childLogger = new LoggerService(this.context);
    childLogger.logger.defaultMeta = {
      ...childLogger.logger.defaultMeta,
      ...context,
    };
    return childLogger;
  }
}
