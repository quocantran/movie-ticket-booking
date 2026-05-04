import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from './payment.module';
import { WalletEntity } from './entities/wallet.entity';
import { PaymentEntity } from './entities/payment.entity';
import { OutboxEntity, ProcessedEventEntity } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', '123456'),
        database: 'payment_db',
        entities: [WalletEntity, PaymentEntity, OutboxEntity, ProcessedEventEntity],
        synchronize: false,
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    PaymentModule,
  ],
})
export class AppModule {}
