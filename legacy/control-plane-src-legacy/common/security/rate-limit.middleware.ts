import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { LoggerService } from '../logging/logger.service';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  headers?: boolean;
}

export interface RateLimitInfo {
  totalRequests: number;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis;
  private readonly logger: LoggerService;

  constructor(
    @Inject('REDIS_CLIENT') redis: Redis,
    logger: LoggerService
  ) {
    this.redis = redis;
    this.logger = logger;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const options = this.getOptionsForRoute(req);
    const key = this.generateKey(req, options);
    
    this.checkRateLimit(key, options)
      .then((rateLimitInfo) => {
        this.setRateLimitHeaders(res, rateLimitInfo, options);
        
        if (rateLimitInfo.remainingRequests <= 0) {
          this.handleRateLimitExceeded(req, res, rateLimitInfo, options);
        } else {
          next();
        }
      })
      .catch((error) => {
        this.logger.logErrorWithStack('Rate limit check failed', error, {
          key,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        next(); // Allow request if rate limit check fails
      });
  }

  private getOptionsForRoute(req: Request): RateLimitOptions {
    const path = req.path;
    const method = req.method;
    
    // Different rate limits for different routes
    if (path.startsWith('/auth/login')) {
      return {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // 5 login attempts per 15 minutes
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: 'Too many login attempts, please try again later',
        headers: true,
      };
    }
    
    if (path.startsWith('/auth/forgot-password')) {
      return {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3, // 3 password reset attempts per hour
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: 'Too many password reset attempts, please try again later',
        headers: true,
      };
    }
    
    if (path.startsWith('/auth/mfa')) {
      return {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 10, // 10 MFA attempts per 5 minutes
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: 'Too many MFA attempts, please try again later',
        headers: true,
      };
    }
    
    if (path.startsWith('/api/')) {
      return {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000, // 1000 API requests per 15 minutes
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: 'Rate limit exceeded',
        headers: true,
      };
    }
    
    // Default rate limit
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per 15 minutes
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Rate limit exceeded',
      headers: true,
    };
  }

  private generateKey(req: Request, options: RateLimitOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(req);
    }
    
    // Use IP + user ID if authenticated, otherwise just IP
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId;
    
    if (userId && tenantId) {
      return `rate-limit:user:${userId}:tenant:${tenantId}`;
    }
    
    return `rate-limit:ip:${req.ip}`;
  }

  private async checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    try {
      // Remove expired entries
      await this.redis.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      const currentRequests = await this.redis.zcard(key);
      
      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration on the key
      await this.redis.expire(key, Math.ceil(options.windowMs / 1000));
      
      const remainingRequests = Math.max(0, options.maxRequests - currentRequests);
      const resetTime = new Date(now + options.windowMs);
      
      return {
        totalRequests: currentRequests,
        remainingRequests,
        resetTime,
        retryAfter: remainingRequests <= 0 ? Math.ceil(options.windowMs / 1000) : undefined,
      };
    } catch (error) {
      throw error;
    }
  }

  private setRateLimitHeaders(res: Response, rateLimitInfo: RateLimitInfo, options: RateLimitOptions): void {
    if (options.headers) {
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remainingRequests);
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime.getTime() / 1000));
      
      if (rateLimitInfo.retryAfter) {
        res.setHeader('Retry-After', rateLimitInfo.retryAfter);
      }
    }
  }

  private handleRateLimitExceeded(
    req: Request,
    res: Response,
    rateLimitInfo: RateLimitInfo,
    options: RateLimitOptions
  ): void {
    const response = {
      statusCode: 429,
      message: options.message || 'Rate limit exceeded',
      error: 'Too Many Requests',
      retryAfter: rateLimitInfo.retryAfter,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    };

    // Log rate limit exceeded
    this.logger.logSecurityEvent('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenantId,
      totalRequests: rateLimitInfo.totalRequests,
      remainingRequests: rateLimitInfo.remainingRequests,
      retryAfter: rateLimitInfo.retryAfter,
    });

    res.status(429).json(response);
  }
}

// Specialized rate limit middleware for authentication endpoints
@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis;
  private readonly logger: LoggerService;

  constructor(
    @Inject('REDIS_CLIENT') redis: Redis,
    logger: LoggerService
  ) {
    this.redis = redis;
    this.logger = logger;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const key = `auth-rate-limit:${req.ip}`;
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 5; // 5 attempts per 15 minutes
    
    this.checkAuthRateLimit(key, windowMs, maxRequests)
      .then((allowed) => {
        if (!allowed) {
          this.handleAuthRateLimitExceeded(req, res);
        } else {
          next();
        }
      })
      .catch((error) => {
        this.logger.logErrorWithStack('Auth rate limit check failed', error, {
          ip: req.ip,
          path: req.path,
        });
        next();
      });
  }

  private async checkAuthRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
      // Remove expired entries
      await this.redis.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests
      const currentRequests = await this.redis.zcard(key);
      
      if (currentRequests >= maxRequests) {
        return false;
      }
      
      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, Math.ceil(windowMs / 1000));
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  private handleAuthRateLimitExceeded(req: Request, res: Response): void {
    const response = {
      statusCode: 429,
      message: 'Too many authentication attempts, please try again later',
      error: 'Too Many Requests',
      retryAfter: 900, // 15 minutes
      timestamp: new Date().toISOString(),
    };

    this.logger.logSecurityEvent('Authentication rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
    });

    res.status(429).json(response);
  }
}

// IP-based rate limiting for DDoS protection
@Injectable()
export class IpRateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis;
  private readonly logger: LoggerService;

  constructor(
    @Inject('REDIS_CLIENT') redis: Redis,
    logger: LoggerService
  ) {
    this.redis = redis;
    this.logger = logger;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const key = `ip-rate-limit:${req.ip}`;
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 1000; // 1000 requests per minute per IP
    
    this.checkIpRateLimit(key, windowMs, maxRequests)
      .then((allowed) => {
        if (!allowed) {
          this.handleIpRateLimitExceeded(req, res);
        } else {
          next();
        }
      })
      .catch((error) => {
        this.logger.logErrorWithStack('IP rate limit check failed', error, {
          ip: req.ip,
        });
        next();
      });
  }

  private async checkIpRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
      await this.redis.zremrangebyscore(key, 0, windowStart);
      const currentRequests = await this.redis.zcard(key);
      
      if (currentRequests >= maxRequests) {
        return false;
      }
      
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, Math.ceil(windowMs / 1000));
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  private handleIpRateLimitExceeded(req: Request, res: Response): void {
    const response = {
      statusCode: 429,
      message: 'DDoS protection activated - too many requests from your IP',
      error: 'Too Many Requests',
      retryAfter: 60, // 1 minute
      timestamp: new Date().toISOString(),
    };

    this.logger.logSecurityEvent('IP rate limit exceeded - DDoS protection', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
    });

    res.status(429).json(response);
  }
}
