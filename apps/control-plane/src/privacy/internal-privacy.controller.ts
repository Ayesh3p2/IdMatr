import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PrivacyService } from './privacy.service.js';
import {
  AcceptPrivacyNoticeDto,
  RecordConsentDto,
  SubjectDeletionDto,
  SubjectRectificationDto,
} from '../tenants/dto/privacy.dto.js';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

class InternalTenantSubjectDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  tenantUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

class InternalAcceptNoticeDto extends InternalTenantSubjectDto {
  @IsUUID()
  privacyNoticeId: string;
}

@Controller('internal/privacy')
export class InternalPrivacyController {
  private readonly internalSecret: string;

  constructor(private readonly privacy: PrivacyService) {
    if (!process.env.INTERNAL_API_SECRET) {
      throw new Error('INTERNAL_API_SECRET env var is required');
    }
    this.internalSecret = process.env.INTERNAL_API_SECRET;
  }

  private guardSecret(secret: string | undefined) {
    if (!secret || secret !== this.internalSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }
  }

  @Post('notice/active')
  @HttpCode(200)
  getActiveNotice(@Headers('x-internal-secret') secret: string, @Body() body: { tenantId?: string }) {
    this.guardSecret(secret);
    return this.privacy.getActiveNotice(body.tenantId || null);
  }

  @Post('notice/accept')
  @HttpCode(200)
  acceptNotice(@Headers('x-internal-secret') secret: string, @Body() body: InternalAcceptNoticeDto) {
    this.guardSecret(secret);
    return this.privacy.acceptNotice(body.tenantId, body.tenantUserId, body.privacyNoticeId, body.ipAddress, body.userAgent);
  }

  @Post('consent')
  @HttpCode(200)
  recordConsent(
    @Headers('x-internal-secret') secret: string,
    @Body() body: InternalTenantSubjectDto & RecordConsentDto,
  ) {
    this.guardSecret(secret);
    const { tenantId, tenantUserId, ipAddress, userAgent, ...dto } = body;
    return this.privacy.recordConsent(tenantId, tenantUserId, dto, ipAddress, userAgent);
  }

  @Post('consents')
  @HttpCode(200)
  listConsents(@Headers('x-internal-secret') secret: string, @Body() body: InternalTenantSubjectDto) {
    this.guardSecret(secret);
    return this.privacy.listConsents(body.tenantId, body.tenantUserId);
  }

  @Post('subject/export')
  @HttpCode(200)
  exportSubject(@Headers('x-internal-secret') secret: string, @Body() body: InternalTenantSubjectDto) {
    this.guardSecret(secret);
    return this.privacy.exportSubjectData(body.tenantId, body.tenantUserId);
  }

  @Post('subject/rectify')
  @HttpCode(200)
  rectifySubject(
    @Headers('x-internal-secret') secret: string,
    @Body() body: InternalTenantSubjectDto & SubjectRectificationDto,
  ) {
    this.guardSecret(secret);
    const { tenantId, tenantUserId, ipAddress, userAgent, ...dto } = body;
    return this.privacy.rectifySubjectData(tenantId, tenantUserId, dto, ipAddress, userAgent);
  }

  @Post('subject/delete')
  @HttpCode(200)
  deleteSubject(
    @Headers('x-internal-secret') secret: string,
    @Body() body: InternalTenantSubjectDto & SubjectDeletionDto,
  ) {
    this.guardSecret(secret);
    return this.privacy.requestSubjectDeletion(body.tenantId, body.tenantUserId, body, body.ipAddress, body.userAgent);
  }
}
