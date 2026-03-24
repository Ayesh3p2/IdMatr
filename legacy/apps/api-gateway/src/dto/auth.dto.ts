import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class TenantLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantSlug?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  totpCode?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  newPassword: string;
}

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  newPassword: string;
}

export class MfaCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  code: string;
}

export class AcceptPrivacyNoticeDto {
  @IsUUID()
  privacyNoticeId: string;
}

export class PrivacyConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  purpose: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lawfulBasis: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  status?: string;
}

export class RectifyPrivacyDto {
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

export class DeletePrivacyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  reason: string;
}
