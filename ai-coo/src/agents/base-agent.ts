import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MemoryManager } from '../core/memory-manager';
import { ReasoningEngine } from '../core/reasoning-engine';
import { GPTClient } from '../llm/gpt-client';
import { logger } from '../../mcp-hub/src/utils/logger';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface AgentState {
  status: 'idle' | 'thinking' | 'acting' | 'waiting' | 'error';
  currentTask?: Task;
  workingMemory: any[];
  goals: Goal[];
  lastAction?: Action;
  confidence: number;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  priority: number;
  deadline?: Date;
  dependencies: string[];
  context: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  progress: number;
  subGoals: Goal[];
  metrics: Record<string, any>;
}

export interface Action {
  id: string;
  type: string;
  description: string;
  parameters: any;
  expectedOutcome: string;
  actualOutcome?: string;
  timestamp: Date;
  success?: boolean;
}

export interface Thought {
  id: string;
  content: string;
  confidence: number;
  reasoning: string[];
  timestamp: Date;
}

export abstract class BaseAgent extends EventEmitter {
  protected state: AgentState;
  protected memory: MemoryManager;
  protected reasoning: ReasoningEngine;
  protected llm: GPTClient;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.memory = new MemoryManager(config.id);
    this.reasoning = new ReasoningEngine();
    this.llm = new GPTClient({
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });

    this.state = {
      status: 'idle',
      workingMemory: [],
      goals: [],
      confidence: 1.0
    };
  }

  async initialize() {
    await this.memory.initialize();
    await this.loadSystemPrompt();
    this.emit('initialized', { agentId: this.config.id });
    logger.info(`Agent ${this.config.name} initialized`);
  }

  async processTask(task: Task): Promise<Action> {
    this.state.currentTask = task;
    this.state.status = 'thinking';
    this.emit('task_started', task);

    try {
      // Load relevant memories
      const relevantMemories = await this.memory.retrieveRelevant(task.description, 10);
      this.state.workingMemory = relevantMemories;

      // Think about the task
      const thought = await this.think(task, relevantMemories);
      this.emit('thought', thought);

      // Decide on action
      const action = await this.decide(thought, task);
      this.emit('action_planned', action);

      // Execute action
      this.state.status = 'acting';
      const result = await this.act(action);
      
      // Update action with outcome
      action.actualOutcome = result.outcome;
      action.success = result.success;
      this.state.lastAction = action;

      // Learn from result
      await this.learn(action, result);

      // Update task status
      task.status = result.success ? 'completed' : 'failed';
      this.state.status = 'idle';
      
      this.emit('task_completed', { task, action, result });
      return action;

    } catch (error) {
      this.state.status = 'error';
      logger.error(`Agent ${this.config.id} error processing task:`, error);
      this.emit('error', { task, error });
      throw error;
    }
  }

  protected async think(task: Task, memories: any[]): Promise<Thought> {
    const context = this.buildContext(task, memories);
    
    const response = await this.llm.complete({
      systemPrompt: this.config.systemPrompt,
      userPrompt: this.buildThinkingPrompt(task, context),
      temperature: this.config.temperature,
      maxTokens: 1000,
      responseFormat: 'json'
    });

    const thought: Thought = {
      id: uuidv4(),
      content: response.content,
      confidence: response.confidence || 0.5,
      reasoning: response.reasoning || [],
      timestamp: new Date()
    };

    // Store thought in memory
    await this.memory.store({
      type: 'thought',
      content: thought,
      importance: task.priority * thought.confidence,
      associations: [task.id]
    });

    return thought;
  }

  protected async decide(thought: Thought, task: Task): Promise<Action> {
    const decision = await this.reasoning.evaluate({
      thought,
      task,
      state: this.state,
      constraints: this.getConstraints()
    });

    const action: Action = {
      id: uuidv4(),
      type: decision.actionType,
      description: decision.description,
      parameters: decision.parameters,
      expectedOutcome: decision.expectedOutcome,
      timestamp: new Date()
    };

    return action;
  }

  protected abstract act(action: Action): Promise<{
    success: boolean;
    outcome: string;
    data?: any;
  }>;

  protected async learn(action: Action, result: any) {
    // Calculate reward
    const reward = this.calculateReward(action, result);
    
    // Update confidence
    this.state.confidence = this.state.confidence * 0.9 + reward * 0.1;

    // Store experience
    await this.memory.store({
      type: 'experience',
      content: {
        action,
        result,
        reward,
        context: this.state.currentTask
      },
      importance: Math.abs(reward),
      associations: [action.id, this.state.currentTask?.id]
    });

    // Update goal progress
    this.updateGoalProgress(action, result);
  }

  protected calculateReward(action: Action, result: any): number {
    // Base reward on success
    let reward = result.success ? 1.0 : -1.0;
    
    // Adjust based on outcome matching expectation
    if (action.expectedOutcome && action.actualOutcome) {
      const similarity = this.reasoning.calculateSimilarity(
        action.expectedOutcome,
        action.actualOutcome
      );
      reward *= similarity;
    }

    return reward;
  }

  protected updateGoalProgress(action: Action, result: any) {
    // Update relevant goals based on action outcome
    for (const goal of this.state.goals) {
      if (this.isActionRelevantToGoal(action, goal)) {
        const progressDelta = result.success ? 0.1 : -0.05;
        goal.progress = Math.max(0, Math.min(1, goal.progress + progressDelta));
      }
    }
  }

  protected buildContext(task: Task, memories: any[]): any {
    return {
      task,
      recentActions: this.getRecentActions(5),
      activeGoals: this.state.goals.filter(g => g.progress < 1),
      relevantMemories: memories,
      systemState: this.getSystemState(),
      timestamp: new Date().toISOString()
    };
  }

  protected buildThinkingPrompt(task: Task, context: any): string {
    return `
Task: ${task.description}
Priority: ${task.priority}
Context: ${JSON.stringify(context, null, 2)}

Analyze this task and provide your thoughts in the following JSON format:
{
  "content": "Your analysis of the task",
  "confidence": 0.0-1.0,
  "reasoning": ["Step 1 of your reasoning", "Step 2", ...],
  "suggestedApproach": "How you would approach this task",
  "potentialRisks": ["Risk 1", "Risk 2", ...],
  "requiredResources": ["Resource 1", "Resource 2", ...]
}`;
  }

  protected getRecentActions(count: number): Action[] {
    // This would retrieve from memory in a real implementation
    return [];
  }

  protected getSystemState(): any {
    return {
      agentId: this.config.id,
      status: this.state.status,
      confidence: this.state.confidence,
      activeTaskCount: this.state.currentTask ? 1 : 0
    };
  }

  protected abstract getConstraints(): any;
  protected abstract isActionRelevantToGoal(action: Action, goal: Goal): boolean;
  protected abstract loadSystemPrompt(): Promise<void>;

  // Coordination methods
  async receiveMessage(message: any) {
    this.emit('message_received', message);
    
    // Add to working memory
    this.state.workingMemory.push({
      type: 'message',
      from: message.from,
      content: message.content,
      timestamp: new Date()
    });

    // Process if it's a task request
    if (message.type === 'task_request') {
      const task: Task = {
        id: uuidv4(),
        type: message.taskType,
        description: message.description,
        priority: message.priority || 5,
        dependencies: [],
        context: message.context,
        status: 'pending'
      };

      return await this.processTask(task);
    }
  }

  async shareKnowledge(topic: string, agents: string[]) {
    const knowledge = await this.memory.retrieveByTopic(topic, 20);
    
    this.emit('knowledge_shared', {
      topic,
      recipients: agents,
      itemCount: knowledge.length
    });

    return {
      agentId: this.config.id,
      topic,
      knowledge,
      timestamp: new Date()
    };
  }

  getStatus(): AgentState {
    return { ...this.state };
  }

  async shutdown() {
    this.state.status = 'idle';
    await this.memory.persist();
    this.removeAllListeners();
    logger.info(`Agent ${this.config.name} shutdown`);
  }
}
