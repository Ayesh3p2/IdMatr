import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Apply helmet for security headers
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permissionsPolicy: {
        features: {
          geolocation: ['none'],
          microphone: ['none'],
          camera: ['none'],
          payment: ['none'],
          usb: ['none'],
          accelerometer: ['none'],
          gyroscope: ['none'],
          magnetometer: ['none'],
        },
      },
    })(req, res, next);

    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Remove server signature
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    // Add CORS headers if not already set
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
    }
    
    if (!res.getHeader('Access-Control-Allow-Methods')) {
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    }
    
    if (!res.getHeader('Access-Control-Allow-Headers')) {
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Correlation-ID, X-Request-ID');
    }
    
    if (!res.getHeader('Access-Control-Allow-Credentials')) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(200).end();
      return;
    }

    // Log security-relevant requests
    this.logSecurityRequest(req);

    next();
  }

  private logSecurityRequest(req: Request): void {
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS attempt
      /union.*select/i,  // SQL injection attempt
      /javascript:/i,  // JavaScript protocol
      /data:text/i,  // Data URI
    ];

    const url = req.url;
    const userAgent = req.headers['user-agent'] || '';
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(url) || pattern.test(userAgent)
    );

    if (isSuspicious) {
      this.logger.logSecurityEvent('Suspicious request detected', {
        ip: req.ip,
        userAgent,
        url: req.url,
        method: req.method,
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date().toISOString(),
      });
    }
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers from logs
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    delete sanitized['x-auth-token'];
    
    return sanitized;
  }
}

// CSRF protection middleware
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }

    // Check for CSRF token
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionToken = req.headers['x-session-token'] as string;

    if (!csrfToken || !sessionToken) {
      this.handleCsrfError(req, res, 'Missing CSRF token');
      return;
    }

    // Validate CSRF token (simplified - implement proper validation)
    if (!this.validateCsrfToken(csrfToken, sessionToken)) {
      this.handleCsrfError(req, res, 'Invalid CSRF token');
      return;
    }

    next();
  }

  private validateCsrfToken(csrfToken: string, sessionToken: string): boolean {
    // Implement proper CSRF token validation
    // This is a placeholder - implement secure token validation
    return csrfToken && sessionToken && csrfToken.length > 0;
  }

  private handleCsrfError(req: Request, res: Response, message: string): void {
    this.logger.logSecurityEvent('CSRF protection triggered', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      url: req.url,
      method: req.method,
      message,
    });

    res.status(403).json({
      statusCode: 403,
      message: 'CSRF protection failed',
      error: 'Forbidden',
      timestamp: new Date().toISOString(),
    });
  }
}

// Input sanitization middleware
@Injectable()
export class InputSanitizationMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = this.sanitizeObject(req.params);
    }

    next();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(str: string): string {
    // Remove potentially dangerous characters
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
      .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, '')
      .trim();
  }
}

// Request size limiting middleware
@Injectable()
export class RequestSizeLimitMiddleware implements NestMiddleware {
  private readonly maxRequestSize: number;
  private readonly logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.maxRequestSize = 10 * 1024 * 1024; // 10MB
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > this.maxRequestSize) {
      this.logger.logSecurityEvent('Request size limit exceeded', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method,
        contentLength,
        maxRequestSize: this.maxRequestSize,
      });

      res.status(413).json({
        statusCode: 413,
        message: 'Request entity too large',
        error: 'Payload Too Large',
        maxSize: this.maxRequestSize,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }
}

// IP whitelist/blacklist middleware
@Injectable()
export class IpFilterMiddleware implements NestMiddleware {
  private readonly whitelist: string[];
  private readonly blacklist: string[];
  private readonly logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.whitelist = (process.env.IP_WHITELIST || '').split(',').filter(Boolean);
    this.blacklist = (process.env.IP_BLACKLIST || '').split(',').filter(Boolean);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const clientIp = req.ip;

    // Check blacklist first
    if (this.blacklist.length > 0 && this.blacklist.includes(clientIp)) {
      this.logger.logSecurityEvent('Blacklisted IP access attempt', {
        ip: clientIp,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method,
      });

      res.status(403).json({
        statusCode: 403,
        message: 'Access denied',
        error: 'Forbidden',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check whitelist if configured
    if (this.whitelist.length > 0 && !this.whitelist.includes(clientIp)) {
      this.logger.logSecurityEvent('Non-whitelisted IP access attempt', {
        ip: clientIp,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method,
      });

      res.status(403).json({
        statusCode: 403,
        message: 'Access denied',
        error: 'Forbidden',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }
}
