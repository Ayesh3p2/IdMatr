import {
  Controller, Get, Post, Body, Param, UseGuards, Inject, Req, Res, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { AppService } from './app.service';
import { ScanRequestDto } from './dto/scan-request.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { EnqueueJobDto } from './dto/enqueue-job.dto';
import { buildClearedCookie, buildSessionCookie, TENANT_ADMIN_ROLE } from './security';
import {
  AcceptPrivacyNoticeDto,
  ChangePasswordDto,
  CompleteOnboardingDto,
  DeletePrivacyDto,
  MfaCodeDto,
  PrivacyConsentDto,
  RectifyPrivacyDto,
  TenantLoginDto,
} from './dto/auth.dto';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
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

  // ── Auth (no JWT guard) ────────────────────────────────────────────────────

  /** Public health check — no auth required */
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
  }

  /** Login — returns JWT access_token.
   *  Uses a permissive per-route pipe so the global whitelist validator
   *  doesn't reject undecorated body fields on this public endpoint.
   */
  @Post('auth/login')
  async login(
    @Body() dto: TenantLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.appService.login(dto.email, dto.password, {
      tenantSlug: dto.tenantSlug,
      tenantId: dto.tenantId,
      totpCode: dto.totpCode,
      ipAddress,
      userAgent,
    });
    res.setHeader('Set-Cookie', buildSessionCookie(result.access_token));
    await this.writeAuditEvent({
      tenantId: result.user.tenantId || 'system',
      actorId: result.user.id,
      actorType: result.user.userType || 'tenant_user',
      action: 'auth.login',
      targetId: result.user.id,
      targetType: 'session',
      details: { email: result.user.email },
      ipAddress,
      userAgent,
    });
    return { user: result.user };
  }

  /** Current user — requires JWT */
  @Get('auth/me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: any) {
    return this.appService.getCurrentUser(req.user);
  }

  /** Change password — for tenant users who must change on first login.
   *  System admin (env-var based) cannot use this endpoint.
   */
  @Post('auth/change-password')
  @UseGuards(AuthGuard('jwt'))
  changePassword(
    @Req() req: any,
    @Body() dto: ChangePasswordDto,
  ) {
    const userId = req.user.userId;
    return this.appService.changePassword(userId, dto.currentPassword, dto.newPassword, req.ip, req.headers['user-agent']);
  }

  @Post('auth/logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Res({ passthrough: true }) res: Response) {
    await this.appService.logout();
    res.setHeader('Set-Cookie', buildClearedCookie());
    return { success: true };
  }

  @Post('auth/onboarding/complete')
  async completeOnboarding(
    @Body() dto: CompleteOnboardingDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.appService.completeOnboarding(dto.token, dto.newPassword, ipAddress, userAgent);
    res.setHeader('Set-Cookie', buildSessionCookie(result.access_token));
    await this.writeAuditEvent({
      tenantId: result.user.tenantId || 'system',
      actorId: result.user.id,
      actorType: 'tenant_user',
      action: 'auth.onboarding_completed',
      targetId: result.user.id,
      targetType: 'tenant_user',
      details: { email: result.user.email },
      ipAddress,
      userAgent,
    });
    return { user: result.user };
  }

  @Get('auth/mfa/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(TENANT_ADMIN_ROLE)
  getMfaStatus(@Req() req: any) {
    return this.appService.getTenantMfaStatus(req.user.userId);
  }

  @Post('auth/mfa/setup')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(TENANT_ADMIN_ROLE)
  setupMfa(@Req() req: any) {
    return this.appService.setupTenantMfa(req.user.userId);
  }

  @Post('auth/mfa/enable')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(TENANT_ADMIN_ROLE)
  enableMfa(@Req() req: any, @Body() dto: MfaCodeDto) {
    return this.appService.enableTenantMfa(req.user.userId, dto.code);
  }

  @Post('auth/mfa/disable')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(TENANT_ADMIN_ROLE)
  disableMfa(@Req() req: any, @Body() dto: MfaCodeDto) {
    return this.appService.disableTenantMfa(req.user.userId, dto.code);
  }

  @Get('privacy/notice')
  @UseGuards(AuthGuard('jwt'))
  getPrivacyNotice(@Req() req: any) {
    return this.appService.getPrivacyNotice(req.tenantId);
  }

  @Post('privacy/notice/accept')
  @UseGuards(AuthGuard('jwt'))
  acceptPrivacyNotice(@Req() req: any, @Body() dto: AcceptPrivacyNoticeDto) {
    return this.appService.acceptPrivacyNotice(
      req.tenantId,
      req.user.userId,
      dto.privacyNoticeId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('privacy/consents')
  @UseGuards(AuthGuard('jwt'))
  getPrivacyConsents(@Req() req: any) {
    return this.appService.listPrivacyConsents(req.tenantId, req.user.userId);
  }

  @Post('privacy/consents')
  @UseGuards(AuthGuard('jwt'))
  recordPrivacyConsent(@Req() req: any, @Body() dto: PrivacyConsentDto) {
    return this.appService.recordPrivacyConsent(
      req.tenantId,
      req.user.userId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('privacy/me/export')
  @UseGuards(AuthGuard('jwt'))
  exportMyData(@Req() req: any) {
    return this.appService.exportMyData(req.tenantId, req.user.userId);
  }

  @Post('privacy/me/rectify')
  @UseGuards(AuthGuard('jwt'))
  rectifyMyData(@Req() req: any, @Body() dto: RectifyPrivacyDto) {
    return this.appService.rectifyMyData(
      req.tenantId,
      req.user.userId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('privacy/me/delete')
  @UseGuards(AuthGuard('jwt'))
  deleteMyData(@Req() req: any, @Body() dto: DeletePrivacyDto) {
    return this.appService.deleteMyData(
      req.tenantId,
      req.user.userId,
      dto.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  private async writeAuditEvent(event: {
    tenantId: string;
    actorId: string;
    actorType: string;
    action: string;
    targetId: string;
    targetType: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await firstValueFrom(this.auditClient.send({ cmd: 'log_action' }, event)).catch(() => undefined);
  }

  // ── Identity Routes ────────────────────────────────────────────────────────

  @Get('identities')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getIdentities(@Req() req: any) {
    return firstValueFrom(this.identityClient.send({ cmd: 'get_all_identities' }, { tenantId: req.tenantId }));
  }

  @Get('identities/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getIdentity(@Param('id') id: string, @Req() req: any) {
    return firstValueFrom(this.identityClient.send({ cmd: 'get_identity' }, { id, tenantId: req.tenantId }));
  }

  @Post('identities')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  createUser(@Body() data: any, @Req() req: any) {
    return firstValueFrom(this.identityClient.send({ cmd: 'create_user' }, { ...data, tenantId: req.tenantId }));
  }

  @Post('identities/:id/risk')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  updateUserRisk(@Param('id') id: string, @Body('score') score: number, @Req() req: any) {
    return firstValueFrom(this.identityClient.send({ cmd: 'update_user_risk' }, { id, score, tenantId: req.tenantId }));
  }

  // ── Application Discovery Routes ───────────────────────────────────────────

  @Get('applications')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getApplications(@Req() req: any) {
    return firstValueFrom(this.discoveryClient.send({ cmd: 'get_all_apps' }, { tenantId: req.tenantId }));
  }

  @Post('discovery/scan')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  triggerScan(@Body() data: ScanRequestDto, @Req() req: any) {
    return firstValueFrom(this.discoveryClient.send({ cmd: 'trigger_scan' }, { ...data, tenantId: req.tenantId }));
  }

  // ── Risk Engine Routes ─────────────────────────────────────────────────────

  @Get('risk/scores')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getRiskScores(@Req() req: any) {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_scores' }, { tenantId: req.tenantId }));
  }

  @Get('risk/events')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getRiskEvents(@Req() req: any) {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_events' }, { tenantId: req.tenantId }));
  }

  // ── Governance Routes ──────────────────────────────────────────────────────

  @Get('governance/workflows')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getWorkflows(@Req() req: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'get_all_workflows' }, { tenantId: req.tenantId }));
  }

  @Post('governance/workflows')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  createWorkflow(@Body() data: any, @Req() req: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'create_workflow' }, { ...data, tenantId: req.tenantId }));
  }

  @Post('governance/workflows/:id/action')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  updateWorkflow(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'update_workflow' }, { id, ...data, tenantId: req.tenantId }));
  }

  @Get('governance/jml')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getJMLEvents(@Req() req: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'get_jml_events' }, { tenantId: req.tenantId }));
  }

  @Post('governance/jml')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  createJMLEvent(@Body() data: any, @Req() req: any) {
    return firstValueFrom(this.governanceClient.send({ cmd: 'create_jml_event' }, { ...data, tenantId: req.tenantId }));
  }

  // ── Graph Routes — security-sensitive; analyst+ only ──────────────────────

  @Get('graph/identity/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getIdentityGraph(@Param('id') id: string, @Req() req: any) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_identity_graph' }, { id, tenantId: req.tenantId }));
  }

  @Get('graph/toxic-combinations')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getToxicCombinations(@Req() req: any) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_toxic_combinations' }, { tenantId: req.tenantId }));
  }

  @Get('graph/attack-paths')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getAttackPaths(@Req() req: any) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_attack_paths' }, { tenantId: req.tenantId }));
  }

  /** Privilege creep detection — users who have accumulated excessive roles over time */
  @Get('graph/privilege-creep')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getPrivilegeCreep(@Req() req: any) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_privilege_creep' }, { tenantId: req.tenantId }));
  }

  /** Stale access detection — accounts with no activity in 90+ days */
  @Get('graph/stale-access')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getStaleAccess(@Req() req: any) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_stale_access' }, { tenantId: req.tenantId }));
  }

  /** AI-native identity risk recommendations based on graph analysis */
  @Get('graph/risk-recommendations')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getIdentityRiskRecommendations(@Req() req: any) {
    return firstValueFrom(this.graphClient.send({ cmd: 'get_identity_risk_recommendations' }, { tenantId: req.tenantId }));
  }

  // ── Policy Engine Routes ───────────────────────────────────────────────────

  @Post('policies/check')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('readonly')
  checkPolicy(@Body() data: any, @Req() req: any) {
    return firstValueFrom(this.policyClient.send({ cmd: 'check_policy' }, { ...data, tenantId: req.tenantId }));
  }

  @Get('policies')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getPolicies(@Req() req: any) {
    return firstValueFrom(this.policyClient.send({ cmd: 'get_policies' }, { tenantId: req.tenantId }));
  }

  // ── Audit Routes — admin only ──────────────────────────────────────────────

  @Get('audit/logs')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  getAuditLogs(@Req() req: any) {
    return firstValueFrom(this.auditClient.send({ cmd: 'get_audit_logs' }, { tenantId: req.tenantId }));
  }

  /** Verify tamper-evident hash-chain integrity for this tenant's audit log. */
  @Get('audit/verify')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  verifyAuditIntegrity(@Req() req: any) {
    return firstValueFrom(this.auditClient.send({ cmd: 'verify_audit_logs' }, { tenantId: req.tenantId }));
  }

  // ── Notification Routes ────────────────────────────────────────────────────

  @Post('notifications/send')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  sendNotification(@Body() data: SendNotificationDto, @Req() req: any) {
    return firstValueFrom(this.notificationClient.send({ cmd: 'send_notification' }, { ...data, tenantId: req.tenantId }));
  }

  // ── Worker Queue Routes ────────────────────────────────────────────────────

  @Post('jobs')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  enqueueJob(@Body() data: EnqueueJobDto, @Req() req: any) {
    return firstValueFrom(this.workerClient.send({ cmd: 'enqueue_job' }, { ...data, tenantId: req.tenantId }));
  }

  @Get('jobs/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getJobStatus(@Param('id') id: string, @Req() req: any) {
    return firstValueFrom(this.workerClient.send({ cmd: 'get_job_status' }, { jobId: id, tenantId: req.tenantId }));
  }

  // ── Aggregated Dashboard Summary ───────────────────────────────────────────
  /**
   * Fetches real data from all microservices and returns aggregated KPIs.
   * Falls back to zeros on any service failure (graceful degradation).
   * All queries are scoped to the authenticated tenant — no cross-tenant exposure.
   */
  @Get('dashboard/summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  async getDashboardSummary(@Req() req: any) {
    const tenantId = req.tenantId;
    const [identityResult, appResult, threatResult, riskResult, workflowResult] =
      await Promise.allSettled([
        firstValueFrom(this.identityClient.send({ cmd: 'get_identity_analytics' }, { tenantId })),
        firstValueFrom(this.discoveryClient.send({ cmd: 'get_app_intelligence' }, { tenantId })),
        firstValueFrom(this.riskClient.send({ cmd: 'get_itdr_threats' }, { tenantId })),
        firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_scores' }, { tenantId })),
        firstValueFrom(this.governanceClient.send({ cmd: 'get_all_workflows' }, { tenantId })),
      ]);

    const identity = identityResult.status === 'fulfilled' ? identityResult.value as any : {};
    const apps = appResult.status === 'fulfilled' ? appResult.value as any : {};
    const threats = threatResult.status === 'fulfilled' ? (threatResult.value as any[]) : [];
    const riskScores = riskResult.status === 'fulfilled' ? (riskResult.value as any[]) : [];
    const workflows = workflowResult.status === 'fulfilled' ? (workflowResult.value as any[]) : [];

    const avgRisk = riskScores.length
      ? Math.round(riskScores.reduce((s: number, r: any) => s + (r.currentScore || 0), 0) / riskScores.length)
      : 0;

    const highRiskCount = riskScores.filter((r: any) => (r.currentScore || 0) >= 60).length;
    const pendingApprovals = workflows.filter((w: any) => w.status === 'pending').length;
    const activeThreats = threats.filter((t: any) => t.status === 'Active').length;

    return {
      identities: {
        total: identity.total || 0,
        privileged: identity.privileged || 0,
        highRisk: highRiskCount,
        serviceAccounts: identity.serviceAccounts || 0,
      },
      applications: {
        total: apps.total || 0,
        managed: apps.managed || 0,
        shadowIT: apps.shadowIT || 0,
        critical: apps.critical || 0,
      },
      threats: {
        active: activeThreats,
        investigating: threats.filter((t: any) => t.status === 'Investigating').length,
        contained: threats.filter((t: any) => t.status === 'Contained').length,
      },
      riskScore: {
        current: avgRisk,
        trend: avgRisk > 50 ? 'elevated' : avgRisk > 30 ? 'moderate' : 'low',
      },
      pendingApprovals,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── ITDR — analyst+ for read, admin for action ─────────────────────────────

  @Get('itdr/threats')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getThreats(@Req() req: any) {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_itdr_threats' }, { tenantId: req.tenantId }));
  }

  @Post('itdr/threats/:id/respond')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')
  respondToThreat(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return firstValueFrom(this.riskClient.send({ cmd: 'respond_to_threat' }, { id, ...data, tenantId: req.tenantId }));
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  @Get('analytics/risk-trends')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getRiskTrends(@Req() req: any) {
    return firstValueFrom(this.riskClient.send({ cmd: 'get_risk_trends' }, { tenantId: req.tenantId }));
  }

  @Get('analytics/identity-summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getIdentitySummary(@Req() req: any) {
    return firstValueFrom(this.identityClient.send({ cmd: 'get_identity_analytics' }, { tenantId: req.tenantId }));
  }

  @Get('analytics/app-intelligence')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getAppIntelligence(@Req() req: any) {
    return firstValueFrom(this.discoveryClient.send({ cmd: 'get_app_intelligence' }, { tenantId: req.tenantId }));
  }

  // ── Compliance ─────────────────────────────────────────────────────────────

  @Get('compliance/metrics')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  async getComplianceMetrics(@Req() req: any) {
    const tenantId = req.tenantId;
    const [violations, riskScores] = await Promise.allSettled([
      firstValueFrom(this.policyClient.send({ cmd: 'get_policy_violations' }, { tenantId })),
      firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_scores' }, { tenantId })),
    ]);

    const violationList = violations.status === 'fulfilled' ? (violations.value as any[]) : [];
    const scores = riskScores.status === 'fulfilled' ? (riskScores.value as any[]) : [];

    const criticalRisk = scores.filter((s: any) => (s.currentScore || 0) >= 80).length;
    const highRisk = scores.filter((s: any) => (s.currentScore || 0) >= 60 && (s.currentScore || 0) < 80).length;
    const openFindings = criticalRisk + highRisk;

    return {
      frameworks: [
        {
          id: 'soc2',
          name: 'SOC 2 Type II',
          score: openFindings === 0 ? 100 : Math.max(0, 100 - openFindings * 2),
          controls: 64,
          passing: Math.max(0, 64 - openFindings),
          failing: Math.min(64, openFindings),
        },
        {
          id: 'iso27001',
          name: 'ISO 27001:2022',
          score: openFindings === 0 ? 100 : Math.max(0, 100 - openFindings * 3),
          controls: 93,
          passing: Math.max(0, 93 - openFindings),
          failing: Math.min(93, openFindings),
        },
        {
          id: 'nist',
          name: 'NIST CSF 2.0',
          score: openFindings === 0 ? 100 : Math.max(0, 100 - openFindings * 2),
          controls: 108,
          passing: Math.max(0, 108 - openFindings),
          failing: Math.min(108, openFindings),
        },
      ],
      policyViolations: violationList.length,
      openFindings,
      lastAssessment: new Date().toISOString(),
    };
  }

  @Get('compliance/policy-violations')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  getPolicyViolations(@Req() req: any) {
    return firstValueFrom(this.policyClient.send({ cmd: 'get_policy_violations' }, { tenantId: req.tenantId }));
  }

  // ── Posture / ISPM ─────────────────────────────────────────────────────────

  @Get('posture/score')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('analyst')
  async getPostureScore(@Req() req: any) {
    const tenantId = req.tenantId;
    const [identityResult, appResult, riskResult] = await Promise.allSettled([
      firstValueFrom(this.identityClient.send({ cmd: 'get_identity_analytics' }, { tenantId })),
      firstValueFrom(this.discoveryClient.send({ cmd: 'get_app_intelligence' }, { tenantId })),
      firstValueFrom(this.riskClient.send({ cmd: 'get_all_risk_scores' }, { tenantId })),
    ]);

    const identity = identityResult.status === 'fulfilled' ? identityResult.value as any : {};
    const apps = appResult.status === 'fulfilled' ? appResult.value as any : {};
    const scores = riskResult.status === 'fulfilled' ? (riskResult.value as any[]) : [];

    const totalIdentities = identity.total || 1;
    const mfaEnabled = identity.mfaEnabled || 0;
    const mfaCoverage = totalIdentities > 0 ? Math.round((mfaEnabled / totalIdentities) * 100) : 0;

    const shadowIT = apps.shadowIT || 0;
    const totalApps = apps.total || 1;
    const shadowITRatio = totalApps > 0 ? Math.round(((totalApps - shadowIT) / totalApps) * 100) : 100;

    const criticalRisk = scores.filter((s: any) => (s.currentScore || 0) >= 80).length;
    const totalScores = scores.length || 1;
    const leastPrivilege = Math.max(0, 100 - Math.round((criticalRisk / totalScores) * 100));

    const overall = Math.round((mfaCoverage + shadowITRatio + leastPrivilege) / 3);

    const totalFindings = criticalRisk + (scores.filter((s: any) => (s.currentScore || 0) >= 60).length);

    return {
      overall,
      domains: [
        { domain: 'MFA Coverage', score: mfaCoverage, findings: totalIdentities - mfaEnabled },
        { domain: 'Shadow IT Control', score: shadowITRatio, findings: shadowIT },
        { domain: 'Least Privilege', score: leastPrivilege, findings: criticalRisk },
        { domain: 'Identity Governance', score: identity.governanceScore || 0, findings: 0 },
        { domain: 'Service Accounts', score: identity.serviceAccountScore || 0, findings: identity.serviceAccounts || 0 },
      ],
      totalFindings,
      critical: criticalRisk,
      lastScan: new Date().toISOString(),
    };
  }
}
