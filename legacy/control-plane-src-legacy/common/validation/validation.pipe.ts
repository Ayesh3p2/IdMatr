import { ValidationPipe as NestValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted values are provided
      transform: true, // Transform payloads to be objects typed according to their DTO classes
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types
      },
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const errors = validationErrors.map(error => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        
        return {
          statusCode: 400,
          message: 'Validation failed',
          errors,
        };
      },
    });
  }
}
