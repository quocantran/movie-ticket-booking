import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatEntity } from './entities/seat.entity';
import { SeatService } from './services/seat.service';
import { SeatController } from './controllers/seat.controller';
import { SeatKafkaConsumer } from './consumers/seat.consumer';
import {
  OutboxModule,
  OutboxEntity,
  ProcessedEventEntity,
  IdempotencyService,
  RedisModule,
} from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([SeatEntity, OutboxEntity, ProcessedEventEntity]),
    OutboxModule,
    RedisModule,
  ],
  controllers: [SeatController, SeatKafkaConsumer],
  providers: [SeatService, IdempotencyService],
})
export class SeatModule { }
