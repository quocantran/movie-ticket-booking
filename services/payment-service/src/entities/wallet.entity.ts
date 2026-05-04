import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallets')
export class WalletEntity {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
