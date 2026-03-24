import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtStrategy } from './jwt.strategy';
import { TenantMiddleware } from './tenant.middleware';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ControlProxyController } from './control.controller';
import { getNatsConnectionOptions } from './security';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
        return {
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any },
        };
      },
    }),
    ClientsModule.register([
      { name: 'IDENTITY_SERVICE',     transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'DISCOVERY_SERVICE',    transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'GOVERNANCE_SERVICE',   transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'RISK_ENGINE',          transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'GRAPH_SERVICE',        transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'POLICY_ENGINE',        transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'AUDIT_SERVICE',        transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'NOTIFICATION_SERVICE', transport: Transport.NATS, options: getNatsConnectionOptions() },
      { name: 'WORKER_QUEUE',         transport: Transport.NATS, options: getNatsConnectionOptions() },
    ]),
  ],
  controllers: [AppController, SettingsController, ControlProxyController],
  providers: [
    AppService,
    JwtStrategy,
    SettingsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
