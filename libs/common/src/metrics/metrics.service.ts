import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  register,
} from 'prom-client';

export const METRICS_SERVICE_NAME = 'METRICS_SERVICE_NAME';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsTotal: Counter;

  constructor(
    @Inject(METRICS_SERVICE_NAME) private readonly serviceName: string,
  ) {
    this.registry = register;

    // HTTP request duration histogram (equivalent to Spring's http_server_requests_seconds_bucket)
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // HTTP requests total counter (equivalent to Spring's http_server_requests_seconds_count)
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect default Node.js metrics (CPU, memory, event loop lag, GC, etc.)
    collectDefaultMetrics({
      register: this.registry,
      labels: { service: this.serviceName },
    });
  }

  getServiceName(): string {
    return this.serviceName;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
