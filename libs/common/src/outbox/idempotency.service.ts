import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ProcessedEventEntity } from '../entities/processed-event.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(ProcessedEventEntity)
    private readonly processedEventRepository: Repository<ProcessedEventEntity>,
  ) {}

  private isDuplicateKeyError(error: unknown): boolean {
    const err = error as { code?: string; errno?: number; message?: string };
    return (
      err?.code === 'ER_DUP_ENTRY' ||
      err?.errno === 1062 ||
      err?.message?.toLowerCase().includes('duplicate') === true
    );
  }

  async tryClaimEvent(
    eventId: string,
    eventType: string,
    entityManager?: EntityManager,
  ): Promise<boolean> {
    const repo = entityManager
      ? entityManager.getRepository(ProcessedEventEntity)
      : this.processedEventRepository;

    try {
      await repo.insert({
        id: uuidv4(),
        eventId,
        eventType,
      });
      return true;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }

  async releaseClaim(eventId: string, entityManager?: EntityManager): Promise<void> {
    const repo = entityManager
      ? entityManager.getRepository(ProcessedEventEntity)
      : this.processedEventRepository;
    await repo.delete({ eventId });
  }

  async processWithIdempotency(
    eventId: string,
    eventType: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const claimed = await this.tryClaimEvent(eventId, eventType);
    if (!claimed) return false;

    try {
      await handler();
      return true;
    } catch (error) {
      await this.releaseClaim(eventId);
      throw error;
    }
  }
}
