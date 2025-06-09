import { createClient, RedisClientType } from 'redis';
import { logger } from './utils/logger.js';

export class RedisManager {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({ url: redisUrl });
    this.subscriber = this.client.duplicate();
    this.publisher = this.client.duplicate();

    // Error handling
    this.client.on('error', (err) => logger.error('Redis Client Error', err));
    this.subscriber.on('error', (err) => logger.error('Redis Subscriber Error', err));
    this.publisher.on('error', (err) => logger.error('Redis Publisher Error', err));
  }

  async connect() {
    await Promise.all([
      this.client.connect(),
      this.subscriber.connect(),
      this.publisher.connect()
    ]);
    logger.info('Redis connections established');
  }

  // Stream operations for real-time data
  async addToStream(streamKey: string, data: any) {
    const id = '*'; // Auto-generate ID
    const fields = this.flattenObject(data);
    return await this.client.xAdd(streamKey, id, fields);
  }

  async readStream(streamKey: string, lastId = '0', count = 100) {
    const results = await this.client.xRead([
      { key: streamKey, id: lastId }
    ], { COUNT: count, BLOCK: 1000 });
    
    return results?.[0]?.messages || [];
  }

  // Pub/Sub for events
  async publish(channel: string, message: any) {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void) {
    await this.subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        callback(parsed);
      } catch (error) {
        logger.error(`Failed to parse message from ${channel}`, error);
      }
    });
  }

  // Key-value operations
  async get(key: string) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  // Hash operations for complex state
  async hSet(key: string, field: string, value: any) {
    await this.client.hSet(key, field, JSON.stringify(value));
  }

  async hGet(key: string, field: string) {
    const value = await this.client.hGet(key, field);
    return value ? JSON.parse(value) : null;
  }

  async hGetAll(key: string) {
    const hash = await this.client.hGetAll(key);
    const result: any = {};
    for (const [field, value] of Object.entries(hash)) {
      result[field] = JSON.parse(value);
    }
    return result;
  }

  async hDel(key: string, field: string) {
    await this.client.hDel(key, field);
  }

  async hLen(key: string) {
    return await this.client.hLen(key);
  }

  // Helper to flatten objects for Redis streams
  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = JSON.stringify(value);
      }
    }
    
    return flattened;
  }

  async disconnect() {
    await Promise.all([
      this.client.quit(),
      this.subscriber.quit(),
      this.publisher.quit()
    ]);
  }
}
