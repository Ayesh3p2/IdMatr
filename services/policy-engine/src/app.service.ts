import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  async checkPolicy(data: { userId: string; resource: string; action: string }) {
    this.logger.log(`Checking policy for user ${data.userId} on ${data.resource}:${data.action}`);
    
    // In a real system, this would evaluate OPA/Rego or RBAC rules in DB
    // For now, let's implement a simple RBAC logic
    if (data.action === 'read') return { allowed: true };
    if (data.action === 'write' && data.userId === 'admin-id') return { allowed: true };
    
    return { allowed: false, reason: 'Insufficient privileges' };
  }

  async getPolicies() {
    return [
      { id: '1', name: 'Global Read Access', description: 'Allows all users to read public resources', effect: 'allow', actions: ['read'], resources: ['*'] },
      { id: '2', name: 'Admin Write Access', description: 'Allows admins to write to all resources', effect: 'allow', actions: ['write', 'delete'], resources: ['*'], conditions: { role: 'admin' } },
    ];
  }
}
