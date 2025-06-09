import OpenAI from 'openai';
import { logger } from '../../mcp-hub/src/utils/logger';

export interface GPTConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}

export interface CompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  stream?: boolean;
  context?: any[];
}

export interface CompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  confidence?: number;
  reasoning?: string[];
}

export class GPTClient {
  private client: OpenAI;
  private config: GPTConfig;
  private contextWindow = 1000000; // 1M tokens for GPT-4.1

  constructor(config: GPTConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const messages = this.buildMessages(request);
      
      if (request.stream) {
        return await this.streamCompletion(messages, request);
      } else {
        return await this.standardCompletion(messages, request);
      }
    } catch (error) {
      logger.error('GPT completion error:', error);
      throw error;
    }
  }

  private buildMessages(request: CompletionRequest): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt }
    ];

    // Add context if provided
    if (request.context) {
      for (const ctx of request.context) {
        if (ctx.role && ctx.content) {
          messages.push({ role: ctx.role, content: ctx.content });
        }
      }
    }

    messages.push({ role: 'user', content: request.userPrompt });

    return messages;
  }

  private async standardCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      response_format: request.responseFormat === 'json' 
        ? { type: 'json_object' } 
        : undefined
    });

    const response = completion.choices[0].message.content || '';
    
    // Parse JSON if requested
    let content = response;
    let confidence: number | undefined;
    let reasoning: string[] | undefined;

    if (request.responseFormat === 'json') {
      try {
        const parsed = JSON.parse(response);
        content = parsed.content || response;
        confidence = parsed.confidence;
        reasoning = parsed.reasoning;
      } catch (error) {
        logger.warn('Failed to parse JSON response, returning raw content');
      }
    }

    return {
      content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      confidence,
      reasoning
    };
  }

  private async streamCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      stream: true
    });

    let content = '';
    let usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      content += delta;
      
      // Emit streaming events if needed
      if (delta) {
        process.stdout.write(delta);
      }
    }

    return { content, usage };
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text
    });

    return response.data[0].embedding;
  }

  calculateTokenCount(text: string): number {
    // Rough estimation - in production use tiktoken
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  async optimizeContext(
    messages: any[],
    maxTokens: number = 900000 // Leave room for response
  ): Promise<any[]> {
    let totalTokens = 0;
    const optimized = [];

    // Always include system message
    if (messages.length > 0 && messages[0].role === 'system') {
      optimized.push(messages[0]);
      totalTokens += this.calculateTokenCount(messages[0].content);
    }

    // Add messages from most recent, staying under limit
    for (let i = messages.length - 1; i >= 1; i--) {
      const tokens = this.calculateTokenCount(messages[i].content);
      if (totalTokens + tokens < maxTokens) {
        optimized.splice(1, 0, messages[i]); // Insert after system message
        totalTokens += tokens;
      } else {
        break;
      }
    }

    logger.debug(`Optimized context: ${messages.length} -> ${optimized.length} messages, ${totalTokens} tokens`);
    
    return optimized;
  }
}
