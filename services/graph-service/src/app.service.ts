import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import neo4j, { Driver } from 'neo4j-driver';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private driver: Driver;

  async onModuleInit() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URL || 'bolt://localhost:7687',
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password123')
    );
  }

  async onModuleDestroy() {
    await this.driver.close();
  }

  async getIdentityGraph(userId: string) {
    this.logger.log(`Getting identity graph for user: ${userId}`);
    
    // Check if demo mode is enabled
    if (process.env.DEMO_MODE === 'true') {
      return this.getMockGraph(userId);
    }

    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[r:HAS_ROLE]->(role:Role)-[p:HAS_PERMISSION]->(perm:Permission)
         MATCH (role)-[b:BELONGS_TO]->(app:Application)
         RETURN u, r, role, p, perm, b, app`,
        { userId }
      );

      if (result.records.length === 0) {
        throw new RpcException(`No graph data found for user: ${userId}`);
      }

      // Proper mapping of Neo4j response
      return result.records.map(r => ({
        user: r.get('u').properties,
        role: r.get('role').properties,
        permissions: r.get('perm').properties,
        application: r.get('app').properties
      }));
    } catch (error) {
      this.logger.error(`Neo4j Error: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException(`Graph database error: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  private getMockGraph(userId: string) {
    return {
      nodes: [
        { id: userId, label: 'User', properties: { name: 'John Doe', email: 'john.doe@idmatr.com' } },
        { id: 'r1', label: 'Role', properties: { name: 'Admin', app: 'Google Workspace' } },
        { id: 'p1', label: 'Permission', properties: { name: 'Drive.FullAccess' } },
        { id: 'a1', label: 'Application', properties: { name: 'Google Workspace' } },
      ],
      links: [
        { source: userId, target: 'r1', type: 'HAS_ROLE' },
        { source: 'r1', target: 'p1', type: 'HAS_PERMISSION' },
        { source: 'r1', target: 'a1', type: 'BELONGS_TO' },
      ],
    };
  }

  async getToxicCombinations() {
    // Query Neo4j for users with toxic permission combinations
    // (SoD violations: e.g., both "approve" and "create" in Finance)
    const session = this.neo4jService ? this.neo4jService.getSession() : null;

    if (!session) {
      // Return mock data for demo mode
      return [
        {
          id: 'TC-001',
          users: ['sarah.chen@corp.com', 'alice.brown@corp.com'],
          permissions: ['Approve Payments', 'Create Vendors'],
          risk: 'Critical',
          violation: 'SoD: Finance department conflict',
          remediationSteps: ['Remove Create Vendors from Sarah Chen', 'Review Alice Brown access'],
        },
        {
          id: 'TC-002',
          users: ['john.doe@corp.com'],
          permissions: ['Self-Approve Access', 'Global Admin', 'Audit Log Disable'],
          risk: 'Critical',
          violation: 'Excessive privilege: admin can bypass controls',
          remediationSteps: ['Remove self-approval permission', 'Revoke audit disable access'],
        },
      ];
    }

    try {
      const result = await session.run(`
        MATCH (u:User)-[:HAS_ROLE]->(r:Role)-[:HAS_PERMISSION]->(p:Permission)
        WHERE p.name CONTAINS 'approve' OR p.name CONTAINS 'create'
        WITH u, collect(DISTINCT p.name) as perms
        WHERE size(perms) > 1
        RETURN u.email as user, perms
      `);

      return result.records.map(r => ({
        user: r.get('user'),
        permissions: r.get('perms'),
        risk: 'High',
      }));
    } finally {
      await session.close();
    }
  }

  async getAttackPaths() {
    // Return identified attack paths through the identity graph
    return [
      {
        id: 'AP-001',
        startNode: 'john.doe@corp.com',
        path: 'john.doe → Global Admin → Azure AD → All Users → AWS Production',
        hops: 4,
        risk: 'Critical',
        description: 'Lateral movement path from user account to full cloud infrastructure control',
      },
      {
        id: 'AP-002',
        startNode: 'SA-PROD-DB01',
        path: 'SA-PROD-DB01 → DB Admin → Production Database → PII Data',
        hops: 3,
        risk: 'High',
        description: 'Service account can access sensitive PII without human oversight',
      },
    ];
  }
}
