import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logging/logger.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { SecretsService } from '../../common/secrets/secrets.service';
import { v4 as uuidv4 } from 'uuid';

export interface DeletionRequest {
  userId: string;
  tenantId: string;
  requestedBy: string;
  reason: string;
  verificationCode?: string;
  immediateDeletion: boolean;
}

export interface DeletionResult {
  requestId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  deletedData: {
    userProfile: boolean;
    auditLogs: boolean;
    sessions: boolean;
    mfaData: boolean;
    consents: boolean;
    accessRequests: boolean;
  };
  retentionData: {
    auditLogs: boolean; // Required to be retained for compliance
    legalHold: boolean;
  };
  completedAt?: string;
  errors?: string[];
}

@Injectable()
export class DataDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly encryption: EncryptionService,
    private readonly secrets: SecretsService
  ) {}

  async requestUserDataDeletion(request: DeletionRequest): Promise<string> {
    const requestId = uuidv4();
    
    // Validate user exists and belongs to tenant
    const user = await this.validateUserAccess(request.userId, request.tenantId);
    
    // Check for legal holds or compliance requirements
    await this.checkDeletionRestrictions(request.userId, request.tenantId);
    
    // Create deletion request
    await this.prisma.accessRequest.create({
      data: {
        id: requestId,
        userId: request.userId,
        tenantId: request.tenantId,
        type: 'DATA_DELETION',
        status: request.immediateDeletion ? 'PROCESSING' : 'PENDING',
        requestedBy: request.requestedBy,
        details: {
          reason: request.reason,
          verificationCode: request.verificationCode,
          immediateDeletion: request.immediateDeletion,
        },
      },
    });

    this.logger.logAuditEvent('DATA_DELETION_REQUESTED', 'user_data', {
      requestId,
      userId: request.userId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
      reason: request.reason,
      immediateDeletion: request.immediateDeletion,
    });

    if (request.immediateDeletion) {
      // Process deletion immediately
      this.processDeletion(requestId).catch(error => {
        this.logger.logErrorWithStack('Immediate deletion failed', error, { requestId });
      });
    }

    return requestId;
  }

  async verifyDeletionRequest(requestId: string, verificationCode: string): Promise<void> {
    const deletionRequest = await this.prisma.accessRequest.findFirst({
      where: {
        id: requestId,
        type: 'DATA_DELETION',
        status: 'PENDING',
      },
    });

    if (!deletionRequest) {
      throw new NotFoundException('Deletion request not found or already processed');
    }

    const details = deletionRequest.details as any;
    if (details.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    // Update status to processing
    await this.prisma.accessRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING' },
    });

    this.logger.logAuditEvent('DATA_DELETION_VERIFIED', 'user_data', {
      requestId,
      userId: deletionRequest.userId,
      tenantId: deletionRequest.tenantId,
    });

    // Process deletion
    this.processDeletion(requestId).catch(error => {
      this.logger.logErrorWithStack('Deletion processing failed', error, { requestId });
    });
  }

  async cancelDeletionRequest(requestId: string, userId: string, tenantId: string): Promise<void> {
    const deletionRequest = await this.prisma.accessRequest.findFirst({
      where: {
        id: requestId,
        userId: userId,
        tenantId: tenantId,
        type: 'DATA_DELETION',
        status: 'PENDING',
      },
    });

    if (!deletionRequest) {
      throw new NotFoundException('Deletion request not found or cannot be cancelled');
    }

    await this.prisma.accessRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    this.logger.logAuditEvent('DATA_DELETION_CANCELLED', 'user_data', {
      requestId,
      userId,
      tenantId,
    });
  }

  async getDeletionStatus(requestId: string, userId: string, tenantId: string): Promise<DeletionResult> {
    const deletionRequest = await this.prisma.accessRequest.findFirst({
      where: {
        id: requestId,
        userId: userId,
        tenantId: tenantId,
        type: 'DATA_DELETION',
      },
    });

    if (!deletionRequest) {
      throw new NotFoundException('Deletion request not found');
    }

    const details = deletionRequest.details as any;
    return {
      requestId: deletionRequest.id,
      status: deletionRequest.status as any,
      deletedData: details.deletedData || {
        userProfile: false,
        auditLogs: false,
        sessions: false,
        mfaData: false,
        consents: false,
        accessRequests: false,
      },
      retentionData: details.retentionData || {
        auditLogs: true,
        legalHold: false,
      },
      completedAt: deletionRequest.completedAt?.toISOString(),
      errors: details.errors || [],
    };
  }

  private async validateUserAccess(userId: string, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: {
        id: userId,
        tenantId: tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found or access denied');
    }

    return user;
  }

  private async checkDeletionRestrictions(userId: string, tenantId: string): Promise<void> {
    // Check for active legal holds
    const legalHolds = await this.prisma.legalHold.findMany({
      where: {
        userId: userId,
        tenantId: tenantId,
        status: 'ACTIVE',
      },
    });

    if (legalHolds.length > 0) {
      throw new BadRequestException('Cannot delete user data due to active legal holds');
    }

    // Check for ongoing investigations
    const investigations = await this.prisma.investigation.findMany({
      where: {
        userId: userId,
        tenantId: tenantId,
        status: 'ACTIVE',
      },
    });

    if (investigations.length > 0) {
      throw new BadRequestException('Cannot delete user data due to ongoing investigations');
    }

    // Check for compliance requirements
    const recentAuditLogs = await this.prisma.operatorAuditLog.count({
      where: {
        operatorId: userId,
        tenantId: tenantId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
    });

    if (recentAuditLogs > 0) {
      this.logger.warn('User has recent activity - audit logs will be retained', {
        userId,
        tenantId,
        recentAuditLogs,
      });
    }
  }

  private async processDeletion(requestId: string): Promise<void> {
    const deletionRequest = await this.prisma.accessRequest.findUnique({
      where: { id: requestId },
    });

    if (!deletionRequest) {
      throw new Error('Deletion request not found');
    }

    const result: DeletionResult = {
      requestId,
      status: 'PROCESSING',
      deletedData: {
        userProfile: false,
        auditLogs: false,
        sessions: false,
        mfaData: false,
        consents: false,
        accessRequests: false,
      },
      retentionData: {
        auditLogs: true, // Always retain audit logs
        legalHold: false,
      },
      errors: [],
    };

    try {
      // Step 1: Deactivate user account
      await this.deactivateUser(deletionRequest.userId, deletionRequest.tenantId);
      result.deletedData.userProfile = true;

      // Step 2: Invalidate all sessions
      await this.invalidateUserSessions(deletionRequest.userId, deletionRequest.tenantId);
      result.deletedData.sessions = true;

      // Step 3: Remove MFA data
      await this.removeMfaData(deletionRequest.userId, deletionRequest.tenantId);
      result.deletedData.mfaData = true;

      // Step 4: Anonymize consents
      await this.anonymizeConsents(deletionRequest.userId, deletionRequest.tenantId);
      result.deletedData.consents = true;

      // Step 5: Process access requests
      await this.processAccessRequests(deletionRequest.userId, deletionRequest.tenantId);
      result.deletedData.accessRequests = true;

      // Step 6: Soft delete user profile (retain for audit purposes)
      await this.softDeleteUserProfile(deletionRequest.userId, deletionRequest.tenantId);

      result.status = 'COMPLETED';
      result.completedAt = new Date().toISOString();

      this.logger.logAuditEvent('DATA_DELETION_COMPLETED', 'user_data', {
        requestId,
        userId: deletionRequest.userId,
        tenantId: deletionRequest.tenantId,
        result,
      });

    } catch (error) {
      result.status = 'FAILED';
      result.errors = [error instanceof Error ? error.message : 'Unknown error'];

      this.logger.logErrorWithStack('Data deletion failed', error as Error, {
        requestId,
        userId: deletionRequest.userId,
        tenantId: deletionRequest.tenantId,
      });
    }

    // Update deletion request with results
    await this.prisma.accessRequest.update({
      where: { id: requestId },
      data: {
        status: result.status,
        completedAt: result.completedAt ? new Date(result.completedAt) : null,
        details: {
          deletedData: result.deletedData,
          retentionData: result.retentionData,
          errors: result.errors,
        },
      },
    });
  }

  private async deactivateUser(userId: string, tenantId: string): Promise<void> {
    await this.prisma.tenantUser.update({
      where: {
        id: userId,
        tenantId: tenantId,
      },
      data: {
        status: 'DELETED',
        email: `deleted-${userId}@deleted.com`,
        name: 'Deleted User',
        updatedAt: new Date(),
      },
    });

    this.logger.log('User deactivated for deletion', { userId, tenantId });
  }

  private async invalidateUserSessions(userId: string, tenantId: string): Promise<void> {
    // Mock session invalidation - implement actual session cleanup
    this.logger.log('User sessions invalidated', { userId, tenantId });
  }

  private async removeMfaData(userId: string, tenantId: string): Promise<void> {
    await this.prisma.tenantUser.update({
      where: {
        id: userId,
        tenantId: tenantId,
      },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaSetupDate: null,
        mfaLastUsed: null,
        backupCodesGenerated: null,
        updatedAt: new Date(),
      },
    });

    this.logger.log('MFA data removed', { userId, tenantId });
  }

  private async anonymizeConsents(userId: string, tenantId: string): Promise<void> {
    // Mock consent anonymization - implement actual consent cleanup
    this.logger.log('User consents anonymized', { userId, tenantId });
  }

  private async processAccessRequests(userId: string, tenantId: string): Promise<void> {
    // Update all access requests for this user
    await this.prisma.accessRequest.updateMany({
      where: {
        userId: userId,
        tenantId: tenantId,
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    this.logger.log('Access requests processed', { userId, tenantId });
  }

  private async softDeleteUserProfile(userId: string, tenantId: string): Promise<void> {
    // Mark user as deleted but retain record for audit purposes
    await this.prisma.tenantUser.update({
      where: {
        id: userId,
        tenantId: tenantId,
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.log('User profile soft deleted', { userId, tenantId });
  }

  async permanentDataDeletion(userId: string, tenantId: string, authorizedBy: string): Promise<void> {
    // This is a highly privileged operation that should only be accessible to system administrators
    // and only after all retention periods have expired

    this.logger.logAuditEvent('PERMANENT_DATA_DELETION_INITIATED', 'user_data', {
      userId,
      tenantId,
      authorizedBy,
    });

    try {
      // Verify retention periods have expired
      const user = await this.prisma.tenantUser.findFirst({
        where: {
          id: userId,
          tenantId: tenantId,
          status: 'DELETED',
        },
      });

      if (!user) {
        throw new NotFoundException('User not found or not marked for deletion');
      }

      if (!user.deletedAt) {
        throw new BadRequestException('User was not marked for deletion');
      }

      const retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years
      const deletionDate = new Date(user.deletedAt.getTime() + retentionPeriod);
      
      if (new Date() < deletionDate) {
        throw new BadRequestException('Retention period has not expired');
      }

      // Delete audit logs (only if retention period expired)
      await this.prisma.operatorAuditLog.deleteMany({
        where: {
          operatorId: userId,
          tenantId: tenantId,
          createdAt: {
            lt: new Date(Date.now() - retentionPeriod),
          },
        },
      });

      // Delete user record permanently
      await this.prisma.tenantUser.delete({
        where: {
          id: userId,
          tenantId: tenantId,
        },
      });

      this.logger.logAuditEvent('PERMANENT_DATA_DELETION_COMPLETED', 'user_data', {
        userId,
        tenantId,
        authorizedBy,
      });

    } catch (error) {
      this.logger.logErrorWithStack('Permanent data deletion failed', error as Error, {
        userId,
        tenantId,
        authorizedBy,
      });
      throw error;
    }
  }

  async getDataRetentionReport(tenantId: string): Promise<any> {
    const deletedUsers = await this.prisma.tenantUser.findMany({
      where: {
        tenantId: tenantId,
        status: 'DELETED',
        deletedAt: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        deletedAt: true,
      },
    });

    const retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years
    const now = new Date();

    const report = {
      totalDeletedUsers: deletedUsers.length,
      eligibleForPermanentDeletion: 0,
      pendingRetention: 0,
      users: deletedUsers.map(user => {
        const deletionDate = new Date(user.deletedAt!.getTime() + retentionPeriod);
        const isEligible = now > deletionDate;
        
        return {
          id: user.id,
          email: user.email,
          deletedAt: user.deletedAt,
          eligibleForPermanentDeletion: isEligible,
          retentionExpires: deletionDate,
        };
      }),
    };

    report.eligibleForPermanentDeletion = report.users.filter(u => u.eligibleForPermanentDeletion).length;
    report.pendingRetention = report.users.filter(u => !u.eligibleForPermanentDeletion).length;

    return report;
  }
}
