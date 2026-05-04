import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { PaymentService } from '../services/payment.service';
import {
  KAFKA_TOPICS,
  EVENT_TYPES,
  IdempotencyService,
  SeatsReservedPayload,
} from '@app/common';

@Controller()
export class PaymentKafkaConsumer {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @EventPattern(KAFKA_TOPICS.SEAT_EVENTS)
  async handleSeatEvents(@Payload() payload: unknown, @Ctx() context: KafkaContext) {
    await this.handleMessage(payload, context);
  }

  private async handleMessage(rawPayload: unknown, context: KafkaContext) {
    const message = context.getMessage();

    try {
      const messageBody = this.normalizePayload(rawPayload);
      const headers = Object.fromEntries(
        Object.entries(message.headers || {}).map(([key, value]) => [
          key,
          value == null
            ? undefined
            : Buffer.isBuffer(value)
              ? value.toString()
              : String(value),
        ]),
      ) as Record<string, string | undefined>;

      const eventType = headers['eventType'] as string;
      const eventId = headers['id'];
      const eventPayload = messageBody.payload || messageBody;

      if (!eventType || !eventId) return;

      if (eventType !== EVENT_TYPES.SEATS_RESERVED) return;

      await this.idempotencyService.processWithIdempotency(
        eventId,
        eventType,
        async () => {
          await this.paymentService.processPayment(eventPayload as SeatsReservedPayload);
        },
      );
    } catch {}
  }

  private normalizePayload(rawPayload: unknown): Record<string, any> {
    if (Buffer.isBuffer(rawPayload)) return JSON.parse(rawPayload.toString());
    if (typeof rawPayload === 'string') return JSON.parse(rawPayload);
    if (rawPayload && typeof rawPayload === 'object')
      return rawPayload as Record<string, any>;
    return {};
  }
}
