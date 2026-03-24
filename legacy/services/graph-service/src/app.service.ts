import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private driver: Driver;

  async onModuleInit() {
    if (!process.env.NEO4J_URL || !process.env.NEO4J_PASSWORD) {
      throw new Error('NEO4J_URL and NEO4J_PASSWORD env vars are required');
    }

    this.driver = neo4j.driver(
      process.env.NEO4J_URL,
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD),
    );

    try {
      await this.driver.verifyConnectivity();
      this.logger.log('Neo4j connection established');
    } catch (error) {
      this.logger.warn(`Neo4j connectivity check failed: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.driver) await this.driver.close();
  }

  async getIdentityGraph(tenantId: string, userId: string) {
    if (process.env.DEMO_MODE === 'true') return this.getMockGraph(tenantId, userId);

    const session: Session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId, tenantId: $tenantId})-[r:HAS_ROLE]->(role:Role {tenantId: $tenantId})
              -[p:HAS_PERMISSION]->(perm:Permission {tenantId: $tenantId})
        MATCH (role)-[b:BELONGS_TO]->(app:Application {tenantId: $tenantId})
        RETURN u, r, role, p, perm, b, app
        `,
        { tenantId, userId },
      );

      if (!result.records.length) {
        return { nodes: [], links: [] };
      }

      const nodes: any[] = [];
      const links: any[] = [];
      const seen = new Set<string>();

      for (const record of result.records) {
        const user = record.get('u').properties;
        const role = record.get('role').properties;
        const perm = record.get('perm').properties;
        const app = record.get('app').properties;

        if (!seen.has(user.id)) { nodes.push({ id: user.id, label: 'User', properties: user }); seen.add(user.id); }
        if (!seen.has(role.id)) { nodes.push({ id: role.id, label: 'Role', properties: role }); seen.add(role.id); }
        if (!seen.has(perm.id)) { nodes.push({ id: perm.id, label: 'Permission', properties: perm }); seen.add(perm.id); }
        if (!seen.has(app.id)) { nodes.push({ id: app.id, label: 'Application', properties: app }); seen.add(app.id); }

        links.push({ source: user.id, target: role.id, type: 'HAS_ROLE' });
        links.push({ source: role.id, target: perm.id, type: 'HAS_PERMISSION' });
        links.push({ source: role.id, target: app.id, type: 'BELONGS_TO' });
      }

      return { nodes, links };
    } catch (error) {
      this.logger.error(`Neo4j error: ${(error as Error).message}`);
      throw new RpcException(`Graph database error: ${(error as Error).message}`);
    } finally {
      await session.close();
    }
  }

  async getToxicCombinations(tenantId: string) {
    if (process.env.DEMO_MODE === 'true') return this.getMockToxicCombinations();

    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (u:User {tenantId: $tenantId})-[:HAS_ROLE]->(r:Role {tenantId: $tenantId})-[:HAS_PERMISSION]->(p:Permission {tenantId: $tenantId})
        WHERE toLower(p.name) CONTAINS 'approve' OR toLower(p.name) CONTAINS 'create'
        WITH u, r.applicationId AS appId, collect(DISTINCT p.name) AS perms
        WHERE size(perms) > 1
        RETURN u.email AS user, appId, perms
        LIMIT 100
      `, { tenantId });

      return result.records.map((record, index) => ({
        id: `TC-${String(index + 1).padStart(3, '0')}`,
        users: [record.get('user')],
        permissions: record.get('perms'),
        risk: 'High',
        violation: 'SoD: conflicting permissions in same application',
        remediationSteps: [`Review permissions for ${record.get('user')}`, 'Remove conflicting permission grant'],
      }));
    } catch (error) {
      this.logger.error(`Toxic combinations query failed: ${(error as Error).message}`);
      return [];
    } finally {
      await session.close();
    }
  }

  async getAttackPaths(tenantId: string) {
    if (process.env.DEMO_MODE === 'true') return this.getMockAttackPaths();

    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH path = shortestPath((u:User {tenantId: $tenantId})-[*1..6]->(target))
        WHERE (target:Application OR target:Permission)
          AND target.tenantId = $tenantId
          AND (target.riskLevel = 'critical' OR target.type = 'production')
        RETURN u.email AS startUser,
               [node IN nodes(path) | coalesce(node.email, node.name, node.id)] AS pathNodes,
               length(path) AS hops,
               target.name AS targetName
        LIMIT 20
      `, { tenantId });

      return result.records.map((record, index) => ({
        id: `AP-${String(index + 1).padStart(3, '0')}`,
        startNode: record.get('startUser'),
        path: (record.get('pathNodes') as string[]).join(' -> '),
        hops: record.get('hops') as number,
        risk: (record.get('hops') as number) <= 3 ? 'Critical' : 'High',
        description: `Attack path from ${record.get('startUser')} to ${record.get('targetName')}`,
      }));
    } catch (error) {
      this.logger.error(`Attack paths query failed: ${(error as Error).message}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /** Privilege creep detection — users whose permissions have grown beyond their original role scope */
  async getPrivilegeCreep(tenantId: string) {
    if (process.env.DEMO_MODE === 'true') return this.getMockPrivilegeCreep();

    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (u:User {tenantId: $tenantId})-[:HAS_ROLE]->(r:Role {tenantId: $tenantId})
        WITH u, count(r) AS roleCount, collect(r.name) AS roles
        WHERE roleCount > 2
        RETURN u.id AS userId, u.email AS email, roleCount, roles
        ORDER BY roleCount DESC
        LIMIT 50
      `, { tenantId });

      return result.records.map((record) => ({
        userId: record.get('userId'),
        email: record.get('email'),
        roleCount: (record.get('roleCount') as any).toNumber?.() ?? record.get('roleCount'),
        roles: record.get('roles'),
        riskLevel: (record.get('roleCount') as any).toNumber?.() > 5 ? 'Critical' : 'High',
        recommendation: 'Review and remove excess roles — apply principle of least privilege',
      }));
    } catch (error) {
      this.logger.error(`Privilege creep query failed: ${(error as Error).message}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /** Stale access detection — accounts/roles unused for more than N days */
  async getStaleAccess(tenantId: string, staleDays = 90) {
    if (process.env.DEMO_MODE === 'true') return this.getMockStaleAccess();

    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (u:User {tenantId: $tenantId})-[r:HAS_ROLE]->(role:Role {tenantId: $tenantId})
        WHERE u.lastLogin < $cutoff OR u.lastLogin IS NULL
        RETURN u.id AS userId, u.email AS email, u.lastLogin AS lastLogin,
               collect(role.name) AS roles
        LIMIT 100
      `, { tenantId, cutoff });

      return result.records.map((record) => ({
        userId: record.get('userId'),
        email: record.get('email'),
        lastLogin: record.get('lastLogin'),
        roles: record.get('roles'),
        staleDays,
        recommendation: 'Disable or deprovision — no activity in ' + staleDays + ' days',
      }));
    } catch (error) {
      this.logger.error(`Stale access query failed: ${(error as Error).message}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /** AI-native identity risk recommendations based on graph analysis */
  async getIdentityRiskRecommendations(tenantId: string) {
    const [toxic, privilegeCreep, staleAccess, attackPaths] = await Promise.allSettled([
      this.getToxicCombinations(tenantId),
      this.getPrivilegeCreep(tenantId),
      this.getStaleAccess(tenantId),
      this.getAttackPaths(tenantId),
    ]);

    const recommendations: any[] = [];
    let riskScore = 0;

    const toxicList = toxic.status === 'fulfilled' ? (toxic.value as any[]) : [];
    const creepList = privilegeCreep.status === 'fulfilled' ? (privilegeCreep.value as any[]) : [];
    const staleList = staleAccess.status === 'fulfilled' ? (staleAccess.value as any[]) : [];
    const pathList = attackPaths.status === 'fulfilled' ? (attackPaths.value as any[]) : [];

    if (toxicList.length > 0) {
      riskScore += toxicList.length * 15;
      recommendations.push({
        id: 'REC-SoD-001',
        category: 'Separation of Duties',
        priority: 'Critical',
        finding: `${toxicList.length} toxic permission combination(s) detected`,
        action: 'Immediately revoke conflicting permissions and enforce SoD policies',
        affectedUsers: toxicList.flatMap((t: any) => t.users).slice(0, 5),
        complianceFrameworks: ['SOC2-CC6.3', 'ISO27001-A.9.4', 'NIST-AC-5'],
      });
    }

    if (creepList.length > 0) {
      riskScore += Math.min(creepList.length * 5, 30);
      recommendations.push({
        id: 'REC-PRIV-002',
        category: 'Privilege Creep',
        priority: 'High',
        finding: `${creepList.length} user(s) with excessive role accumulation`,
        action: 'Run access certification campaign and apply least-privilege principle',
        affectedUsers: creepList.slice(0, 5).map((u: any) => u.email),
        complianceFrameworks: ['SOC2-CC6.3', 'HIPAA-164.312(a)(1)', 'NIST-AC-6'],
      });
    }

    if (staleList.length > 0) {
      riskScore += Math.min(staleList.length * 3, 25);
      recommendations.push({
        id: 'REC-STALE-003',
        category: 'Stale Access',
        priority: 'Medium',
        finding: `${staleList.length} account(s) with no activity in 90+ days`,
        action: 'Disable dormant accounts; schedule periodic access reviews',
        affectedUsers: staleList.slice(0, 5).map((u: any) => u.email),
        complianceFrameworks: ['SOC2-CC6.2', 'ISO27001-A.9.2.6', 'GDPR-Art.5(1)(e)'],
      });
    }

    if (pathList.length > 0) {
      riskScore += pathList.length * 10;
      recommendations.push({
        id: 'REC-ATK-004',
        category: 'Attack Path',
        priority: 'Critical',
        finding: `${pathList.length} lateral movement path(s) to critical assets`,
        action: 'Break privilege chain paths; implement just-in-time access for critical resources',
        affectedUsers: pathList.slice(0, 5).map((p: any) => p.startNode),
        complianceFrameworks: ['SOC2-CC6.8', 'NIST-AC-17', 'ISO27001-A.13.1'],
      });
    }

    return {
      tenantId,
      analysisDate: new Date().toISOString(),
      overallRiskScore: Math.min(100, riskScore),
      riskLevel: riskScore >= 70 ? 'Critical' : riskScore >= 40 ? 'High' : riskScore >= 20 ? 'Medium' : 'Low',
      recommendations,
      summary: {
        toxicCombinations: toxicList.length,
        privilegeCreepUsers: creepList.length,
        staleAccounts: staleList.length,
        attackPaths: pathList.length,
      },
    };
  }

  private getMockPrivilegeCreep() {
    return [
      {
        userId: 'u1',
        email: 'ops.lead@example.com',
        roleCount: 7,
        roles: ['Admin', 'Finance Viewer', 'HR Read', 'IT Admin', 'Security Read', 'Audit', 'DevOps'],
        riskLevel: 'Critical',
        recommendation: 'Review and remove excess roles — apply principle of least privilege',
      },
    ];
  }

  private getMockStaleAccess() {
    return [
      {
        userId: 'u99',
        email: 'former.employee@example.com',
        lastLogin: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        roles: ['Finance Viewer'],
        staleDays: 120,
        recommendation: 'Disable or deprovision — no activity in 120 days',
      },
    ];
  }

  private getMockGraph(tenantId: string, userId: string) {
    return {
      nodes: [
        { id: userId, label: 'User', properties: { tenantId, name: 'Demo User', email: 'demo@example.com' } },
        { id: 'r1', label: 'Role', properties: { tenantId, name: 'Admin', appId: 'a1' } },
        { id: 'p1', label: 'Permission', properties: { tenantId, name: 'Drive.FullAccess', riskLevel: 'high' } },
        { id: 'a1', label: 'Application', properties: { tenantId, name: 'Google Workspace', type: 'cloud-productivity' } },
      ],
      links: [
        { source: userId, target: 'r1', type: 'HAS_ROLE' },
        { source: 'r1', target: 'p1', type: 'HAS_PERMISSION' },
        { source: 'r1', target: 'a1', type: 'BELONGS_TO' },
      ],
    };
  }

  private getMockToxicCombinations() {
    return [{
      id: 'TC-001',
      users: ['finance.manager@example.com'],
      permissions: ['Approve Payments', 'Create Vendors'],
      risk: 'Critical',
      violation: 'SoD: Finance — approve + create in same application',
      remediationSteps: ['Remove "Create Vendors" from finance.manager', 'Assign vendor creation to a separate role'],
    }];
  }

  private getMockAttackPaths() {
    return [{
      id: 'AP-001',
      startNode: 'admin@example.com',
      path: 'admin@example.com -> Global Admin -> All Applications -> Production Database',
      hops: 3,
      risk: 'Critical',
      description: 'Direct path from admin account to production database via Global Admin role',
    }];
  }
}
