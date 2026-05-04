import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('processed_events')
export class ProcessedEventEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'event_id', type: 'varchar', length: 36, unique: true })
  @Index()
  eventId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 255 })
  eventType!: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt!: Date;
}
