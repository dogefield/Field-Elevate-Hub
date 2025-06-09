import { RedisManager } from '../../mcp-hub/src/redis-manager';
import { GPTClient } from '../llm/gpt-client';
import { logger } from '../../mcp-hub/src/utils/logger';

export interface MemoryItem {
  id: string;
  type: 'experience' | 'fact' | 'thought' | 'goal' | 'observation';
  content: any;
  embedding?: number[];
  importance: number;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  decay: number;
  associations: string[];
  agentId: string;
}

export class MemoryManager {
  private redis: RedisManager;
  private gpt: GPTClient;
  private memoryKey: string;
  private shortTermCapacity = 50;
  private longTermThreshold = 0.7;

  constructor(private agentId: string) {
    this.memoryKey = `memory:${agentId}`;
    this.redis = new RedisManager();
    this.gpt = new GPTClient({
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 1000
    });
  }

  async initialize() {
    await this.redis.connect();
    await this.loadPersistentMemories();
  }

  async store(item: Omit<MemoryItem, 'id' | 'timestamp' | 'accessCount' | 'lastAccessed' | 'decay' | 'agentId'>) {
    const memory: MemoryItem = {
      ...item,
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      decay: 1.0,
      agentId: this.agentId
    };

    // Generate embedding if not provided
    if (!memory.embedding) {
      memory.embedding = await this.gpt.embedText(JSON.stringify(memory.content));
    }

    // Store in short-term memory
    await this.redis.hSet(`${this.memoryKey}:short`, memory.id, memory);

    // Check if it should go to long-term
    if (memory.importance >= this.longTermThreshold) {
      await this.promoteToLongTerm(memory);
    }

    // Manage capacity
    await this.manageCapacity();

    logger.debug(`Stored memory ${memory.id} for agent ${this.agentId}`);
  }

  async retrieveRelevant(query: string, limit: number = 10): Promise<MemoryItem[]> {
    const queryEmbedding = await this.gpt.embedText(query);
    
    // Get all memories
    const shortTerm = await this.getShortTermMemories();
    const longTerm = await this.getLongTermMemories();
    const allMemories = [...shortTerm, ...longTerm];

    // Calculate relevance scores
    const scored = allMemories.map(memory => {
      const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding || []);
      const recency = this.calculateRecency(memory.lastAccessed);
      const importance = memory.importance * memory.decay;
      
      const score = (similarity * 0.5) + (recency * 0.2) + (importance * 0.3);
      
      return { memory, score };
    });

    // Sort by score and take top N
    const relevant = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => {
        // Update access count and time
        item.memory.accessCount++;
        item.memory.lastAccessed = new Date();
        this.updateMemory(item.memory);
        return item.memory;
      });

    return relevant;
  }

  async retrieveByTopic(topic: string, limit: number = 20): Promise<MemoryItem[]> {
    // Topic-based retrieval using semantic search
    return this.retrieveRelevant(topic, limit);
  }

  async consolidate() {
    // Periodically consolidate similar memories
    const memories = await this.getAllMemories();
    const clusters = await this.clusterMemories(memories);
    
    for (const cluster of clusters) {
      if (cluster.length > 3) {
        const consolidated = await this.synthesizeMemories(cluster);
        await this.store(consolidated);
        
        // Mark originals for decay
        for (const memory of cluster) {
          memory.decay *= 0.5;
          await this.updateMemory(memory);
        }
      }
    }
  }

  private async getShortTermMemories(): Promise<MemoryItem[]> {
    const memories = await this.redis.hGetAll(`${this.memoryKey}:short`);
    return Object.values(memories);
  }

  private async getLongTermMemories(): Promise<MemoryItem[]> {
    const memories = await this.redis.hGetAll(`${this.memoryKey}:long`);
    return Object.values(memories);
  }

  private async getAllMemories(): Promise<MemoryItem[]> {
    const short = await this.getShortTermMemories();
    const long = await this.getLongTermMemories();
    return [...short, ...long];
  }

  private async promoteToLongTerm(memory: MemoryItem) {
    await this.redis.hSet(`${this.memoryKey}:long`, memory.id, memory);
    logger.debug(`Promoted memory ${memory.id} to long-term`);
  }

  private async updateMemory(memory: MemoryItem) {
    const key = memory.importance >= this.longTermThreshold 
      ? `${this.memoryKey}:long` 
      : `${this.memoryKey}:short`;
    
    await this.redis.hSet(key, memory.id, memory);
  }

  private async manageCapacity() {
    const shortTermMemories = await this.getShortTermMemories();
    
    if (shortTermMemories.length > this.shortTermCapacity) {
      // Remove least important/accessed memories
      const sorted = shortTermMemories.sort((a, b) => {
        const scoreA = a.importance * a.decay * (a.accessCount + 1);
        const scoreB = b.importance * b.decay * (b.accessCount + 1);
        return scoreA - scoreB;
      });

      const toRemove = sorted.slice(0, shortTermMemories.length - this.shortTermCapacity);
      
      for (const memory of toRemove) {
        await this.redis.hDel(`${this.memoryKey}:short`, memory.id);
        logger.debug(`Removed memory ${memory.id} due to capacity`);
      }
    }
  }

  private async clusterMemories(memories: MemoryItem[]): Promise<MemoryItem[][]> {
    // Simplified clustering - in production use proper clustering algorithm
    const clusters: MemoryItem[][] = [];
    const threshold = 0.8;

    for (const memory of memories) {
      let added = false;
      
      for (const cluster of clusters) {
        const similarity = this.cosineSimilarity(
          memory.embedding || [],
          cluster[0].embedding || []
        );
        
        if (similarity > threshold) {
          cluster.push(memory);
          added = true;
          break;
        }
      }
      
      if (!added) {
        clusters.push([memory]);
      }
    }

    return clusters;
  }

  private async synthesizeMemories(memories: MemoryItem[]): Promise<Omit<MemoryItem, 'id' | 'timestamp' | 'accessCount' | 'lastAccessed' | 'decay' | 'agentId'>> {
    const prompt = `Synthesize these related memories into a single, coherent memory:
${memories.map(m => JSON.stringify(m.content)).join('\n\n')}

Provide a synthesized memory that captures the key insights.`;

    const response = await this.gpt.complete({
      systemPrompt: 'You are a memory consolidation system. Synthesize memories while preserving key information.',
      userPrompt: prompt,
      temperature: 0.3
    });

    return {
      type: 'experience',
      content: response.content,
      importance: Math.max(...memories.map(m => m.importance)),
      associations: memories.map(m => m.id)
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateRecency(lastAccessed: Date): number {
    const now = Date.now();
    const accessed = lastAccessed.getTime();
    const hoursSince = (now - accessed) / (1000 * 60 * 60);
    
    // Exponential decay over time
    return Math.exp(-hoursSince / 24); // Half life of 24 hours
  }

  async persist() {
    // Persistence is handled by Redis automatically
    logger.info(`Persisted memories for agent ${this.agentId}`);
  }

  private async loadPersistentMemories() {
    // Memories are loaded from Redis on demand
    const count = await this.redis.hLen(`${this.memoryKey}:long`);
    logger.info(`Loaded ${count} long-term memories for agent ${this.agentId}`);
  }
}
