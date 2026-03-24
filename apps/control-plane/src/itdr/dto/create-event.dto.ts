import { EventSeverity } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  action!: string;

  @IsString()
  resource!: string;

  @IsOptional()
  @IsEnum(EventSeverity)
  severity?: EventSeverity;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
