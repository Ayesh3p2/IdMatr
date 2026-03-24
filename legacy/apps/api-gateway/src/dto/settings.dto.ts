import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GeneralSettingsDto {
  @IsOptional()
  @IsString()
  tenantName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

class SecuritySettingsDto {
  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsNumber()
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsNumber()
  passwordMinLength?: number;

  @IsOptional()
  @IsBoolean()
  passwordRequireSpecial?: boolean;

  @IsOptional()
  @IsBoolean()
  ipWhitelistEnabled?: boolean;

  @IsOptional()
  @IsObject()
  ipWhitelist?: Record<string, string>;
}

class RiskSettingsDto {
  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsNumber()
  highThreshold?: number;

  @IsOptional()
  @IsNumber()
  mediumThreshold?: number;

  @IsOptional()
  @IsBoolean()
  autoRemediateEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  riskScoreHistoryDays?: number;
}

class NotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsString()
  emailRecipients?: string;

  @IsOptional()
  @IsBoolean()
  slackEnabled?: boolean;

  @IsOptional()
  @IsString()
  slackWebhook?: string;

  @IsOptional()
  @IsBoolean()
  alertOnCritical?: boolean;

  @IsOptional()
  @IsBoolean()
  alertOnHigh?: boolean;
}

class DiscoverySettingsDto {
  @IsOptional()
  @IsBoolean()
  autoDiscoveryEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  discoveryIntervalHours?: number;

  @IsOptional()
  @IsBoolean()
  googleWorkspaceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  microsoft365Enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  githubEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  slackEnabled?: boolean;
}

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GeneralSettingsDto)
  settings?: GeneralSettingsDto;
}

export class UpdateSecuritySettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  settings?: SecuritySettingsDto;
}

export class UpdateRiskSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RiskSettingsDto)
  settings?: RiskSettingsDto;
}

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  settings?: NotificationSettingsDto;
}

export class UpdateDiscoverySettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscoverySettingsDto)
  settings?: DiscoverySettingsDto;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
