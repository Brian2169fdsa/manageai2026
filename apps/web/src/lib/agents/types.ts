/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  department: string;
  systemPrompt: string;
  tools: AgentTool[];
  avatar: string;
  color: string;
  suggestedActions: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
  execute: (params: any, supabase: any) => Promise<any>;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;
  tool_name?: string;
  tool_input?: any;
  tool_result?: any;
  created_at: string;
}

export interface ToolEvent {
  tool_name: string;
  tool_input: any;
  tool_result: any;
  duration_ms: number;
}

export interface AgentChatRequest {
  department: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export interface AgentChatResponse {
  message: string;
  toolEvents: ToolEvent[];
}
