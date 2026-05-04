import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { RecommenderService } from '../services/recommender.service';
import {
  KAFKA_TOPICS,
  EVENT_TYPES,
  IdempotencyService,
} from '@app/common';

interface MovieCreatedPayload {
  movieId: string;
  title: string;
  genre: string;
  description: string;
  duration: number;
  posterUrl?: string;
}

interface BookingConfirmedPayload {
  bookingId: string;
  userId: string;
  movieId: string;
  showtimeId: string;
  seatIds: string[];
  status: string;
}

@Controller()
export class RecommenderKafkaConsumer {
  constructor(
    private readonly recommenderService: RecommenderService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @EventPattern(KAFKA_TOPICS.MOVIE_EVENTS)
  async handleMovieEvents(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleMessage(payload, context);
  }

  @EventPattern(KAFKA_TOPICS.BOOKING_EVENTS)
  async handleBookingEvents(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleMessage(payload, context);
  }

  private async handleMessage(rawPayload: unknown, context: KafkaContext) {
    const topic = context.getTopic();
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
      const payload = messageBody.payload || messageBody;

      if (!eventType || !eventId) {
        return;
      }

      if (
        eventType !== EVENT_TYPES.MOVIE_CREATED &&
        eventType !== EVENT_TYPES.BOOKING_CONFIRMED
      ) {
        return;
      }

      await this.idempotencyService.processWithIdempotency(
        eventId,
        eventType,
        async () => {
          if (eventType === EVENT_TYPES.MOVIE_CREATED) {
            await this.handleMovieCreated(payload as MovieCreatedPayload);
          } else if (eventType === EVENT_TYPES.BOOKING_CONFIRMED) {
            await this.handleBookingConfirmed(payload as BookingConfirmedPayload);
          }
        },
      );
    } catch {
    }
  }

  private normalizePayload(rawPayload: unknown): Record<string, any> {
    if (Buffer.isBuffer(rawPayload)) {
      return JSON.parse(rawPayload.toString());
    }
    if (typeof rawPayload === 'string') {
      return JSON.parse(rawPayload);
    }
    if (rawPayload && typeof rawPayload === 'object') {
      return rawPayload as Record<string, any>;
    }
    return {};
  }

  private async handleMovieCreated(payload: MovieCreatedPayload) {
    await this.recommenderService.generateAndSaveEmbedding(
      payload.movieId,
      payload.title,
      payload.genre,
      payload.description,
    );
  }

  private async handleBookingConfirmed(payload: BookingConfirmedPayload) {
    const { userId, movieId, bookingId } = payload;

    if (!userId) {
      return;
    }

    await this.recommenderService.saveUserBehavior(userId, movieId);
  }
}
