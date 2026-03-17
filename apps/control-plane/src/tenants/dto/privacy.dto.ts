import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PublishPrivacyNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  version: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AcceptPrivacyNoticeDto {
  @IsUUID()
  privacyNoticeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

export class RecordConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  purpose: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lawfulBasis: string;

  @IsOptional()
  @IsIn(['granted', 'revoked'])
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SubjectRectificationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  legalBasis?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  dataCategories?: string[];
}

export class SubjectDeletionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  reason: string;
}

export class TriggerRetentionScanDto {
  @IsOptional()
  @IsBoolean()
  processImmediately?: boolean;
}
