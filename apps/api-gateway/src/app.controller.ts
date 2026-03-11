import { Controller, Get, Post, Body, Param, UseGuards, Inject, SetMetadata } from '@nestjs/common';
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
  @SetMetadata('isPublic', true)
  getHealth() {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
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
}
