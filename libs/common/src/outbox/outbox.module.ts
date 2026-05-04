import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEntity } from '../entities/outbox.entity';
import { OutboxService } from './outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEntity])],
  providers: [OutboxService],
  exports: [OutboxService, TypeOrmModule],
})
export class OutboxModule {}
