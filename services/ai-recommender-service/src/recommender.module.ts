import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MovieEmbeddingEntity } from './entities/movie-embedding.entity';
import { UserBehaviorEntity } from './entities/user-behavior.entity';
import { EmbeddingService } from './services/embedding.service';
import { RecommenderService } from './services/recommender.service';
import { RecommenderController } from './controllers/recommender.controller';
import { RecommenderKafkaConsumer } from './consumers/recommender.consumer';
import {
  ProcessedEventEntity,
  IdempotencyService,
  JwtAuthGuard,
} from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MovieEmbeddingEntity,
      UserBehaviorEntity,
      ProcessedEventEntity,
    ]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'movie-booking-jwt-secret-key-2026',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [RecommenderController, RecommenderKafkaConsumer],
  providers: [EmbeddingService, RecommenderService, IdempotencyService, JwtAuthGuard],
})
export class RecommenderModule {}
