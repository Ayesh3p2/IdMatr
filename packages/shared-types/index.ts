export interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  riskScore: number;
  lastLogin: Date;
  metadata: Record<string, any>;
}

export interface Application {
  id: string;
  name: string;
  type: 'saas' | 'on-prem' | 'internal';
  discoverySource: string;
  riskScore: number;
  userCount: number;
  adminCount: number;
  status: 'managed' | 'unmanaged' | 'shadow-it';
}

export interface Role {
  id: string;
  name: string;
  description: string;
  applicationId: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  roleId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface AccessGrant {
  id: string;
  userId: string;
  applicationId: string;
  roleId: string;
  grantedAt: Date;
  expiresAt?: Date;
  status: 'active' | 'revoked' | 'expired';
}

export interface RiskEvent {
  id: string;
  userId: string;
  applicationId?: string;
  type: 'excessive_privilege' | 'dormant_account' | 'privilege_escalation' | 'abnormal_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  actorId: string;
  action: string;
  targetId: string;
  targetType: string;
  details: any;
  ipAddress?: string;
}

export interface ApprovalWorkflow {
  id: string;
  requestType: 'access_request' | 'role_change' | 'certification';
  requesterId: string;
  targetId: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  currentApproverId: string;
  slaDueDate: Date;
  history: Array<{
    approverId: string;
    action: 'approve' | 'reject' | 'comment';
    timestamp: Date;
    comment?: string;
  }>;
}
