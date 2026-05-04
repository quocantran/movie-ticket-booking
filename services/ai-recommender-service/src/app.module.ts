import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommenderModule } from './recommender.module';
import { MovieEmbeddingEntity } from './entities/movie-embedding.entity';
import { UserBehaviorEntity } from './entities/user-behavior.entity';
import { ProcessedEventEntity } from '@app/common';

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
        database: 'ai_db',
        entities: [MovieEmbeddingEntity, UserBehaviorEntity, ProcessedEventEntity],
        synchronize: false,
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    RecommenderModule,
  ],
})
export class AppModule {}
