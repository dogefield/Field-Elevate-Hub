export interface Memory {
  id: string;
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic';
  category: 'market' | 'strategy' | 'trade' | 'risk' | 'system';
  content: any;
  embedding?: number[];
  importance: number;
  created_at: Date;
  accessed_at: Date;
  access_count: number;
  decay_rate: number;
  associations: string[]; // IDs of related memories
}

export interface AgentMemory {
  agent_id: string;
  short_term: Memory[];
  long_term: Memory[];
  working_memory: WorkingMemory;
  last_updated: Date;
}

export interface WorkingMemory {
  current_focus: string;
  active_goals: Goal[];
  recent_observations: Observation[];
  pending_decisions: Decision[];
  context_window: any[];
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  deadline?: Date;
  progress: number;
  sub_goals: Goal[];
  status: 'active' | 'completed' | 'failed' | 'suspended';
}

export interface Observation {
  id: string;
  type: string;
  data: any;
  significance: number;
  timestamp: Date;
  processed: boolean;
}

export interface Decision {
  id: string;
  type: string;
  options: DecisionOption[];
  criteria: DecisionCriteria[];
  deadline?: Date;
  urgency: number;
  impact: number;
}

export interface DecisionOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  probability_success: number;
  expected_value: number;
}

export interface DecisionCriteria {
  name: string;
  weight: number;
  threshold?: number;
}

export interface SharedContext {
  session_id: string;
  participants: string[]; // Agent IDs
  shared_goals: Goal[];
  shared_observations: Observation[];
  consensus_state: any;
  conflict_areas: ConflictArea[];
  last_sync: Date;
}

export interface ConflictArea {
  topic: string;
  positions: Record<string, any>; // agent_id -> position
  resolution_status: 'unresolved' | 'voting' | 'resolved';
  resolution?: any;
}
