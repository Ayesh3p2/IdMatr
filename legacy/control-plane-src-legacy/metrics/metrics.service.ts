import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;

  readonly httpRequestDuration: Histogram;
  readonly httpRequestTotal: Counter;
  readonly activeConnections: Gauge;
  readonly authLoginAttempts: Counter;
  readonly authLoginFailures: Counter;
  readonly tenantOperations: Counter;
  readonly errorRate: Counter;

  constructor() {
    this.registry = new Registry();

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      registers: [this.registry],
    });

    this.authLoginAttempts = new Counter({
      name: 'auth_login_attempts_total',
      help: 'Total number of login attempts',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.authLoginFailures = new Counter({
      name: 'auth_login_failures_total',
      help: 'Total number of login failures',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.tenantOperations = new Counter({
      name: 'tenant_operations_total',
      help: 'Total number of tenant operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });

    this.errorRate = new Counter({
      name: 'error_rate_total',
      help: 'Total number of errors',
      labelNames: ['service', 'error_type'],
      registers: [this.registry],
    });

    this.logger.log('Metrics initialized');
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
