import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ─── Supported compliance frameworks ─────────────────────────────────────────
export const SUPPORTED_FRAMEWORKS = ['SOC2', 'ISO27001', 'PCI-DSS', 'GDPR', 'HIPAA', 'NIST', 'CIS'] as const;
export type ComplianceFramework = typeof SUPPORTED_FRAMEWORKS[number];

// ─── Create Tenant ────────────────────────────────────────────────────────────

export class CreateTenantDto {
  /** Display name — required */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** URL-safe slug — auto-generated from name if omitted */
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(3, 48)
  slug?: string;

  /**
   * Admin email — REQUIRED.
   * A Tenant Super Admin will be provisioned at this address.
   */
  @IsEmail()
  adminEmail: string;

  /**
   * Compliance frameworks — at least ONE required.
   * Supported: SOC2 | ISO27001 | PCI-DSS | GDPR | HIPAA | NIST | CIS
  */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsIn(SUPPORTED_FRAMEWORKS as unknown as string[], { each: true })
  frameworks: string[];

  /** Primary domain: acme.com */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  /** Billing plan: starter | pro | enterprise */
  @IsOptional()
  @IsIn(['starter', 'pro', 'enterprise'])
  plan?: string;

  /** Deployment region */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  region?: string;
}

// ─── Update Tenant ────────────────────────────────────────────────────────────

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsIn(['starter', 'pro', 'enterprise'])
  plan?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'TRIAL', 'PENDING', 'OFFBOARDED', 'DELETED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  suspendReason?: string;
}

// ─── Update Tenant Settings ───────────────────────────────────────────────────

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  idpType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idpDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idpClientId?: string;

  @IsOptional()
  @IsBoolean()
  ssoEnforced?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskScoreThreshold?: number;

  @IsOptional()
  @IsBoolean()
  riskAutoRemediation?: boolean;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  riskAlertEmails?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  discoverySchedule?: string;

  @IsOptional()
  @IsBoolean()
  discoveryEnabled?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  alertWebhookUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  slackWebhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(SUPPORTED_FRAMEWORKS as unknown as string[], { each: true })
  frameworks?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  dataResidency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  dataRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  deletionGraceDays?: number;

  @IsOptional()
  @IsBoolean()
  itdrEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  graphEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  aiInsightsEnabled?: boolean;
}

// ─── Integration ──────────────────────────────────────────────────────────────

export class UpsertIntegrationDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  configJson?: string;
}

// ─── API Key ──────────────────────────────────────────────────────────────────

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
