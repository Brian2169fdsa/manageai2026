'use client';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

interface OAuthButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function OAuthButton({ icon, label, onClick, disabled }: OAuthButtonProps) {
  return (
    <Button
      variant="outline"
      className="w-full flex items-center gap-3 h-11 text-sm font-medium"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
