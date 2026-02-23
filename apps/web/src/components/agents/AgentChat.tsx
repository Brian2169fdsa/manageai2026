'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, ChevronDown, ChevronRight, Search, BarChart2, Mail, Wrench, FileJson } from 'lucide-react';
import { AgentMessage, AgentConfig, ToolEvent } from '@/lib/agents/types';
import { cn } from '@/lib/utils';

interface AgentChatProps {
  config: AgentConfig;
  isOpen: boolean;
  onClose: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function now() {
  return new Date().toISOString();
}

function ToolCard({ event }: { event: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);

  function getToolIcon() {
    const name = event.tool_name.toLowerCase();
    if (name.includes('ticket') || name.includes('search')) return <Search size={12} />;
    if (name.includes('analytic') || name.includes('metric') || name.includes('summary')) return <BarChart2 size={12} />;
    if (name.includes('email') || name.includes('slack') || name.includes('calendar')) return <Mail size={12} />;
    if (name.includes('artifact') || name.includes('workflow') || name.includes('rebuild')) return <FileJson size={12} />;
    return <Wrench size={12} />;
  }

  function getToolSummary() {
    const name = event.tool_name;
    const result = event.tool_result;

    if (name === 'searchTickets') return `Searched ${result?.count ?? 0} ticket${result?.count === 1 ? '' : 's'}`;
    if (name === 'listRecentTickets') return `Listed ${result?.count ?? 0} recent ticket${result?.count === 1 ? '' : 's'}`;
    if (name === 'getTicket') return `Retrieved ticket details`;
    if (name === 'getTicketStats') return `Fetched ticket stats (${result?.total ?? 0} total)`;
    if (name === 'getPlatformMetrics') return `Fetched platform metrics`;
    if (name === 'getDepartmentSummary') return `Got department summary`;
    if (name === 'getAgentActivity') return `Retrieved ${result?.count ?? 0} activity events`;
    if (name === 'getTemplateUsage') return `Retrieved ${result?.count ?? 0} templates`;
    if (name === 'getArtifacts') return `Retrieved ${result?.count ?? 0} artifact${result?.count === 1 ? '' : 's'}`;
    if (name === 'getWorkflowJson') return `Retrieved workflow JSON`;
    if (name === 'triggerRebuild') return `Triggered rebuild`;
    if (name === 'sendEmail') return `Drafted email to ${event.tool_input?.to ?? '...'}`;
    if (name === 'sendSlackMessage') return `Sent to ${event.tool_input?.channel ?? '...'}`;
    if (name === 'createCalendarEvent') return `Created event: ${event.tool_input?.title ?? '...'}`;
    if (name === 'updatePipedrive') return `Updated deal ${event.tool_input?.deal_id ?? '...'}`;
    return name;
  }

  return (
    <div className="my-2 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 transition-colors"
      >
        <span className="text-gray-400">{getToolIcon()}</span>
        <span className="flex-1 text-gray-600 font-medium">{getToolSummary()}</span>
        <span className="text-gray-400 text-[10px]">{event.duration_ms}ms</span>
        {expanded ? <ChevronDown size={11} className="text-gray-400" /> : <ChevronRight size={11} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Input</div>
            <pre className="text-[10px] text-gray-600 bg-white rounded border border-gray-100 p-2 overflow-x-auto max-h-32">
              {JSON.stringify(event.tool_input, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Output</div>
            <pre className="text-[10px] text-gray-600 bg-white rounded border border-gray-100 p-2 overflow-x-auto max-h-48">
              {JSON.stringify(event.tool_result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function AgentChat({ config, isOpen, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: AgentMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        created_at: now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setShowSuggestions(false);

      // Build conversation history (user + assistant only) for API
      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: config.id, messages: history }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Request failed');
        }

        const toolEvents: ToolEvent[] = data.toolEvents ?? [];
        const newMessages: AgentMessage[] = [];

        // Add tool_use/tool_result messages for display
        for (const event of toolEvents) {
          newMessages.push({
            id: generateId(),
            role: 'tool_use',
            content: event.tool_name,
            tool_name: event.tool_name,
            tool_input: event.tool_input,
            tool_result: event.tool_result,
            created_at: now(),
          });
        }

        // Add final assistant message
        newMessages.push({
          id: generateId(),
          role: 'assistant',
          content: data.message ?? '',
          created_at: now(),
        });

        setMessages((prev) => [...prev, ...newMessages]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: `Sorry, I encountered an error: ${(err as Error).message}. Please try again.`,
            created_at: now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, config.id]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Format markdown-ish text: bold, bullet points, code
  function renderContent(text: string) {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold **text**
      const formatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
      );
      // Inline code `text`
      const withCode = formatted.replace(
        /`([^`]+)`/g,
        '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.85em">$1</code>'
      );
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: withCode }} />
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
          style={{ borderTop: `3px solid ${config.color}` }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
            style={{ background: `${config.color}20` }}
          >
            {config.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">{config.name}</div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: `${config.color}15`, color: config.color }}
              >
                {config.department}
              </span>
              <span className="text-[10px] text-gray-400">{config.role}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">{config.avatar}</div>
              <div className="text-sm font-medium text-gray-700">{config.name}</div>
              <div className="text-xs text-gray-400 mt-1">{config.role}</div>
              <div className="text-xs text-gray-400 mt-3 max-w-[260px] mx-auto leading-relaxed">
                Ask me anything about {config.department} — I have access to your tickets, metrics, and platform data.
              </div>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === 'tool_use') {
              const event: ToolEvent = {
                tool_name: msg.tool_name!,
                tool_input: msg.tool_input,
                tool_result: msg.tool_result,
                duration_ms: 0,
              };
              return <ToolCard key={msg.id} event={event} />;
            }

            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white leading-relaxed"
                    style={{ background: config.color }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            }

            if (msg.role === 'assistant') {
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                    style={{ background: `${config.color}20` }}
                  >
                    {config.avatar}
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {renderContent(msg.content)}
                  </div>
                </div>
              );
            }

            return null;
          })}

          {loading && (
            <div className="flex items-start gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ background: `${config.color}20` }}
              >
                {config.avatar}
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-gray-100">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested actions */}
        {showSuggestions && messages.length === 0 && (
          <div className="px-4 pb-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Suggested</div>
            <div className="flex flex-wrap gap-1.5">
              {config.suggestedActions.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${config.name}...`}
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none resize-none max-h-28 disabled:opacity-50"
              style={{ minHeight: '20px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 p-1.5 rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: config.color }}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 text-center">
            Enter to send · Shift+Enter for newline
          </div>
        </div>
      </div>
    </>
  );
}
