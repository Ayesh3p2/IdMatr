import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    
    // Generate correlation ID if not present
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    
    // Add correlation ID to headers for downstream services
    req.headers['x-correlation-id'] = correlationId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);

    // Store correlation ID in request for later use
    (req as any).correlationId = correlationId;
    (req as any).requestId = requestId;

    // Log incoming request
    this.logger.log('Incoming request', {
      correlationId,
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenantId,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      const responseTime = Date.now() - startTime;
      
      // Log response
      this.logger.logRequest(req, res, responseTime);
      
      // Call original end
      originalEnd.apply(this, args);
    }.bind(res);

    next();
  }
}
