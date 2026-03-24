import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new Error('Tenant ID not found in request');
    }

    // Extend Prisma with automatic tenant filtering
    const originalFindMany = this.prisma.tenantUser.findMany.bind(this.prisma.tenantUser);
    const originalFindUnique = this.prisma.tenantUser.findUnique.bind(this.prisma.tenantUser);
    const originalFindFirst = this.prisma.tenantUser.findFirst.bind(this.prisma.tenantUser);
    const originalCreate = this.prisma.tenantUser.create.bind(this.prisma.tenantUser);
    const originalUpdate = this.prisma.tenantUser.update.bind(this.prisma.tenantUser);
    const originalUpdateMany = this.prisma.tenantUser.updateMany.bind(this.prisma.tenantUser);
    const originalDelete = this.prisma.tenantUser.delete.bind(this.prisma.tenantUser);
    const originalDeleteMany = this.prisma.tenantUser.deleteMany.bind(this.prisma.tenantUser);

    // Override find methods to enforce tenant isolation
    this.prisma.tenantUser.findMany = (args: any) => {
      if (!args.where) args.where = {};
      args.where.tenantId = tenantId;
      return originalFindMany(args);
    };

    this.prisma.tenantUser.findUnique = (args: any) => {
      if (!args.where) args.where = {};
      if (typeof args.where === 'object' && !args.where.tenantId) {
        args.where.tenantId = tenantId;
      }
      return originalFindUnique(args);
    };

    this.prisma.tenantUser.findFirst = (args: any) => {
      if (!args.where) args.where = {};
      args.where.tenantId = tenantId;
      return originalFindFirst(args);
    };

    // Override create to enforce tenant
    this.prisma.tenantUser.create = (args: any) => {
      if (!args.data) args.data = {};
      args.data.tenantId = tenantId;
      return originalCreate(args);
    };

    // Override update methods to enforce tenant
    this.prisma.tenantUser.update = (args: any) => {
      if (!args.where) args.where = {};
      args.where.tenantId = tenantId;
      return originalUpdate(args);
    };

    this.prisma.tenantUser.updateMany = (args: any) => {
      if (!args.where) args.where = {};
      args.where.tenantId = tenantId;
      return originalUpdateMany(args);
    };

    // Override delete methods to enforce tenant
    this.prisma.tenantUser.delete = (args: any) => {
      if (!args.where) args.where = {};
      args.where.tenantId = tenantId;
      return originalDelete(args);
    };

    this.prisma.tenantUser.deleteMany = (args: any) => {
      if (!args.where) args.where = {};
      args.where.tenantId = tenantId;
      return originalDeleteMany(args);
    };

    return next.handle();
  }
}
