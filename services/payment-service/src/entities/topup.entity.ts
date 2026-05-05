import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TopupStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

@Entity('topups')
@Index(['userId'])
@Index(['status'])
export class TopupEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'order_code', type: 'bigint', unique: true })
  orderCode!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({
    type: 'enum',
    enum: TopupStatus,
    default: TopupStatus.PENDING,
  })
  status!: TopupStatus;

  @Column({ name: 'checkout_url', type: 'varchar', length: 500, nullable: true })
  checkoutUrl!: string | null;

  @Column({ name: 'payment_link_id', type: 'varchar', length: 255, nullable: true })
  paymentLinkId!: string | null;

  @Column({ name: 'transaction_reference', type: 'varchar', length: 255, nullable: true })
  transactionReference!: string | null;

  @Column({ name: 'counter_account_bank_name', type: 'varchar', length: 255, nullable: true })
  counterAccountBankName!: string | null;

  @Column({ name: 'counter_account_name', type: 'varchar', length: 255, nullable: true })
  counterAccountName!: string | null;

  @Column({ name: 'counter_account_number', type: 'varchar', length: 255, nullable: true })
  counterAccountNumber!: string | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
