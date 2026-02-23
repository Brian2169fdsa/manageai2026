'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket, TicketStatus } from '@/types';
import Link from 'next/link';
import { ClipboardList, CheckCircle, Clock, Zap, PlusCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_GROUPS = [
  {
    label: 'Submitted',
    statuses: ['SUBMITTED', 'CONTEXT_PENDING'],
    icon: Clock,
    bg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    border: 'border-slate-200',
  },
  {
    label: 'In Progress',
    statuses: ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'],
    icon: Zap,
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    border: 'border-blue-200',
  },
  {
    label: 'In Review',
    statuses: ['REVIEW_PENDING', 'APPROVED'],
    icon: ClipboardList,
    bg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    border: 'border-amber-200',
  },
  {
    label: 'Completed',
    statuses: ['DEPLOYED', 'CLOSED'],
    icon: CheckCircle,
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    border: 'border-emerald-200',
  },
];

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-700',
  CONTEXT_PENDING: 'bg-slate-100 text-slate-700',
  ANALYZING: 'bg-blue-100 text-blue-700',
  QUESTIONS_PENDING: 'bg-amber-100 text-amber-700',
  BUILDING: 'bg-blue-100 text-blue-700',
  REVIEW_PENDING: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DEPLOYED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const PLATFORM_BADGE: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700',
  make: 'bg-purple-100 text-purple-700',
  zapier: 'bg-orange-100 text-orange-700',
};

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

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

  const recent = tickets.slice(0, 6);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {loading ? '–' : `${tickets.length} build request${tickets.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <Link href="/portal/new-ticket">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
            <PlusCircle size={15} />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUS_GROUPS.map(({ label, statuses, icon: Icon, bg, iconColor, border }) => {
          const count = tickets.filter((t) => statuses.includes(t.status)).length;
          return (
            <Card key={label} className={cn('border', border)}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-bold text-foreground">
                      {loading ? <span className="text-muted-foreground text-xl">–</span> : count}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
                  </div>
                  <div className={cn('p-2 rounded-xl', bg)}>
                    <Icon size={18} className={iconColor} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Requests
          </CardTitle>
          <Link
            href="/dashboard/tickets"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight size={13} />
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardList size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No tickets yet</p>
              <p className="text-xs mt-1 mb-4">Create your first build request to get started</p>
              <Link href="/portal/new-ticket">
                <Button variant="outline" size="sm" className="gap-2">
                  <PlusCircle size={13} /> Create ticket
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
                        {ticket.project_name || 'Untitled Project'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {ticket.company_name} · {ticket.contact_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PLATFORM_BADGE[ticket.ticket_type])}>
                      {ticket.ticket_type}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[ticket.status])}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
