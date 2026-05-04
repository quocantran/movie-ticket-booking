import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('showtimes')
@Index(['movieId'])
@Index(['startTime'])
export class ShowtimeEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'movie_id', type: 'varchar', length: 36 })
  movieId!: string;

  @Column({ type: 'varchar', length: 50 })
  hall!: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
