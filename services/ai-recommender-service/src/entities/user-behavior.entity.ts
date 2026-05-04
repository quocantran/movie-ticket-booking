import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_behavior')
@Index(['userId'])
@Index(['movieId'])
@Index(['userId', 'movieId'])
export class UserBehaviorEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'movie_id', type: 'varchar', length: 36 })
  movieId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
