import { Controller, Get, Post, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom } from 'rxjs';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { ScanRequestDto } from './dto/scan-request.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { EnqueueJobDto } from './dto/enqueue-job.dto';

@Controller('api')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AppController {
  constructor(
    @Inject('IDENTITY_SERVICE') private identityClient: ClientProxy,
    @Inject('DISCOVERY_SERVICE') private discoveryClient: ClientProxy,
    @Inject('GOVERNANCE_SERVICE') private governanceClient: ClientProxy,
    @Inject('RISK_ENGINE') private riskClient: ClientProxy,
    @Inject('GRAPH_SERVICE') private graphClient: ClientProxy,
    @Inject('POLICY_ENGINE') private policyClient: ClientProxy,
    @Inject('AUDIT_SERVICE') private auditClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private notificationClient: ClientProxy,
    @Inject('WORKER_QUEUE') private workerClient: ClientProxy,
  ) {}

  @Get('health')
  @Roles('admin', 'user')
  getHealth() {
    return { status: 'ok', service: 'api-gateway' };
  }

  // Identity Routes
  @Get('identities')
  @Roles('admin')
  getIdentities() {
    return firstValueFrom(this.identityClient.send({ cmd: 'get_all_identities' }, {}));
  }

  @Get('identities/:id')
  @Roles('admin')
  getIdentity(@Param('id') id: string) {
    return firstValueFrom(this.identityClient.send({ cmd: 'get_identity' }, { id }));
  }

  @Post('identities')
  @Roles('admin')
  createUser(@Body() data: any) {
    return firstValueFrom(this.identityClient.send({ cmd: 'create_user' }, data));
  }

  @Post('identities/:id/risk')
  @Roles('admin')
  updateUserRisk(@Param('id') id: string, @Body('score') score: number) {
    return firstValueFrom(this.identityClient.send({ cmd: 'update_user_risk' }, { id, score }));
  }

  // Application Discovery Routes
  @Get('applications')
  @Roles('admin')
  getApplications() {
    return firstValueFrom(this.discoveryClient.send({ cmd: 'get_all_apps' }, {}));
  }

  @Post('discovery/scan')
  @Roles('admin')
  triggerScan(@Body() data: ScanRequestDto) {
    return firstValueFrom(this.discoveryClient.send({ cmd: 'trigger_scan' }, data));
  }

  // Risk Engine Routes
  @Get('risk/scores')
  @Roles('admin')
  getRiskScores() {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_scores' }, {}));
  }

  @Get('risk/events')
  @Roles('admin')
  getRiskEvents() {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_events' }, {}));
  }

  // Governance Routes
  @Get('governance/workflows')
  @Roles('admin')
  getWorkflows() {
    return firstValueFrom(this.governanceClient.send({ cmd: 'get_all_workflows' }, {}));
  }

  @Post('governance/workflows')
  @Roles('admin')
  createWorkflow(@Body() data: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'create_workflow' }, data));
  }

  @Post('governance/workflows/:id/action')
  @Roles('admin')
  updateWorkflow(@Param('id') id: string, @Body() data: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'update_workflow' }, { id, ...data }));
  }

  // Graph Visualization Routes
  @Get('graph/identity/:id')
  @Roles('admin')
  getIdentityGraph(@Param('id') id: string) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_identity_graph' }, { id }));
  }

  // Policy Engine Routes
  @Post('policies/check')
  @Roles('admin', 'user')
  checkPolicy(@Body() data: any) {
    return firstValueFrom(this.policyClient.send({ cmd: 'check_policy' }, data));
  }

  @Get('policies')
  @Roles('admin')
  getPolicies() {
    return firstValueFrom(this.policyClient.send({ cmd: 'get_policies' }, {}));
  }

  // Audit Routes
  @Get('audit/logs')
  @Roles('admin')
  getAuditLogs() {
    return firstValueFrom(this.auditClient.send({ cmd: 'get_audit_logs' }, {}));
  }

  // Notification Routes
  @Post('notifications/send')
  @Roles('admin')
  sendNotification(@Body() data: SendNotificationDto) {
    return firstValueFrom(this.notificationClient.send({ cmd: 'send_notification' }, data));
  }

  // Worker Queue Routes
  @Post('jobs')
  @Roles('admin')
  enqueueJob(@Body() data: EnqueueJobDto) {
    return firstValueFrom(this.workerClient.send({ cmd: 'enqueue_job' }, data));
  }

  @Get('jobs/:id')
  @Roles('admin')
  getJobStatus(@Param('id') id: string) {
    return firstValueFrom(this.workerClient.send({ cmd: 'get_job_status' }, { jobId: id }));
  }

  // Dashboard Analytics Summary
  @Get('dashboard/summary')
  @Roles('admin')
  getDashboardSummary() {
    return {
      identities: { total: 14832, privileged: 1247, highRisk: 347, serviceAccounts: 614 },
      applications: { total: 284, managed: 261, shadowIT: 23, critical: 18 },
      threats: { active: 2, investigating: 1, contained: 1, resolved89d: 89 },
      riskScore: { current: 72, trend: 'increasing', target: 45, change: 4 },
      compliance: { soc2: 87, iso27001: 79, nistCsf: 73 },
      posture: { overall: 66, mfaCoverage: 94, leastPrivilege: 62, pamCoverage: 79 },
      pendingApprovals: 12, slaBreaches: 3, certificationProgress: 68,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ITDR - Threat Detection
  @Get('itdr/threats')
  @Roles('admin')
  getThreats() {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_itdr_threats' }, {}));
  }

  @Post('itdr/threats/:id/respond')
  @Roles('admin')
  respondToThreat(@Param('id') id: string, @Body() data: any) {
    return firstValueFrom(this.riskClient.send({ cmd: 'respond_to_threat' }, { id, ...data }));
  }

  // Analytics endpoints
  @Get('analytics/risk-trends')
  @Roles('admin')
  getRiskTrends() {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_risk_trends' }, {}));
  }

  @Get('analytics/identity-summary')
  @Roles('admin')
  getIdentitySummary() {
    return firstValueFrom(this.identityClient.send({ cmd: 'get_identity_analytics' }, {}));
  }

  @Get('analytics/app-intelligence')
  @Roles('admin')
  getAppIntelligence() {
    return firstValueFrom(this.discoveryClient.send({ cmd: 'get_app_intelligence' }, {}));
  }

  // Compliance endpoints
  @Get('compliance/metrics')
  @Roles('admin')
  getComplianceMetrics() {
    return {
      frameworks: [
        { id: 'soc2', name: 'SOC 2 Type II', score: 87, controls: 64, passing: 56, failing: 4 },
        { id: 'iso27001', name: 'ISO 27001:2022', score: 79, controls: 93, passing: 74, failing: 12 },
        { id: 'nist', name: 'NIST CSF 2.0', score: 73, controls: 108, passing: 79, failing: 18 },
      ],
      policyViolations: 6,
      openFindings: 24,
      lastAssessment: new Date().toISOString(),
    };
  }

  @Get('compliance/policy-violations')
  @Roles('admin')
  getPolicyViolations() {
    return firstValueFrom(this.policyClient.send({ cmd: 'get_policy_violations' }, {}));
  }

  // Posture/ISPM endpoints
  @Get('posture/score')
  @Roles('admin')
  getPostureScore() {
    return {
      overall: 66,
      domains: [
        { domain: 'Least Privilege', score: 62, findings: 634 },
        { domain: 'MFA Coverage', score: 94, findings: 245 },
        { domain: 'PAM', score: 71, findings: 43 },
        { domain: 'Identity Governance', score: 68, findings: 456 },
        { domain: 'Service Accounts', score: 55, findings: 59 },
        { domain: 'Shadow IT', score: 43, findings: 309 },
      ],
      totalFindings: 876,
      critical: 4,
      lastScan: new Date().toISOString(),
    };
  }

  // Identity lifecycle (JML)
  @Get('governance/jml')
  @Roles('admin')
  getJMLEvents() {
    return firstValueFrom(this.governanceClient.send({ cmd: 'get_jml_events' }, {}));
  }

  @Post('governance/jml')
  @Roles('admin')
  createJMLEvent(@Body() data: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'create_jml_event' }, data));
  }

  // Graph - toxic combinations and attack paths
  @Get('graph/toxic-combinations')
  @Roles('admin')
  getToxicCombinations() {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_toxic_combinations' }, {}));
  }

  @Get('graph/attack-paths')
  @Roles('admin')
  getAttackPaths() {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_attack_paths' }, {}));
  }
}
