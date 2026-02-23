'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, PlusCircle, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-600',
  CONTEXT_PENDING: 'bg-slate-100 text-slate-600',
  ANALYZING: 'bg-blue-100 text-blue-700',
  QUESTIONS_PENDING: 'bg-amber-100 text-amber-700',
  BUILDING: 'bg-blue-100 text-blue-700',
  REVIEW_PENDING: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DEPLOYED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const PLATFORM_BADGE: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700',
  make: 'bg-purple-100 text-purple-700',
  zapier: 'bg-orange-100 text-orange-700',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets((data as Ticket[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = search
    ? tickets.filter(
        (t) =>
          t.company_name.toLowerCase().includes(search.toLowerCase()) ||
          t.contact_name.toLowerCase().includes(search.toLowerCase()) ||
          (t.project_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '–' : `${filtered.length} of ${tickets.length} requests`}
          </p>
        </div>
        <Link href="/portal/new-ticket">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
            <PlusCircle size={15} />
            New Ticket
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by company, contact, or project name..."
          className="pl-9 h-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ClipboardList size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">{search ? 'No tickets match your search' : 'No tickets yet'}</p>
          {!search && (
            <Link href="/portal/new-ticket">
              <Button variant="outline" size="sm" className="mt-4 gap-2">
                <PlusCircle size={13} /> Create first ticket
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company / Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tickets/${ticket.id}`}>
                      <div className="font-medium group-hover:text-blue-600 transition-colors">{ticket.company_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{ticket.contact_name}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {ticket.project_name || <span className="italic opacity-60">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', PLATFORM_BADGE[ticket.ticket_type])}>
                      {ticket.ticket_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[ticket.status])}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_BADGE[ticket.priority])}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
