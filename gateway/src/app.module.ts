import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayController } from './gateway.controller';
import { MetricsModule, SERVICE_NAMES } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    MetricsModule.forRoot(SERVICE_NAMES.GATEWAY),
  ],
  controllers: [GatewayController],
})
export class AppModule {}
