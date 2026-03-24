import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logging/logger.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { zip } from 'zip-a-folder';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UserDataExport {
  userId: string;
  tenantId: string;
  personalData: {
    profile: {
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      lastLoginAt?: string;
    };
    auditLogs: Array<{
      id: string;
      action: string;
      resource: string;
      timestamp: string;
      ipAddress: string;
      userAgent: string;
      details: any;
    }>;
    sessions: Array<{
      id: string;
      createdAt: string;
      expiresAt: string;
      ipAddress: string;
      userAgent: string;
      isActive: boolean;
    }>;
    mfaData: {
      enabled: boolean;
      setupDate?: string;
      lastUsed?: string;
      backupCodesGenerated?: string;
    };
    consents: Array<{
      id: string;
      type: string;
      status: 'GRANTED' | 'REVOKED';
      grantedAt: string;
      revokedAt?: string;
      version: string;
    }>;
    accessRequests: Array<{
      id: string;
      type: string;
      status: string;
      requestedAt: string;
      completedAt?: string;
      details: any;
    }>;
  };
  metadata: {
    exportId: string;
    exportedAt: string;
    format: 'JSON';
    version: '1.0';
    tenantId: string;
    dataRetentionPeriod: string;
  };
}

export interface ExportRequest {
  userId: string;
  tenantId: string;
  requestedBy: string;
  format: 'JSON' | 'CSV' | 'PDF';
  includeAuditLogs: boolean;
  includeSessions: boolean;
  includeConsents: boolean;
}

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly encryption: EncryptionService
  ) {}

  async exportUserData(request: ExportRequest): Promise<string> {
    const exportId = uuidv4();
    const exportPath = path.join(process.env.TEMP_DIR || '/tmp', `gdpr-export-${exportId}`);

    try {
      this.logger.logAuditEvent('DATA_EXPORT_REQUESTED', 'user_data', {
        userId: request.userId,
        tenantId: request.tenantId,
        requestedBy: request.requestedBy,
        exportId,
      });

      // Verify user exists and belongs to tenant
      const user = await this.validateUserAccess(request.userId, request.tenantId);
      
      // Collect user data
      const userData = await this.collectUserData(user, request);
      
      // Create export directory
      await fs.mkdir(exportPath, { recursive: true });
      
      // Generate export files
      await this.generateExportFiles(userData, exportPath, request.format);
      
      // Create ZIP archive
      const zipPath = `${exportPath}.zip`;
      await zip(exportPath, zipPath);
      
      // Clean up temporary directory
      await fs.rmdir(exportPath, { recursive: true });
      
      // Log successful export
      this.logger.logAuditEvent('DATA_EXPORT_COMPLETED', 'user_data', {
        userId: request.userId,
        tenantId: request.tenantId,
        exportId,
        format: request.format,
        filePath: zipPath,
      });

      return zipPath;
    } catch (error) {
      this.logger.logErrorWithStack('Data export failed', error as Error, {
        userId: request.userId,
        tenantId: request.tenantId,
        exportId,
      });

      // Clean up on error
      try {
        await fs.rmdir(exportPath, { recursive: true });
        await fs.unlink(`${exportPath}.zip`);
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup export files', { exportId });
      }

      throw new Error(`Data export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportUserDataJson(userId: string, tenantId: string): Promise<UserDataExport> {
    const user = await this.validateUserAccess(userId, tenantId);
    return this.collectUserData(user, {
      userId,
      tenantId,
      requestedBy: userId,
      format: 'JSON',
      includeAuditLogs: true,
      includeSessions: true,
      includeConsents: true,
    });
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

  private async collectUserData(user: any, request: ExportRequest): Promise<UserDataExport> {
    const exportId = uuidv4();
    
    // Collect basic profile data
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
    };

    // Collect audit logs
    let auditLogs = [];
    if (request.includeAuditLogs) {
      const logs = await this.prisma.operatorAuditLog.findMany({
        where: {
          operatorId: user.id,
          tenantId: user.tenantId,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000, // Limit to last 1000 entries
      });

      auditLogs = logs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        timestamp: log.createdAt.toISOString(),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details,
      }));
    }

    // Collect session data
    let sessions = [];
    if (request.includeSessions) {
      // Mock session data - implement actual session collection
      sessions = [];
    }

    // Collect MFA data
    const mfaData = {
      enabled: user.mfaEnabled || false,
      setupDate: user.mfaSetupDate?.toISOString(),
      lastUsed: user.mfaLastUsed?.toISOString(),
      backupCodesGenerated: user.backupCodesGenerated?.toISOString(),
    };

    // Collect consent data
    let consents = [];
    if (request.includeConsents) {
      // Mock consent data - implement actual consent collection
      consents = [];
    }

    // Collect access requests
    const accessRequests = [];
    // Mock access requests - implement actual access request collection

    return {
      userId: user.id,
      tenantId: user.tenantId,
      personalData: {
        profile,
        auditLogs,
        sessions,
        mfaData,
        consents,
        accessRequests,
      },
      metadata: {
        exportId,
        exportedAt: new Date().toISOString(),
        format: 'JSON',
        version: '1.0',
        tenantId: user.tenantId,
        dataRetentionPeriod: '7 years',
      },
    };
  }

  private async generateExportFiles(userData: UserDataExport, exportPath: string, format: string): Promise<void> {
    switch (format) {
      case 'JSON':
        await this.generateJsonExport(userData, exportPath);
        break;
      case 'CSV':
        await this.generateCsvExport(userData, exportPath);
        break;
      case 'PDF':
        await this.generatePdfExport(userData, exportPath);
        break;
      default:
        throw new BadRequestException(`Unsupported export format: ${format}`);
    }
  }

  private async generateJsonExport(userData: UserDataExport, exportPath: string): Promise<void> {
    const jsonFile = path.join(exportPath, 'user-data.json');
    await fs.writeFile(jsonFile, JSON.stringify(userData, null, 2));
    
    // Generate separate files for each data type
    await fs.writeFile(
      path.join(exportPath, 'profile.json'),
      JSON.stringify(userData.personalData.profile, null, 2)
    );
    
    await fs.writeFile(
      path.join(exportPath, 'audit-logs.json'),
      JSON.stringify(userData.personalData.auditLogs, null, 2)
    );
    
    await fs.writeFile(
      path.join(exportPath, 'sessions.json'),
      JSON.stringify(userData.personalData.sessions, null, 2)
    );
    
    await fs.writeFile(
      path.join(exportPath, 'mfa-data.json'),
      JSON.stringify(userData.personalData.mfaData, null, 2)
    );
    
    await fs.writeFile(
      path.join(exportPath, 'consents.json'),
      JSON.stringify(userData.personalData.consents, null, 2)
    );
    
    await fs.writeFile(
      path.join(exportPath, 'metadata.json'),
      JSON.stringify(userData.metadata, null, 2)
    );
  }

  private async generateCsvExport(userData: UserDataExport, exportPath: string): Promise<void> {
    // Generate CSV files
    const profileCsv = this.convertToCsv(userData.personalData.profile);
    await fs.writeFile(path.join(exportPath, 'profile.csv'), profileCsv);
    
    if (userData.personalData.auditLogs.length > 0) {
      const auditLogsCsv = this.convertToCsv(userData.personalData.auditLogs);
      await fs.writeFile(path.join(exportPath, 'audit-logs.csv'), auditLogsCsv);
    }
    
    if (userData.personalData.sessions.length > 0) {
      const sessionsCsv = this.convertToCsv(userData.personalData.sessions);
      await fs.writeFile(path.join(exportPath, 'sessions.csv'), sessionsCsv);
    }
    
    if (userData.personalData.consents.length > 0) {
      const consentsCsv = this.convertToCsv(userData.personalData.consents);
      await fs.writeFile(path.join(exportPath, 'consents.csv'), consentsCsv);
    }
  }

  private async generatePdfExport(userData: UserDataExport, exportPath: string): Promise<void> {
    // PDF generation would require a library like puppeteer
    // For now, create a text-based report
    let report = `GDPR Data Export Report\n`;
    report += `========================\n\n`;
    report += `Export ID: ${userData.metadata.exportId}\n`;
    report += `Exported At: ${userData.metadata.exportedAt}\n`;
    report += `User ID: ${userData.userId}\n`;
    report += `Tenant ID: ${userData.tenantId}\n\n`;
    
    report += `Profile Information\n`;
    report += `------------------\n`;
    report += `Name: ${userData.personalData.profile.name}\n`;
    report += `Email: ${userData.personalData.profile.email}\n`;
    report += `Role: ${userData.personalData.profile.role}\n`;
    report += `Status: ${userData.personalData.profile.status}\n`;
    report += `Created: ${userData.personalData.profile.createdAt}\n`;
    report += `Updated: ${userData.personalData.profile.updatedAt}\n\n`;
    
    report += `Audit Logs (${userData.personalData.auditLogs.length} entries)\n`;
    report += `-----------\n`;
    userData.personalData.auditLogs.forEach(log => {
      report += `${log.timestamp} - ${log.action} on ${log.resource}\n`;
    });
    
    await fs.writeFile(path.join(exportPath, 'data-export.txt'), report);
  }

  private convertToCsv(data: any): string {
    if (!Array.isArray(data)) {
      // Convert single object to CSV
      const headers = Object.keys(data);
      const values = Object.values(data);
      return [headers.join(','), values.join(',')].join('\n');
    }
    
    if (data.length === 0) {
      return '';
    }
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const values = headers.map(header => {
        const value = item[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  async scheduleDataExport(request: ExportRequest): Promise<string> {
    const exportId = uuidv4();
    
    // Store export request in database
    await this.prisma.accessRequest.create({
      data: {
        id: exportId,
        userId: request.userId,
        tenantId: request.tenantId,
        type: 'DATA_EXPORT',
        status: 'PENDING',
        requestedBy: request.requestedBy,
        details: {
          format: request.format,
          includeAuditLogs: request.includeAuditLogs,
          includeSessions: request.includeSessions,
          includeConsents: request.includeConsents,
        },
      },
    });

    this.logger.logAuditEvent('DATA_EXPORT_SCHEDULED', 'user_data', {
      exportId,
      userId: request.userId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
    });

    return exportId;
  }

  async getExportStatus(exportId: string, userId: string, tenantId: string): Promise<any> {
    const exportRequest = await this.prisma.accessRequest.findFirst({
      where: {
        id: exportId,
        userId: userId,
        tenantId: tenantId,
        type: 'DATA_EXPORT',
      },
    });

    if (!exportRequest) {
      throw new NotFoundException('Export request not found');
    }

    return {
      id: exportRequest.id,
      status: exportRequest.status,
      requestedAt: exportRequest.createdAt,
      completedAt: exportRequest.completedAt,
      downloadUrl: exportRequest.downloadUrl,
      expiresAt: exportRequest.expiresAt,
    };
  }

  async cleanupExpiredExports(): Promise<void> {
    const expiredExports = await this.prisma.accessRequest.findMany({
      where: {
        type: 'DATA_EXPORT',
        status: 'COMPLETED',
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    for (const exportRequest of expiredExports) {
      try {
        // Delete file if it exists
        if (exportRequest.downloadUrl) {
          const filePath = exportRequest.downloadUrl.replace('file://', '');
          await fs.unlink(filePath);
        }
        
        // Update database record
        await this.prisma.accessRequest.update({
          where: { id: exportRequest.id },
          data: { 
            status: 'EXPIRED',
            downloadUrl: null,
          },
        });

        this.logger.log('Expired export cleaned up', {
          exportId: exportRequest.id,
          userId: exportRequest.userId,
        });
      } catch (error) {
        this.logger.logErrorWithStack('Failed to cleanup expired export', error as Error, {
          exportId: exportRequest.id,
        });
      }
    }
  }
}
