import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IvipService {
  private readonly logger = new Logger(IvipService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listRequests(
    tenantId: string,
    user: { id: string; role: string },
    filters: { status?: string; type?: string; page: string; limit: string }
  ) {
    const { status, type, page, limit } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    // Users can only see their own requests unless they're admin/analyst
    if (!['tenant_admin', 'analyst', 'platform_admin'].includes(user.role)) {
      where.requesterId = user.id;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.requestType = type;
    }

    const [requests, total] = await Promise.all([
      this.prisma.identityRequest.findMany({
        where,
        select: {
          id: true,
          requestType: true,
          status: true,
          title: true,
          description: true,
          requesterId: true,
          requester: {
            select: {
              name: true,
              email: true,
              role: true
            }
          },
          approverId: true,
          approver: {
            select: {
              name: true,
              email: true,
              role: true
            }
          },
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          priority: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.identityRequest.count({ where })
    ]);

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async getRequest(tenantId: string, id: string, user: { id: string; role: string }) {
    const where: any = { id, tenantId };

    // Users can only see their own requests unless they're admin/analyst
    if (!['tenant_admin', 'analyst', 'platform_admin'].includes(user.role)) {
      where.requesterId = user.id;
    }

    const request = await this.prisma.identityRequest.findFirst({
      where,
      include: {
        requester: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        approver: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        workflow: true,
        attachments: true,
        comments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  async createRequest(tenantId: string, user: { id: string; email: string }, createRequestDto: any) {
    const { requestType, title, description, priority = 'MEDIUM', targetUserId, requestedRole } = createRequestDto;

    // Validate request based on type
    this.validateRequest(requestType, createRequestDto, user);

    const request = await this.prisma.identityRequest.create({
      data: {
        tenantId,
        requestType,
        title,
        description,
        priority,
        requesterId: user.id,
        status: 'PENDING',
        targetUserId,
        requestedRole,
        workflowId: await this.getWorkflowId(tenantId, requestType),
      }
    });

    this.logger.log(`Identity request created: ${request.id} by ${user.email}`);

    return request;
  }

  async approveRequest(tenantId: string, id: string, approver: { id: string; email: string }, comments?: string) {
    const request = await this.prisma.identityRequest.findFirst({
      where: { id, tenantId, status: 'PENDING' }
    });

    if (!request) {
      throw new NotFoundException('Pending request not found');
    }

    // Execute approval action based on request type
    await this.executeApproval(request, approver);

    // Update request status
    const updatedRequest = await this.prisma.identityRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: approver.id,
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Add comment if provided
    if (comments) {
      await this.prisma.requestComment.create({
        data: {
          requestId: id,
          userId: approver.id,
          comment: comments,
          type: 'APPROVAL'
        }
      });
    }

    this.logger.log(`Request ${id} approved by ${approver.email}`);

    return updatedRequest;
  }

  async rejectRequest(tenantId: string, id: string, rejector: { id: string; email: string }, reason: string, comments?: string) {
    const request = await this.prisma.identityRequest.findFirst({
      where: { id, tenantId, status: 'PENDING' }
    });

    if (!request) {
      throw new NotFoundException('Pending request not found');
    }

    const updatedRequest = await this.prisma.identityRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId: rejector.id,
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Add rejection comment
    await this.prisma.requestComment.create({
      data: {
        requestId: id,
        userId: rejector.id,
        comment: `Reason: ${reason}${comments ? `\n\n${comments}` : ''}`,
        type: 'REJECTION'
      }
    });

    this.logger.log(`Request ${id} rejected by ${rejector.email}: ${reason}`);

    return updatedRequest;
  }

  async getTemplates(tenantId: string) {
    return {
      accessRequest: {
        title: 'Access Request',
        description: 'Request access to applications or resources',
        fields: ['targetApplication', 'accessLevel', 'justification']
      },
      roleChange: {
        title: 'Role Change Request',
        description: 'Request change in user role',
        fields: ['targetUserId', 'requestedRole', 'justification']
      },
      mfaSetup: {
        title: 'MFA Setup Request',
        description: 'Request assistance with MFA setup',
        fields: ['issueType', 'description']
      },
      accountRecovery: {
        title: 'Account Recovery',
        description: 'Request account recovery assistance',
        fields: ['issueType', 'verificationMethod']
      }
    };
  }

  async getWorkflows(tenantId: string) {
    return [
      {
        id: 'standard-approval',
        name: 'Standard Approval',
        description: 'Requires tenant admin approval',
        steps: [
          { name: 'Request Submission', required: true },
          { name: 'Manager Review', required: false },
          { name: 'Admin Approval', required: true }
        ]
      },
      {
        id: 'auto-approval',
        name: 'Auto Approval',
        description: 'Automatically approved for low-risk requests',
        steps: [
          { name: 'Request Submission', required: true },
          { name: 'Automated Check', required: true }
        ]
      }
    ];
  }

  async getAnalytics(tenantId: string, periodDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const [totalRequests, approvedRequests, rejectedRequests, pendingRequests] = await Promise.all([
      this.prisma.identityRequest.count({
        where: {
          tenantId,
          createdAt: { gte: cutoffDate }
        }
      }),
      this.prisma.identityRequest.count({
        where: {
          tenantId,
          status: 'APPROVED',
          createdAt: { gte: cutoffDate }
        }
      }),
      this.prisma.identityRequest.count({
        where: {
          tenantId,
          status: 'REJECTED',
          createdAt: { gte: cutoffDate }
        }
      }),
      this.prisma.identityRequest.count({
        where: {
          tenantId,
          status: 'PENDING',
          createdAt: { gte: cutoffDate }
        }
      })
    ]);

    const requestsByType = await this.prisma.identityRequest.groupBy({
      by: ['requestType'],
      where: {
        tenantId,
        createdAt: { gte: cutoffDate }
      },
      _count: true
    });

    const avgProcessingTime = await this.prisma.identityRequest.aggregate({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'REJECTED'] },
        createdAt: { gte: cutoffDate }
      },
      _avg: {
        completedAt: {
          subtract: 'createdAt'
        }
      }
    });

    return {
      summary: {
        totalRequests,
        approvedRequests,
        rejectedRequests,
        pendingRequests,
        approvalRate: totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0,
        avgProcessingTimeHours: avgProcessingTime._avg.completedAt ? Math.round(avgProcessingTime._avg.completedAt / (1000 * 60 * 60)) : 0
      },
      byType: requestsByType.map(r => ({
        type: r.requestType,
        count: r._count
      })),
      period: `${periodDays} days`
    };
  }

  async escalateRequest(tenantId: string, id: string, user: { id: string; email: string }, reason: string) {
    const request = await this.prisma.identityRequest.findFirst({
      where: { id, tenantId, requesterId: user.id }
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Cannot escalate processed request');
    }

    // Update request priority and add escalation comment
    await this.prisma.identityRequest.update({
      where: { id },
      data: {
        priority: 'HIGH',
        updatedAt: new Date()
      }
    });

    await this.prisma.requestComment.create({
      data: {
        requestId: id,
        userId: user.id,
        comment: `Escalated: ${reason}`,
        type: 'ESCALATION'
      }
    });

    this.logger.log(`Request ${id} escalated by ${user.email}: ${reason}`);

    return { message: 'Request escalated successfully' };
  }

  private validateRequest(requestType: string, data: any, user: { id: string; role: string }) {
    switch (requestType) {
      case 'ROLE_CHANGE':
        if (!data.targetUserId || !data.requestedRole) {
          throw new BadRequestException('Target user and requested role are required');
        }
        // Users cannot request role changes for themselves
        if (data.targetUserId === user.id) {
          throw new BadRequestException('Cannot request role change for yourself');
        }
        break;
      
      case 'ACCESS_REQUEST':
        if (!data.targetApplication || !data.accessLevel) {
          throw new BadRequestException('Target application and access level are required');
        }
        break;
      
      case 'MFA_SETUP':
        if (!data.issueType) {
          throw new BadRequestException('Issue type is required');
        }
        break;
      
      case 'ACCOUNT_RECOVERY':
        if (!data.issueType || !data.verificationMethod) {
          throw new BadRequestException('Issue type and verification method are required');
        }
        break;
      
      default:
        throw new BadRequestException('Invalid request type');
    }
  }

  private async getWorkflowId(tenantId: string, requestType: string): Promise<string | null> {
    // For now, return standard approval workflow
    return 'standard-approval';
  }

  private async executeApproval(request: any, approver: { id: string }) {
    switch (request.requestType) {
      case 'ROLE_CHANGE':
        if (request.targetUserId && request.requestedRole) {
          await this.prisma.tenantUser.update({
            where: { id: request.targetUserId },
            data: { role: request.requestedRole }
          });
        }
        break;
      
      case 'ACCESS_REQUEST':
        // Implementation would depend on integration with target systems
        this.logger.log(`Access approved for request ${request.id}`);
        break;
      
      case 'MFA_SETUP':
        // Implementation would trigger MFA setup process
        this.logger.log(`MFA setup approved for request ${request.id}`);
        break;
      
      case 'ACCOUNT_RECOVERY':
        // Implementation would trigger account recovery process
        this.logger.log(`Account recovery approved for request ${request.id}`);
        break;
    }
  }
}
