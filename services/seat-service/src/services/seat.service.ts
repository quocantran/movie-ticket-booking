import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SeatEntity, SeatStatus } from '../entities/seat.entity';
import {
  OutboxService,
  AGGREGATE_TYPES,
  EVENT_TYPES,
  BookingCreatedPayload,
  RedisLockService,
} from '@app/common';

const REDIS_LOCK_TTL_MS = 5000;
const SEAT_HOLD_MINUTES = 5;
const CLEANUP_INTERVAL_MS = 30_000;

@Injectable()
export class SeatService implements OnModuleInit {
  constructor(
    @InjectRepository(SeatEntity)
    private readonly seatRepository: Repository<SeatEntity>,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    private readonly redisLockService: RedisLockService,
  ) {}

  onModuleInit() {
    setInterval(() => this.cleanupExpiredHolds(), CLEANUP_INTERVAL_MS);
  }

  async findByShowtimeId(showtimeId: string): Promise<SeatEntity[]> {
    return this.seatRepository.find({
      where: { showtimeId },
      order: { seatRow: 'ASC', seatNumber: 'ASC' },
    });
  }

  async reserveSeatsWithLock(payload: BookingCreatedPayload): Promise<void> {
    const { bookingId, showtimeId, seatIds, userId, totalAmount } = payload;

    const lockKeys = seatIds.map(
      (seatId) => `lock:seat:${showtimeId}:${seatId}`,
    );

    const lockResult = await this.redisLockService.acquireMultipleLocks(
      lockKeys,
      REDIS_LOCK_TTL_MS,
    );

    if (!lockResult.success) {
      await this.emitReservationFailed(
        bookingId,
        showtimeId,
        seatIds,
        `Ghế đang được người khác đặt, vui lòng thử lại`,
      );
      return;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const seatRepo = manager.getRepository(SeatEntity);
        const expireAt = new Date(Date.now() + SEAT_HOLD_MINUTES * 60 * 1000);

        const updateResult = await seatRepo
          .createQueryBuilder()
          .update(SeatEntity)
          .set({
            status: SeatStatus.HELD,
            bookingId,
            expireAt,
          })
          .where('id IN (:...seatIds)', { seatIds })
          .andWhere('showtime_id = :showtimeId', { showtimeId })
          .andWhere('status = :available', { available: SeatStatus.AVAILABLE })
          .execute();

        if (updateResult.affected !== seatIds.length) {
          const heldCount = updateResult.affected || 0;
          if (heldCount > 0) {
            await seatRepo
              .createQueryBuilder()
              .update(SeatEntity)
              .set({
                status: SeatStatus.AVAILABLE,
                bookingId: null,
                expireAt: null,
              })
              .where('booking_id = :bookingId', { bookingId })
              .andWhere('status = :held', { held: SeatStatus.HELD })
              .execute();
          }
          throw new Error(
            `Một số ghế không khả dụng (yêu cầu ${seatIds.length}, khả dụng ${heldCount})`,
          );
        }

        await this.outboxService.createEventInTransaction(manager, {
          aggregateType: AGGREGATE_TYPES.SEAT,
          aggregateId: bookingId,
          eventType: EVENT_TYPES.SEATS_RESERVED,
          payload: {
            bookingId,
            userId,
            showtimeId,
            seatIds,
            totalAmount,
          },
        });
      });
    } catch (error) {
      await this.emitReservationFailed(
        bookingId,
        showtimeId,
        seatIds,
        (error as Error).message,
      );
    } finally {
      await this.redisLockService.releaseMultipleLocks(lockResult.tokens);
    }
  }

  async confirmSeats(bookingId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const seatRepo = manager.getRepository(SeatEntity);

      const result = await seatRepo
        .createQueryBuilder()
        .update(SeatEntity)
        .set({
          status: SeatStatus.BOOKED,
          expireAt: null,
        })
        .where('booking_id = :bookingId', { bookingId })
        .andWhere('status = :held', { held: SeatStatus.HELD })
        .andWhere('(expire_at IS NULL OR expire_at > NOW())')
        .execute();

      if ((result.affected || 0) === 0) return;

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.SEAT,
        aggregateId: bookingId,
        eventType: EVENT_TYPES.SEATS_RESERVED,
        payload: { bookingId, confirmed: true },
      });
    });
  }

  async compensateSeats(
    bookingId: string,
    showtimeId: string,
    seatIds: string[],
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const seatRepo = manager.getRepository(SeatEntity);

      await seatRepo
        .createQueryBuilder()
        .update(SeatEntity)
        .set({
          status: SeatStatus.AVAILABLE,
          bookingId: null,
          expireAt: null,
        })
        .where('id IN (:...seatIds)', { seatIds })
        .andWhere('booking_id = :bookingId', { bookingId })
        .execute();

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.SEAT,
        aggregateId: bookingId,
        eventType: EVENT_TYPES.SEATS_COMPENSATED,
        payload: { bookingId, showtimeId, seatIds, reason },
      });
    });
  }

  async generateSeatsForShowtime(
    showtimeId: string,
    rows: number = 5,
    cols: number = 8,
  ): Promise<SeatEntity[]> {
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, rows);
    const seats: SeatEntity[] = [];

    for (const row of rowLabels) {
      for (let col = 1; col <= cols; col++) {
        const seat = new SeatEntity();
        seat.id = `seat-${showtimeId}-${row}${col}`;
        seat.showtimeId = showtimeId;
        seat.seatNumber = `${row}${col}`;
        seat.seatRow = row;
        seat.status = SeatStatus.AVAILABLE;
        seat.bookingId = null;
        seat.expireAt = null;
        seats.push(seat);
      }
    }

    return this.seatRepository.save(seats);
  }

  private async cleanupExpiredHolds(): Promise<void> {
    try {
      await this.seatRepository
        .createQueryBuilder()
        .update(SeatEntity)
        .set({
          status: SeatStatus.AVAILABLE,
          bookingId: null,
          expireAt: null,
        })
        .where('status = :status', { status: SeatStatus.HELD })
        .andWhere('expire_at IS NOT NULL')
        .andWhere('expire_at < NOW()')
        .execute();
    } catch {}
  }

  private async emitReservationFailed(
    bookingId: string,
    showtimeId: string,
    seatIds: string[],
    reason: string,
  ): Promise<void> {
    await this.outboxService.createEvent({
      aggregateType: AGGREGATE_TYPES.SEAT,
      aggregateId: bookingId,
      eventType: EVENT_TYPES.SEAT_RESERVATION_FAILED,
      payload: { bookingId, showtimeId, seatIds, reason },
    });
  }
}
