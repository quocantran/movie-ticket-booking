import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatModule } from './seat.module';
import { SeatEntity } from './entities/seat.entity';
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
        database: 'seat_db',
        entities: [SeatEntity, OutboxEntity, ProcessedEventEntity],
        synchronize: false,
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    SeatModule,
  ],
})
export class AppModule {}
