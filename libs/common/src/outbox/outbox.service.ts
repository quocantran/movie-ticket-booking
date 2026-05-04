import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OutboxEntity } from '../entities/outbox.entity';

export interface OutboxEventData {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
}

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,
  ) {}

  async createEvent(
    eventData: OutboxEventData,
    entityManager?: EntityManager,
  ): Promise<OutboxEntity> {
    const repo = entityManager
      ? entityManager.getRepository(OutboxEntity)
      : this.outboxRepository;

    const event = repo.create({
      id: uuidv4(),
      aggregateType: eventData.aggregateType,
      aggregateId: eventData.aggregateId,
      eventType: eventData.eventType,
      payload: {
        ...eventData.payload,
        timestamp: new Date().toISOString(),
      },
      processed: false,
    });

    return repo.save(event);
  }

  async createEventInTransaction(
    entityManager: EntityManager,
    eventData: OutboxEventData,
  ): Promise<OutboxEntity> {
    return this.createEvent(eventData, entityManager);
  }
}
