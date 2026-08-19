import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService, METRICS_SERVICE_NAME } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsController } from './metrics.controller';

@Module({})
export class MetricsModule {
  /**
   * Register the metrics module for a specific service.
   * Usage: MetricsModule.forRoot('booking-service')
   */
  static forRoot(serviceName: string): DynamicModule {
    return {
      module: MetricsModule,
      controllers: [MetricsController],
      providers: [
        {
          provide: METRICS_SERVICE_NAME,
          useValue: serviceName,
        },
        MetricsService,
        {
          provide: APP_INTERCEPTOR,
          useClass: MetricsInterceptor,
        },
      ],
      exports: [MetricsService],
    };
  }
}
