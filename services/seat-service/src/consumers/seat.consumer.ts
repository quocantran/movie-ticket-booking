import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { SeatService } from '../services/seat.service';
import {
  KAFKA_TOPICS,
  EVENT_TYPES,
  IdempotencyService,
  BookingCreatedPayload,
  PaymentFailedPayload,
  PaymentProcessedPayload,
} from '@app/common';

@Controller()
export class SeatKafkaConsumer {
  constructor(
    private readonly seatService: SeatService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @EventPattern(KAFKA_TOPICS.BOOKING_EVENTS)
  async handleBookingEvents(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleMessage(payload, context);
  }

  @EventPattern(KAFKA_TOPICS.PAYMENT_EVENTS)
  async handlePaymentEvents(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ) {
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

      const relevantEvents = [
        EVENT_TYPES.BOOKING_CREATED,
        EVENT_TYPES.PAYMENT_PROCESSED,
        EVENT_TYPES.PAYMENT_FAILED,
      ];
      if (!(relevantEvents as readonly string[]).includes(eventType)) return;

      await this.idempotencyService.processWithIdempotency(
        eventId,
        eventType,
        async () => {
          switch (eventType) {
            case EVENT_TYPES.BOOKING_CREATED:
              await this.seatService.reserveSeatsWithLock(
                eventPayload as BookingCreatedPayload,
              );
              break;
            case EVENT_TYPES.PAYMENT_PROCESSED:
              await this.seatService.confirmSeats(
                (eventPayload as PaymentProcessedPayload).bookingId,
              );
              break;
            case EVENT_TYPES.PAYMENT_FAILED: {
              const p = eventPayload as PaymentFailedPayload;
              await this.seatService.compensateSeats(
                p.bookingId,
                p.showtimeId,
                p.seatIds,
                p.reason,
              );
              break;
            }
          }
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
