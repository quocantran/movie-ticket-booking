import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    // Skip metrics endpoint itself to avoid recursion
    if (request.url === '/metrics') {
      return next.handle();
    }

    const startTime = process.hrtime.bigint();
    const method = request.method;
    const route = request.route?.path || request.url?.split('?')[0] || 'unknown';
    const serviceName = this.metricsService.getServiceName();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode?.toString() || '200';
          this.recordMetrics(method, route, statusCode, serviceName, startTime);
        },
        error: (error) => {
          const statusCode = error.status?.toString() || error.getStatus?.()?.toString() || '500';
          this.recordMetrics(method, route, statusCode, serviceName, startTime);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: string,
    service: string,
    startTime: bigint,
  ) {
    const durationInSeconds =
      Number(process.hrtime.bigint() - startTime) / 1e9;

    this.metricsService.httpRequestDuration.observe(
      { method, route, status_code: statusCode, service },
      durationInSeconds,
    );

    this.metricsService.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
      service,
    });
  }
}
