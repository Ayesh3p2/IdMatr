import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleConnector } from './connectors/google.connector';
import { MicrosoftConnector } from './connectors/microsoft.connector';
import { SlackConnector } from './connectors/slack.connector';
import { GitHubConnector } from './connectors/github.connector';
import { PrismaService } from './prisma.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    GoogleConnector,
    MicrosoftConnector,
    SlackConnector,
    GitHubConnector,
    PrismaService,
  ],
})
export class AppModule {}
