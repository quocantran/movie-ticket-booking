import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BookingEntity, BookingStatus } from '../entities/booking.entity';
import {
  OutboxService,
  AGGREGATE_TYPES,
  EVENT_TYPES,
  SeatsReservedPayload,
  SeatReservationFailedPayload,
  PaymentProcessedPayload,
  PaymentFailedPayload,
  SeatsCompensatedPayload,
} from '@app/common';

interface CreateBookingDto {
  userId: string;
  movieId: string;
  showtimeId: string;
  seatIds: string[];
  totalAmount: number;
}

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
  ) {}

  async createBooking(dto: CreateBookingDto): Promise<BookingEntity> {
    if (!dto.seatIds?.length) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 ghế');
    }

    const bookingId = uuidv4();

    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(BookingEntity);

      const booking = bookingRepo.create({
        id: bookingId,
        userId: dto.userId,
        movieId: dto.movieId,
        showtimeId: dto.showtimeId,
        seatIds: dto.seatIds,
        totalAmount: dto.totalAmount,
        status: BookingStatus.PENDING,
      });
      await bookingRepo.save(booking);

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.BOOKING,
        aggregateId: bookingId,
        eventType: EVENT_TYPES.BOOKING_CREATED,
        payload: {
          bookingId,
          userId: dto.userId,
          movieId: dto.movieId,
          showtimeId: dto.showtimeId,
          seatIds: dto.seatIds,
          totalAmount: dto.totalAmount,
        },
      });

      return booking;
    });
  }

  async getBookingsByUser(userId: string): Promise<BookingEntity[]> {
    return this.bookingRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getBookingById(id: string): Promise<BookingEntity> {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt vé: ${id}`);
    }
    return booking;
  }

  async handleSeatsReserved(payload: SeatsReservedPayload): Promise<void> {
    await this.bookingRepository.update(payload.bookingId, {
      status: BookingStatus.SEATS_RESERVED,
    });
  }

  async handleSeatReservationFailed(
    payload: SeatReservationFailedPayload,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(BookingEntity);

      await bookingRepo.update(payload.bookingId, {
        status: BookingStatus.CANCELLED,
        failureReason: payload.reason,
      });

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.BOOKING,
        aggregateId: payload.bookingId,
        eventType: EVENT_TYPES.BOOKING_CANCELLED,
        payload: {
          bookingId: payload.bookingId,
          reason: payload.reason,
          status: 'CANCELLED',
        },
      });
    });
  }

  async handlePaymentProcessed(
    payload: PaymentProcessedPayload,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(BookingEntity);

      const booking = await bookingRepo.findOne({
        where: { id: payload.bookingId },
      });
      if (!booking) return;

      await bookingRepo.update(payload.bookingId, {
        status: BookingStatus.CONFIRMED,
      });

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.BOOKING,
        aggregateId: payload.bookingId,
        eventType: EVENT_TYPES.BOOKING_CONFIRMED,
        payload: {
          bookingId: payload.bookingId,
          userId: booking.userId,
          movieId: booking.movieId,
          showtimeId: booking.showtimeId,
          seatIds: booking.seatIds,
          status: 'CONFIRMED',
        },
      });
    });
  }

  async handlePaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(BookingEntity);

      await bookingRepo.update(payload.bookingId, {
        status: BookingStatus.CANCELLED,
        failureReason: payload.reason,
      });

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.BOOKING,
        aggregateId: payload.bookingId,
        eventType: EVENT_TYPES.BOOKING_CANCELLED,
        payload: {
          bookingId: payload.bookingId,
          reason: payload.reason,
          status: 'CANCELLED',
        },
      });
    });
  }

  async handleSeatsCompensated(
    payload: SeatsCompensatedPayload,
  ): Promise<void> {
  }
}
