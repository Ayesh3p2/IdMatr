import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'idmatr-control-plane',
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

@Global()
@Module({
  providers: [],
  exports: [],
})
export class TracingModule implements OnModuleInit {
  private readonly logger = new Logger(TracingModule.name);

  async onModuleInit() {
    if (process.env.ENABLE_TRACING !== 'false') {
      try {
        sdk.start();
        this.logger.log('OpenTelemetry tracing started');
      } catch (error) {
        this.logger.warn('Failed to start OpenTelemetry tracing:', error);
      }
    } else {
      this.logger.log('OpenTelemetry tracing disabled');
    }
  }
}
