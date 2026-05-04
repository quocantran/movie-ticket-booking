import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { BookingService } from '../services/booking.service';
import {
  KAFKA_TOPICS,
  EVENT_TYPES,
  IdempotencyService,
  SeatsReservedPayload,
  SeatReservationFailedPayload,
  PaymentProcessedPayload,
  PaymentFailedPayload,
  SeatsCompensatedPayload,
} from '@app/common';

@Controller()
export class BookingKafkaConsumer {
  constructor(
    private readonly bookingService: BookingService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @EventPattern(KAFKA_TOPICS.SEAT_EVENTS)
  async handleSeatEvents(
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
        EVENT_TYPES.SEATS_RESERVED,
        EVENT_TYPES.SEAT_RESERVATION_FAILED,
        EVENT_TYPES.PAYMENT_PROCESSED,
        EVENT_TYPES.PAYMENT_FAILED,
        EVENT_TYPES.SEATS_COMPENSATED,
      ];
      if (!(relevantEvents as readonly string[]).includes(eventType)) return;

      await this.idempotencyService.processWithIdempotency(
        eventId,
        eventType,
        async () => {
          switch (eventType) {
            case EVENT_TYPES.SEATS_RESERVED:
              await this.bookingService.handleSeatsReserved(
                eventPayload as SeatsReservedPayload,
              );
              break;
            case EVENT_TYPES.SEAT_RESERVATION_FAILED:
              await this.bookingService.handleSeatReservationFailed(
                eventPayload as SeatReservationFailedPayload,
              );
              break;
            case EVENT_TYPES.PAYMENT_PROCESSED:
              await this.bookingService.handlePaymentProcessed(
                eventPayload as PaymentProcessedPayload,
              );
              break;
            case EVENT_TYPES.PAYMENT_FAILED:
              await this.bookingService.handlePaymentFailed(
                eventPayload as PaymentFailedPayload,
              );
              break;
            case EVENT_TYPES.SEATS_COMPENSATED:
              await this.bookingService.handleSeatsCompensated(
                eventPayload as SeatsCompensatedPayload,
              );
              break;
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
