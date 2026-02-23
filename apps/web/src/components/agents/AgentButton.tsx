'use client';
import { useState } from 'react';
import { AgentChat } from './AgentChat';
import { AgentConfig } from '@/lib/agents/types';

interface AgentButtonProps {
  config: AgentConfig;
}

export function AgentButton({ config }: AgentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl z-30 transition-transform hover:scale-110 active:scale-95"
        style={{ background: config.color }}
        title={`Open ${config.name}`}
        aria-label={`Open ${config.name}`}
      >
        {/* Pulse ring */}
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: config.color }}
        />
        <span className="relative z-10">{config.avatar}</span>
      </button>

      {/* Chat panel */}
      <AgentChat
        config={config}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
