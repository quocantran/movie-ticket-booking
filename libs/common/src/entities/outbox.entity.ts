import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('outbox')
@Index(['aggregateType', 'aggregateId'])
@Index(['eventType'])
@Index(['processed'])
export class OutboxEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 255 })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 36 })
  aggregateId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 255 })
  eventType!: string;

  @Column({ type: 'json' })
  payload!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 6 })
  createdAt!: Date;

  @Column({ type: 'boolean', default: false })
  processed!: boolean;
}
