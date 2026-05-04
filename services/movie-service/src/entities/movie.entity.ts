import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('movies')
export class MovieEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  genre!: string;

  @Column({ type: 'int' })
  duration!: number;

  @Column({ name: 'poster_url', type: 'varchar', length: 500, nullable: true })
  posterUrl!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
