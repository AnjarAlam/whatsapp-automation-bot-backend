import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  private isRedisConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('redis.host') || 'localhost';
    const port = this.configService.get<number>('redis.port') || 6379;
    const username = this.configService.get<string>('redis.username') || 'default';
    const password = this.configService.get<string>('redis.password') || '';

    try {
      this.redisClient = new Redis({
        host,
        port,
        username,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      this.redisClient.on('connect', () => {
        this.isRedisConnected = true;
        this.logger.log('Successfully connected to Redis Server for caching.');
      });

      this.redisClient.on('error', (err) => {
        this.isRedisConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}. Falling back to In-Memory Cache.`);
      });

      this.redisClient.connect().catch((err) => {
        this.isRedisConnected = false;
        this.logger.warn('Could not establish Redis connection. Falling back to In-Memory Cache.');
      });
    } catch (e: any) {
      this.isRedisConnected = false;
      this.logger.warn(`Failed to initialize Redis client: ${e.message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        this.logger.error(`Redis Get Error: ${err}`);
      }
    }

    // In-memory fallback
    const memData = this.memoryCache.get(key);
    if (memData) {
      if (Date.now() < memData.expiry) {
        return memData.value as T;
      }
      this.memoryCache.delete(key);
    }
    return null;
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        this.logger.error(`Redis Set Error: ${err}`);
      }
    }

    // In-memory fallback
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err) {
        this.logger.error(`Redis Delete Error: ${err}`);
      }
    }
    this.memoryCache.delete(key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
        return;
      } catch (err) {
        this.logger.error(`Redis Prefix Invalidation Error: ${err}`);
      }
    }

    // In-memory fallback
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }
}
