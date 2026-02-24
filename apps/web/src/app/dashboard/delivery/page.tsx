'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Building2,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Ticket } from '@/types';

// Progress through the status pipeline (0-100)
const STATUS_PROGRESS: Record<string, number> = {
  SUBMITTED: 10,
  CONTEXT_PENDING: 20,
  ANALYZING: 35,
  QUESTIONS_PENDING: 45,
  BUILDING: 65,
  REVIEW_PENDING: 80,
  APPROVED: 92,
  DEPLOYED: 100,
  CLOSED: 100,
};

const STATUS_CONFIG: Record<string, { label: string; variant: string; dot: string }> = {
  SUBMITTED: { label: 'Submitted', variant: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  CONTEXT_PENDING: { label: 'Context Needed', variant: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  ANALYZING: { label: 'Analyzing', variant: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  QUESTIONS_PENDING: { label: 'Questions Pending', variant: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  BUILDING: { label: 'Building', variant: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  REVIEW_PENDING: { label: 'Awaiting Review', variant: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  APPROVED: { label: 'Approved', variant: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  DEPLOYED: { label: 'Delivered', variant: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  CLOSED: { label: 'Closed', variant: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

const PLATFORM_CONFIG: Record<string, { label: string; class: string }> = {
  n8n: { label: 'n8n', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  make: { label: 'Make.com', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  zapier: { label: 'Zapier', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
};

interface TicketWithCount extends Ticket {
  artifact_count?: number;
}

export default function DeliveryPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (data) {
        // Fetch artifact counts for all tickets in parallel
        const ticketsWithCounts = await Promise.all(
          data.map(async (t) => {
            const { count } = await supabase
              .from('ticket_artifacts')
              .select('id', { count: 'exact', head: true })
              .eq('ticket_id', t.id);
            return { ...t, artifact_count: count ?? 0 };
          })
        );
        setTickets(ticketsWithCounts as TicketWithCount[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Summary counts ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tickets.length;
    const inProgress = tickets.filter((t) =>
      ['SUBMITTED', 'CONTEXT_PENDING', 'ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'].includes(t.status)
    ).length;
    const awaitingReview = tickets.filter((t) => t.status === 'REVIEW_PENDING').length;
    const delivered = tickets.filter((t) => ['APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)).length;
    return { total, inProgress, awaitingReview, delivered };
  }, [tickets]);

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        !search ||
        (t.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.project_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.contact_name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'in_progress' &&
          ['SUBMITTED', 'CONTEXT_PENDING', 'ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'].includes(t.status)) ||
        (statusFilter === 'review' && t.status === 'REVIEW_PENDING') ||
        (statusFilter === 'delivered' && ['APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)) ||
        t.status === statusFilter;
      const matchesPlatform = platformFilter === 'all' || t.ticket_type === platformFilter;
      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [tickets, search, statusFilter, platformFilter]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Delivery Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All customer projects and their delivery status
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          icon={<BarChart3 size={18} className="text-slate-500" />}
          label="Total Projects"
          value={stats.total}
          loading={loading}
          bg="bg-slate-50"
        />
        <SummaryCard
          icon={<Clock size={18} className="text-blue-500" />}
          label="In Progress"
          value={stats.inProgress}
          loading={loading}
          bg="bg-blue-50"
        />
        <SummaryCard
          icon={<AlertCircle size={18} className="text-purple-500" />}
          label="Awaiting Review"
          value={stats.awaitingReview}
          loading={loading}
          bg="bg-purple-50"
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} className="text-green-500" />}
          label="Delivered"
          value={stats.delivered}
          loading={loading}
          bg="bg-green-50"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search company, project, contact..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Awaiting Review</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        {/* Platform filter */}
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="make">Make.com</SelectItem>
            <SelectItem value="zapier">Zapier</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Package size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">No projects found</p>
          {(search || statusFilter !== 'all' || platformFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPlatformFilter('all');
              }}
              className="text-blue-600 text-sm mt-2 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ticket) => (
            <ProjectCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => router.push(`/dashboard/delivery/${ticket.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  icon,
  label,
  value,
  loading,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  bg: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', bg)}>
      <div className="flex items-center justify-between">
        {icon}
        {loading ? (
          <div className="h-7 w-8 bg-muted animate-pulse rounded" />
        ) : (
          <span className="text-2xl font-bold">{value}</span>
        )}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ ticket, onClick }: { ticket: TicketWithCount; onClick: () => void }) {
  function copyShareLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/share/${ticket.id}/demo`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Demo link copied!');
    }).catch(() => {
      toast.error('Could not copy link');
    });
  }
  const status = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, variant: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  const platform = PLATFORM_CONFIG[ticket.ticket_type] ?? { label: ticket.ticket_type, class: 'bg-gray-100 text-gray-600' };
  const progress = STATUS_PROGRESS[ticket.status] ?? 0;

  return (
    <button
      onClick={onClick}
      className="text-left w-full border rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all p-5 space-y-4 group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Building2 size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{ticket.company_name}</span>
          </div>
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
            {ticket.project_name || 'Untitled Project'}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(ticket.artifact_count ?? 0) > 0 && (
            <button
              onClick={copyShareLink}
              title="Copy shareable demo link"
              className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Share2 size={13} />
            </button>
          )}
          <ChevronRight size={16} className="text-muted-foreground mt-0.5 group-hover:text-blue-600 transition-colors" />
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold border', platform.class)}>
          {platform.label}
        </span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1', status.variant)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
        {(ticket.artifact_count ?? 0) > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-normal">
            {ticket.artifact_count} deliverable{(ticket.artifact_count ?? 0) !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progress === 100 ? 'bg-green-500' : progress >= 80 ? 'bg-purple-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        {ticket.complexity_estimate && (
          <span className="capitalize">{ticket.complexity_estimate}</span>
        )}
      </div>
    </button>
  );
}
