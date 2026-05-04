import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('movie_embeddings')
export class MovieEmbeddingEntity {
  @PrimaryColumn({ name: 'movie_id', type: 'varchar', length: 36 })
  movieId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'json' })
  genres!: string[];

  @Column({ type: 'json' })
  embedding!: number[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
