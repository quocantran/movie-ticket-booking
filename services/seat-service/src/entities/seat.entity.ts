import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  BOOKED = 'BOOKED',
}

@Entity('seats')
@Unique(['showtimeId', 'seatNumber'])
@Index(['showtimeId'])
@Index(['status'])
@Index(['showtimeId', 'id'])
export class SeatEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'showtime_id', type: 'varchar', length: 36 })
  showtimeId!: string;

  @Column({ name: 'seat_number', type: 'varchar', length: 10 })
  seatNumber!: string;

  @Column({ name: 'seat_row', type: 'varchar', length: 5 })
  seatRow!: string;

  @Column({
    type: 'enum',
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE,
  })
  status!: SeatStatus;

  @Column({ name: 'booking_id', type: 'varchar', length: 36, nullable: true })
  bookingId!: string | null;

  @Column({ name: 'expire_at', type: 'datetime', nullable: true })
  expireAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
