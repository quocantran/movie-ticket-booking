import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BookingStatus {
  PENDING = 'PENDING',
  SEATS_RESERVED = 'SEATS_RESERVED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('bookings')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class BookingEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'movie_id', type: 'varchar', length: 36 })
  movieId!: string;

  @Column({ name: 'showtime_id', type: 'varchar', length: 36 })
  showtimeId!: string;

  @Column({ name: 'seat_ids', type: 'json' })
  seatIds!: string[];

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({ name: 'failure_reason', type: 'varchar', length: 500, nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
