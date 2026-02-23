/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { getAgentConfig } from '@/lib/agents/configs';
import { AgentTool, ToolEvent } from '@/lib/agents/types';

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Convert our AgentTool to Anthropic's tool format */
function toClaudeTool(tool: AgentTool): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as Anthropic.Tool['input_schema'],
  };
}

/** Save conversation to DB (best-effort — don't fail if table doesn't exist) */
async function saveConversation(
  department: string,
  userMessage: string,
  assistantMessage: string,
  toolEvents: ToolEvent[]
) {
  try {
    await supabase.from('agent_conversations').insert({
      department,
      user_message: userMessage,
      assistant_message: assistantMessage,
      tool_events: toolEvents,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet
  }
}

/** Log a tool execution (best-effort) */
async function logToolExecution(
  department: string,
  toolName: string,
  input: any,
  output: any,
  durationMs: number
) {
  try {
    await supabase.from('agent_tool_logs').insert({
      department,
      tool_name: toolName,
      input,
      output,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { department, messages } = body as {
    department: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!department || !messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'department and messages are required' }, { status: 400 });
  }

  const config = getAgentConfig(department);
  if (!config) {
    return NextResponse.json({ error: `Unknown department: ${department}` }, { status: 400 });
  }

  const claudeTools = config.tools.map(toClaudeTool);
  const toolMap = new Map<string, AgentTool>(config.tools.map((t) => [t.name, t]));

  // Build the conversation history for Claude
  // Convert our messages to Anthropic format
  const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolEvents: ToolEvent[] = [];
  let finalMessage = '';
  const userMessage = messages[messages.length - 1]?.content ?? '';

  console.log(`[agent:${department}] Starting chat with ${messages.length} messages, ${config.tools.length} tools`);

  // Agentic loop — continue until end_turn or no more tool use
  const loopMessages = [...claudeMessages];
  const MAX_ITERATIONS = 8;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: config.systemPrompt,
      tools: claudeTools,
      messages: loopMessages,
    });

    console.log(
      `[agent:${department}] Iteration ${iterations}: stop_reason=${response.stop_reason}, content blocks=${response.content.length}`
    );

    // Collect any tool use blocks
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    // Collect text blocks
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );

    if (textBlocks.length > 0) {
      finalMessage = textBlocks.map((b) => b.text).join('\n');
    }

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      break;
    }

    // Add assistant's response (with tool_use blocks) to history
    loopMessages.push({ role: 'assistant', content: response.content });

    // Execute all tools in parallel
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const tool = toolMap.get(block.name);
        const toolStart = Date.now();

        if (!tool) {
          console.warn(`[agent:${department}] Unknown tool: ${block.name}`);
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify({ error: `Tool not found: ${block.name}` }),
            is_error: true,
          };
        }

        try {
          console.log(`[agent:${department}] Executing tool: ${block.name}`, block.input);
          const result = await tool.execute(block.input, supabase);
          const duration = Date.now() - toolStart;

          const event: ToolEvent = {
            tool_name: block.name,
            tool_input: block.input,
            tool_result: result,
            duration_ms: duration,
          };
          toolEvents.push(event);

          // Fire-and-forget logging
          logToolExecution(department, block.name, block.input, result, duration);

          console.log(`[agent:${department}] Tool ${block.name} completed in ${duration}ms`);

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          const duration = Date.now() - toolStart;
          const errMsg = (err as Error).message;
          console.error(`[agent:${department}] Tool ${block.name} failed: ${errMsg}`);

          const event: ToolEvent = {
            tool_name: block.name,
            tool_input: block.input,
            tool_result: { error: errMsg },
            duration_ms: duration,
          };
          toolEvents.push(event);

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify({ error: errMsg }),
            is_error: true,
          };
        }
      })
    );

    // Add tool results as user message
    loopMessages.push({ role: 'user', content: toolResultBlocks });
  }

  console.log(`[agent:${department}] Done. ${toolEvents.length} tools executed, message length: ${finalMessage.length}`);

  // Save conversation (best-effort)
  saveConversation(department, userMessage, finalMessage, toolEvents);

  return NextResponse.json({
    message: finalMessage,
    toolEvents,
  });
}
