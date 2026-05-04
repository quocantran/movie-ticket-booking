import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { BookingEntity } from './entities/booking.entity';
import { BookingService } from './services/booking.service';
import { BookingController } from './controllers/booking.controller';
import { BookingKafkaConsumer } from './consumers/booking.consumer';
import {
  OutboxModule,
  OutboxEntity,
  ProcessedEventEntity,
  IdempotencyService,
  DebeziumConnectorService,
  JwtAuthGuard,
} from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingEntity, OutboxEntity, ProcessedEventEntity]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'movie-booking-jwt-secret-key-2026',
      signOptions: { expiresIn: '24h' },
    }),
    OutboxModule,
  ],
  controllers: [BookingController, BookingKafkaConsumer],
  providers: [BookingService, IdempotencyService, DebeziumConnectorService, JwtAuthGuard],
})
export class BookingModule {}
