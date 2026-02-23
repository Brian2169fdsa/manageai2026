'use client';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const crumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  tickets: 'Tickets',
  portal: 'Portal',
  'new-ticket': 'New Ticket',
  ticket: 'Ticket',
  settings: 'Settings',
};

export function TopBar() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);

  const crumbs = parts.map((part, i) => ({
    label: crumbMap[part] ?? (part.length === 36 ? `#${part.slice(0, 8)}` : part),
    href: '/' + parts.slice(0, i + 1).join('/'),
  }));

  return (
    <header className="h-14 border-b flex items-center px-6 bg-background shrink-0">
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-muted-foreground" />}
            <span className={i === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>
    </header>
  );
}
