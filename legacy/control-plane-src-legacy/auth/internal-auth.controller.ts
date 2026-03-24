import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthService } from './auth.service.js';

class ValidateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  totpCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

class ChangePasswordDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  newPassword: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  newPassword: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

class TenantUserIdDto {
  @IsUUID()
  userId: string;
}

class TenantMfaDto extends TenantUserIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  code: string;
}

@Controller('internal/auth')
export class InternalAuthController {
  private readonly internalSecret: string;

  constructor(private readonly authService: AuthService) {
    if (!process.env.INTERNAL_API_SECRET) {
      throw new Error('INTERNAL_API_SECRET env var is required');
    }
    this.internalSecret = process.env.INTERNAL_API_SECRET;
  }

  private guardSecret(secret: string | undefined): void {
    if (!secret || secret !== this.internalSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }
  }

  @Post('validate-user')
  @HttpCode(200)
  async validateUser(
    @Headers('x-internal-secret') secret: string,
    @Body() body: ValidateUserDto,
  ) {
    this.guardSecret(secret);

    if (!body.email || !body.password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const user = await this.authService.validateTenantUser(body);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Headers('x-internal-secret') secret: string,
    @Body() body: ChangePasswordDto,
  ) {
    this.guardSecret(secret);

    if (!body.userId || !body.currentPassword || !body.newPassword) {
      throw new UnauthorizedException('userId, currentPassword, and newPassword are required');
    }

    return this.authService.changeTenantUserPassword(
      body.userId,
      body.currentPassword,
      body.newPassword,
      body.ipAddress,
      body.userAgent,
    );
  }

  @Post('complete-onboarding')
  @HttpCode(200)
  async completeOnboarding(
    @Headers('x-internal-secret') secret: string,
    @Body() body: CompleteOnboardingDto,
  ) {
    this.guardSecret(secret);

    if (!body.token || !body.newPassword) {
      throw new UnauthorizedException('token and newPassword are required');
    }

    return this.authService.completeOnboarding(
      body.token,
      body.newPassword,
      body.ipAddress,
      body.userAgent,
    );
  }

  @Post('tenant-mfa/setup')
  @HttpCode(200)
  async setupTenantMfa(
    @Headers('x-internal-secret') secret: string,
    @Body() body: TenantUserIdDto,
  ) {
    this.guardSecret(secret);
    return this.authService.createTenantMfaSetup(body.userId);
  }

  @Post('tenant-mfa/enable')
  @HttpCode(200)
  async enableTenantMfa(
    @Headers('x-internal-secret') secret: string,
    @Body() body: TenantMfaDto,
  ) {
    this.guardSecret(secret);
    return this.authService.enableTenantMfa(body.userId, body.code);
  }

  @Post('tenant-mfa/disable')
  @HttpCode(200)
  async disableTenantMfa(
    @Headers('x-internal-secret') secret: string,
    @Body() body: TenantMfaDto,
  ) {
    this.guardSecret(secret);
    return this.authService.disableTenantMfa(body.userId, body.code);
  }

  @Post('tenant-mfa/status')
  @HttpCode(200)
  async getTenantMfaStatus(
    @Headers('x-internal-secret') secret: string,
    @Body() body: TenantUserIdDto,
  ) {
    this.guardSecret(secret);
    return this.authService.getTenantMfaStatus(body.userId);
  }
}
