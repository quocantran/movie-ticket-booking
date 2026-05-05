import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisLockService {
  private readonly RELEASE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const result = await this.redis.eval(this.RELEASE_SCRIPT, 1, key, token);
    return result === 1;
  }

  async acquireMultipleLocks(
    keys: string[],
    ttlMs: number,
  ): Promise<{ success: boolean; tokens: Map<string, string>; failedKey?: string }> {
    const tokens = new Map<string, string>();
    const tokenValues = keys.map(() => randomUUID());

    const pipeline = this.redis.pipeline();
    for (let i = 0; i < keys.length; i++) {
      pipeline.set(keys[i], tokenValues[i], 'PX', ttlMs, 'NX');
    }
    const results = await pipeline.exec();

    if (!results) {
      return { success: false, tokens: new Map(), failedKey: keys[0] };
    }

    const failedIndices: number[] = [];
    for (let i = 0; i < results.length; i++) {
      const [err, result] = results[i];
      if (!err && result === 'OK') {
        tokens.set(keys[i], tokenValues[i]);
      } else {
        failedIndices.push(i);
      }
    }

    if (failedIndices.length > 0) {
      await this.releaseMultipleLocks(tokens);
      return {
        success: false,
        tokens: new Map(),
        failedKey: keys[failedIndices[0]],
      };
    }

    return { success: true, tokens };
  }

  async releaseMultipleLocks(tokens: Map<string, string>): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const [key, token] of tokens) {
      pipeline.eval(this.RELEASE_SCRIPT, 1, key, token);
    }
    await pipeline.exec();
  }
}
