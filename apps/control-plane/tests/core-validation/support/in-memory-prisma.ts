import { randomUUID } from 'crypto';
import {
  EventSeverity,
  IntegrationProvider,
  IntegrationStatus,
  RequestStatus,
  RequestType,
  ReviewStatus,
  Role,
  TenantStatus,
  UserStatus,
} from '@prisma/client';

type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  primaryDomain: string | null;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
};

type TenantUserRecord = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  refreshTokenHash: string | null;
  authVersion: number;
  role: Role;
  status: UserStatus;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type IntegrationRecord = {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  externalDomain: string | null;
  configEncrypted: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExternalIdentityRecord = {
  id: string;
  tenantId: string;
  integrationId: string;
  externalId: string;
  primaryEmail: string;
  fullName: string;
  givenName: string | null;
  familyName: string | null;
  orgUnitPath: string | null;
  lastLoginAt: Date | null;
  roleNames: string[];
  suspended: boolean;
  archived: boolean;
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  riskScore: number;
  sourceStatus: string;
  rawProfile: Record<string, unknown>;
  mappedTenantUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExternalGroupRecord = {
  id: string;
  tenantId: string;
  integrationId: string;
  externalId: string;
  email: string;
  name: string;
  description: string | null;
  directMembersCount: number;
  rawProfile: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type ExternalGroupMembershipRecord = {
  id: string;
  tenantId: string;
  integrationId: string;
  externalGroupId: string;
  externalIdentityId: string | null;
  memberExternalId: string;
  memberEmail: string | null;
  memberType: string;
  role: string;
  rawProfile: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type IdentityRequestRecord = {
  id: string;
  tenantId: string;
  integrationId: string;
  requesterUserId: string;
  approverUserId: string | null;
  externalIdentityId: string;
  externalGroupId: string;
  type: RequestType;
  title: string;
  description: string;
  requestedAccessRole: string | null;
  status: RequestStatus;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  externalOperationStatus: string | null;
  externalOperationError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuditEventRecord = {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  resource: string;
  severity: EventSeverity;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

type CoreValidationState = {
  tenants: TenantRecord[];
  tenantUsers: TenantUserRecord[];
  integrations: IntegrationRecord[];
  externalIdentities: ExternalIdentityRecord[];
  externalGroups: ExternalGroupRecord[];
  externalGroupMemberships: ExternalGroupMembershipRecord[];
  identityRequests: IdentityRequestRecord[];
  auditEvents: AuditEventRecord[];
};

export class InMemoryPrismaService {
  private state: CoreValidationState = {
    tenants: [],
    tenantUsers: [],
    integrations: [],
    externalIdentities: [],
    externalGroups: [],
    externalGroupMemberships: [],
    identityRequests: [],
    auditEvents: [],
  };

  reset(state: CoreValidationState) {
    this.state = structuredClone(state);
  }

  snapshot() {
    return structuredClone(this.state);
  }

  async $disconnect() {}

  async $queryRaw() {
    return [{ '?column?': 1 }];
  }

  tenantUser = {
    count: async (args?: { where?: Record<string, unknown> }) =>
      this.count(this.state.tenantUsers, args?.where),
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.tenantUsers, args?.where)),
    findUnique: async (args: { where: Record<string, unknown>; select?: Record<string, boolean>; include?: any }) =>
      this.clone(this.pickTenantUser(this.findUnique(this.state.tenantUsers, args.where), args.select, args.include)),
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) =>
      this.clone(this.findMany(this.state.tenantUsers, args?.where, args?.orderBy)),
    create: async (args: { data: Partial<TenantUserRecord> }) => {
      const now = new Date();
      const record: TenantUserRecord = {
        id: args.data.id ?? randomUUID(),
        tenantId: args.data.tenantId!,
        email: args.data.email!,
        name: args.data.name!,
        passwordHash: args.data.passwordHash!,
        refreshTokenHash: args.data.refreshTokenHash ?? null,
        authVersion: args.data.authVersion ?? 0,
        role: args.data.role ?? Role.USER,
        status: args.data.status ?? UserStatus.ACTIVE,
        mfaEnabled: args.data.mfaEnabled ?? false,
        mfaSecret: args.data.mfaSecret ?? null,
        lastLoginAt: args.data.lastLoginAt ?? null,
        createdAt: args.data.createdAt ?? now,
        updatedAt: args.data.updatedAt ?? now,
      };
      this.state.tenantUsers.push(record);
      return this.clone(record);
    },
    update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const record = this.requireUnique(this.state.tenantUsers, args.where, 'Tenant user not found');
      this.applyUpdate(record, args.data);
      record.updatedAt = new Date();
      return this.clone(record);
    },
    delete: async (args: { where: Record<string, unknown> }) => {
      const index = this.findIndex(this.state.tenantUsers, args.where);
      if (index === -1) {
        throw new Error('Tenant user not found');
      }
      const [removed] = this.state.tenantUsers.splice(index, 1);
      return this.clone(removed);
    },
  };

  tenant = {
    count: async (args?: { where?: Record<string, unknown> }) => this.count(this.state.tenants, args?.where),
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.tenants, args?.where)),
    findUnique: async (args: { where: Record<string, unknown> }) =>
      this.clone(this.findUnique(this.state.tenants, args.where)),
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'>; include?: any }) =>
      this.clone(
        this.findMany(this.state.tenants, args?.where, args?.orderBy).map((tenant) =>
          args?.include?._count ? this.attachTenantCount(tenant) : tenant,
        ),
      ),
    create: async (args: { data: Partial<TenantRecord> }) => {
      const now = new Date();
      const record: TenantRecord = {
        id: args.data.id ?? randomUUID(),
        name: args.data.name!,
        slug: args.data.slug!,
        primaryDomain: args.data.primaryDomain ?? null,
        status: args.data.status ?? TenantStatus.ACTIVE,
        createdAt: args.data.createdAt ?? now,
        updatedAt: args.data.updatedAt ?? now,
      };
      this.state.tenants.push(record);
      return this.clone(record);
    },
  };

  integration = {
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.integrations, args?.where)),
    findFirstOrThrow: async (args: { where?: Record<string, unknown> }) => {
      const record = this.findFirst(this.state.integrations, args.where);
      if (!record) {
        throw new Error('Integration not found');
      }
      return this.clone(record);
    },
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) =>
      this.clone(this.findMany(this.state.integrations, args?.where, args?.orderBy)),
    findUniqueOrThrow: async (args: { where: Record<string, unknown> }) => {
      const record = this.findUnique(this.state.integrations, args.where);
      if (!record) {
        throw new Error('Integration not found');
      }
      return this.clone(record);
    },
  };

  externalIdentity = {
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.externalIdentities, args?.where)),
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'>; include?: any }) =>
      this.clone(
        this.findMany(this.state.externalIdentities, args?.where, args?.orderBy).map((identity) =>
          this.attachExternalIdentityIncludes(identity, args?.include),
        ),
      ),
    update: async (args: { where: Record<string, unknown>; data: Record<string, unknown>; include?: any }) => {
      const record = this.requireUnique(this.state.externalIdentities, args.where, 'External identity not found');
      this.applyUpdate(record, args.data);
      record.updatedAt = new Date();
      return this.clone(this.attachExternalIdentityIncludes(record, args.include));
    },
    updateMany: async (args: { where?: Record<string, unknown>; data: Record<string, unknown> }) => {
      const matches = this.findMany(this.state.externalIdentities, args.where);
      for (const record of matches) {
        this.applyUpdate(record, args.data);
        record.updatedAt = new Date();
      }
      return { count: matches.length };
    },
  };

  externalGroup = {
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.externalGroups, args?.where)),
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'>; include?: any }) =>
      this.clone(
        this.findMany(this.state.externalGroups, args?.where, args?.orderBy).map((group) =>
          this.attachExternalGroupIncludes(group, args?.include),
        ),
      ),
  };

  externalGroupMembership = {
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.externalGroupMemberships, args?.where)),
    findMany: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findMany(this.state.externalGroupMemberships, args?.where)),
  };

  identityRequest = {
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'>; include?: any }) =>
      this.clone(
        this.findMany(this.state.identityRequests, args?.where, args?.orderBy).map((request) =>
          this.attachIdentityRequestIncludes(request, args?.include),
        ),
      ),
    findFirst: async (args?: { where?: Record<string, unknown> }) =>
      this.clone(this.findFirst(this.state.identityRequests, args?.where)),
    create: async (args: { data: Partial<IdentityRequestRecord>; include?: any }) => {
      const now = new Date();
      const record: IdentityRequestRecord = {
        id: args.data.id ?? randomUUID(),
        tenantId: args.data.tenantId!,
        integrationId: args.data.integrationId!,
        requesterUserId: args.data.requesterUserId!,
        approverUserId: args.data.approverUserId ?? null,
        externalIdentityId: args.data.externalIdentityId!,
        externalGroupId: args.data.externalGroupId!,
        type: args.data.type ?? RequestType.APP_ACCESS,
        title: args.data.title!,
        description: args.data.description!,
        requestedAccessRole: args.data.requestedAccessRole ?? null,
        status: args.data.status ?? RequestStatus.PENDING,
        reviewNotes: args.data.reviewNotes ?? null,
        reviewedAt: args.data.reviewedAt ?? null,
        externalOperationStatus: args.data.externalOperationStatus ?? null,
        externalOperationError: args.data.externalOperationError ?? null,
        createdAt: args.data.createdAt ?? now,
        updatedAt: args.data.updatedAt ?? now,
      };
      this.state.identityRequests.push(record);
      return this.clone(this.attachIdentityRequestIncludes(record, args.include));
    },
  };

  auditEvent = {
    create: async (args: { data: Partial<AuditEventRecord> }) => {
      const record: AuditEventRecord = {
        id: args.data.id ?? randomUUID(),
        tenantId: args.data.tenantId!,
        actorUserId: args.data.actorUserId ?? null,
        action: args.data.action!,
        resource: args.data.resource!,
        severity: args.data.severity ?? EventSeverity.LOW,
        metadata: (args.data.metadata ?? {}) as Record<string, unknown>,
        createdAt: args.data.createdAt ?? new Date(),
      };
      this.state.auditEvents.push(record);
      return this.clone(record);
    },
    findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'>; include?: any }) =>
      this.clone(
        this.findMany(this.state.auditEvents, args?.where, args?.orderBy).map((event) =>
          this.attachAuditEventIncludes(event, args?.include),
        ),
      ),
  };

  private count<T extends Record<string, unknown>>(items: T[], where?: Record<string, unknown>) {
    return this.findMany(items, where).length;
  }

  private findIndex<T extends Record<string, unknown>>(items: T[], where: Record<string, unknown>) {
    return items.findIndex((item) => this.matchesWhere(item, where));
  }

  private findFirst<T extends Record<string, unknown>>(items: T[], where?: Record<string, unknown>) {
    if (!where) {
      return items[0];
    }
    return items.find((item) => this.matchesWhere(item, where));
  }

  private findUnique<T extends Record<string, unknown>>(items: T[], where: Record<string, unknown>) {
    return this.findFirst(items, where);
  }

  private requireUnique<T extends Record<string, unknown>>(items: T[], where: Record<string, unknown>, message: string) {
    const record = this.findUnique(items, where);
    if (!record) {
      throw new Error(message);
    }
    return record;
  }

  private findMany<T extends Record<string, unknown>>(
    items: T[],
    where?: Record<string, unknown>,
    orderBy?: Record<string, 'asc' | 'desc'>,
  ) {
    const filtered = where ? items.filter((item) => this.matchesWhere(item, where)) : [...items];
    if (!orderBy) {
      return filtered;
    }
    const [field, direction] = Object.entries(orderBy)[0];
    return filtered.sort((left, right) => {
      const leftValue = left[field];
      const rightValue = right[field];
      if (leftValue === rightValue) {
        return 0;
      }
      if (leftValue === undefined || leftValue === null) {
        return direction === 'asc' ? -1 : 1;
      }
      if (rightValue === undefined || rightValue === null) {
        return direction === 'asc' ? 1 : -1;
      }
      return leftValue < rightValue ? (direction === 'asc' ? -1 : 1) : direction === 'asc' ? 1 : -1;
    });
  }

  private matchesWhere(record: Record<string, unknown>, where: Record<string, unknown>) {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) {
        return true;
      }

      const recordValue = record[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        if ('in' in value && Array.isArray((value as { in: unknown[] }).in)) {
          return (value as { in: unknown[] }).in.includes(recordValue);
        }
        if ('not' in value) {
          return recordValue !== (value as { not: unknown }).not;
        }
        return this.matchesWhere(recordValue as Record<string, unknown>, value as Record<string, unknown>);
      }

      return recordValue === value;
    });
  }

  private applyUpdate(record: Record<string, unknown>, data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && 'increment' in value) {
        const current = Number(record[key] ?? 0);
        record[key] = current + Number((value as { increment: number }).increment);
        continue;
      }
      record[key] = value;
    }
  }

  private pickTenantUser(record: TenantUserRecord | undefined, select?: Record<string, boolean>, include?: any) {
    if (!record) {
      return null;
    }
    if (select) {
      return this.pickFields(record, select);
    }
    if (include?.tenant || include?.mappedExternalIdentities) {
      const result: Record<string, unknown> = { ...record };
      if (include.tenant) {
        result.tenant = this.state.tenants.find((tenant) => tenant.id === record.tenantId) ?? null;
      }
      if (include.mappedExternalIdentities) {
        result.mappedExternalIdentities = this.state.externalIdentities
          .filter((identity) => identity.mappedTenantUserId === record.id)
          .map((identity) =>
            include.mappedExternalIdentities.select
              ? this.pickFields(identity, include.mappedExternalIdentities.select)
              : identity,
          );
      }
      return result;
    }
    return record;
  }

  private attachTenantCount(tenant: TenantRecord) {
    return {
      ...tenant,
      _count: {
        users: this.state.tenantUsers.filter((user) => user.tenantId === tenant.id).length,
        invites: 0,
        requests: this.state.identityRequests.filter((request) => request.tenantId === tenant.id).length,
        reviews: 0,
        integrations: this.state.integrations.filter((integration) => integration.tenantId === tenant.id).length,
      },
    };
  }

  private attachExternalIdentityIncludes(identity: ExternalIdentityRecord, include?: any) {
    if (!include) {
      return identity;
    }
    const result: Record<string, unknown> = { ...identity };
    if (include.mappedTenantUser) {
      const user = identity.mappedTenantUserId
        ? this.state.tenantUsers.find((tenantUser) => tenantUser.id === identity.mappedTenantUserId)
        : null;
      result.mappedTenantUser = user
        ? include.mappedTenantUser.select
          ? this.pickFields(user, include.mappedTenantUser.select)
          : user
        : null;
    }
    if (include.memberships) {
      result.memberships = this.state.externalGroupMemberships
        .filter((membership) => membership.externalIdentityId === identity.id)
        .map((membership) => {
          if (!include.memberships.include?.externalGroup) {
            return membership;
          }
          return {
            ...membership,
            externalGroup: this.pickFields(
              this.state.externalGroups.find((group) => group.id === membership.externalGroupId)!,
              include.memberships.include.externalGroup.select,
            ),
          };
        });
    }
    return result;
  }

  private attachExternalGroupIncludes(group: ExternalGroupRecord, include?: any) {
    if (!include?._count?.select?.memberships) {
      return group;
    }
    return {
      ...group,
      _count: {
        memberships: this.state.externalGroupMemberships.filter((membership) => membership.externalGroupId === group.id)
          .length,
      },
    };
  }

  private attachIdentityRequestIncludes(request: IdentityRequestRecord, include?: any) {
    if (!include) {
      return request;
    }
    const result: Record<string, unknown> = { ...request };
    if (include.externalIdentity) {
      result.externalIdentity = this.state.externalIdentities.find(
        (identity) => identity.id === request.externalIdentityId,
      );
    }
    if (include.externalGroup) {
      result.externalGroup = this.state.externalGroups.find((group) => group.id === request.externalGroupId);
    }
    if (include.integration) {
      const integration = this.state.integrations.find((item) => item.id === request.integrationId);
      result.integration = integration && include.integration.select
        ? this.pickFields(integration, include.integration.select)
        : integration;
    }
    if (include.requesterUser) {
      const requester = this.state.tenantUsers.find((user) => user.id === request.requesterUserId);
      result.requesterUser = requester && include.requesterUser.select
        ? this.pickFields(requester, include.requesterUser.select)
        : requester;
    }
    if (include.approverUser) {
      const approver = request.approverUserId
        ? this.state.tenantUsers.find((user) => user.id === request.approverUserId)
        : null;
      result.approverUser = approver && include.approverUser.select
        ? this.pickFields(approver, include.approverUser.select)
        : approver;
    }
    return result;
  }

  private attachAuditEventIncludes(event: AuditEventRecord, include?: any) {
    if (!include?.actorUser) {
      return event;
    }
    const actor = event.actorUserId ? this.state.tenantUsers.find((user) => user.id === event.actorUserId) : null;
    return {
      ...event,
      actorUser: actor && include.actorUser.select ? this.pickFields(actor, include.actorUser.select) : actor,
    };
  }

  private pickFields(record: Record<string, unknown>, select: Record<string, boolean>) {
    return Object.entries(select).reduce<Record<string, unknown>>((accumulator, [key, enabled]) => {
      if (enabled) {
        accumulator[key] = record[key];
      }
      return accumulator;
    }, {});
  }

  private clone<T>(value: T): T {
    return value === undefined ? value : structuredClone(value);
  }
}

export type { CoreValidationState, ExternalGroupMembershipRecord, ExternalGroupRecord, ExternalIdentityRecord, IntegrationRecord, TenantRecord, TenantUserRecord };
