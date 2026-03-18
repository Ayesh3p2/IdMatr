import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', HttpStatus.NOT_FOUND, details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', HttpStatus.BAD_REQUEST, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', HttpStatus.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', HttpStatus.CONFLICT, details);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: unknown) {
    super(message, 'INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR, details);
    this.name = 'InternalServerError';
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof AppError) {
      status = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      status = exception.getStatus();
      code = 'HTTP_EXCEPTION';
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;

      if (typeof exceptionResponse === 'object') {
        details = (exceptionResponse as any).error || (exceptionResponse as any).details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
