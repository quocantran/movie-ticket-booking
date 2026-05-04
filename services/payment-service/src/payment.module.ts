import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { WalletEntity } from './entities/wallet.entity';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentKafkaConsumer } from './consumers/payment.consumer';
import {
  OutboxModule,
  OutboxEntity,
  ProcessedEventEntity,
  IdempotencyService,
  JwtAuthGuard,
} from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity, PaymentEntity, OutboxEntity, ProcessedEventEntity]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'movie-booking-jwt-secret-key-2026',
      signOptions: { expiresIn: '24h' },
    }),
    OutboxModule,
  ],
  controllers: [PaymentController, PaymentKafkaConsumer],
  providers: [PaymentService, IdempotencyService, JwtAuthGuard],
})
export class PaymentModule {}
