import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MovieEntity } from './entities/movie.entity';
import { ShowtimeEntity } from './entities/showtime.entity';
import { MovieService } from './services/movie.service';
import { MovieController } from './controllers/movie.controller';
import {
  OutboxModule,
  OutboxEntity,
  ProcessedEventEntity,
  JwtAuthGuard,
  RolesGuard,
} from '@app/common';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovieEntity, ShowtimeEntity, OutboxEntity, ProcessedEventEntity]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'movie-booking-jwt-secret-key-2026',
      signOptions: { expiresIn: '24h' },
    }),
    OutboxModule,
  ],
  controllers: [MovieController],
  providers: [MovieService, JwtAuthGuard, RolesGuard, Reflector],
})
export class MovieModule {}
