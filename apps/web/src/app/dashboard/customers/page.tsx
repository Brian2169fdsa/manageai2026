'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings,
  ArrowUpDown,
} from 'lucide-react';

interface Deal {
  id: number;
  title: string;
  status: string;
  value: number;
  currency: string;
  stage_id: number;
  stage_name: string;
  expected_close_date: string | null;
  person_name: string;
  org_name: string;
  owner_name: string;
  pipeline_id: number;
  add_time?: string;
  update_time?: string;
}

type SortKey = 'value' | 'age' | 'last_activity';
type SortDir = 'asc' | 'desc';

function dealAge(deal: Deal): number {
  if (!deal.add_time) return 0;
  return Math.floor((Date.now() - new Date(deal.add_time).getTime()) / (1000 * 60 * 60 * 24));
}

function lastActivity(deal: Deal): Date {
  if (deal.update_time) return new Date(deal.update_time);
  if (deal.add_time) return new Date(deal.add_time);
  return new Date(0);
}

const STAGE_COLORS: Record<string, string> = {
  Lead: 'bg-slate-100 text-slate-700',
  Qualified: 'bg-blue-100 text-blue-700',
  'Proposal Sent': 'bg-amber-100 text-amber-700',
  Negotiation: 'bg-violet-100 text-violet-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
};

function stageBadge(stageName: string) {
  const cls = STAGE_COLORS[stageName] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {stageName || '—'}
    </span>
  );
}

function statusBadge(status: string) {
  if (status === 'won') return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[11px]">Won</Badge>;
  if (status === 'lost') return <Badge className="bg-red-100 text-red-700 border-0 text-[11px]">Lost</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-0 text-[11px]">Open</Badge>;
}

export default function CustomersPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<{ id: number; name: string }[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('last_activity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    Promise.all([
      fetch('/api/pipedrive/deals?status=all_not_deleted')
        .then((r) => r.json())
        .then((d) => {
          setDeals(d.deals ?? []);
          setDemoMode(!!d.demo_mode);
        })
        .catch(() => {}),
      fetch('/api/pipedrive/pipeline')
        .then((r) => r.json())
        .then((d) => setStages(d.stages ?? []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    let result = deals;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title?.toLowerCase().includes(q) ||
          d.org_name?.toLowerCase().includes(q) ||
          d.person_name?.toLowerCase().includes(q)
      );
    }

    if (stageFilter !== 'all') {
      result = result.filter((d) => String(d.stage_id) === stageFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'value') cmp = Number(a.value ?? 0) - Number(b.value ?? 0);
      if (sortKey === 'age') cmp = dealAge(a) - dealAge(b);
      if (sortKey === 'last_activity') cmp = lastActivity(a).getTime() - lastActivity(b).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [deals, search, stageFilter, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users size={22} className="text-blue-500" />
            <h1 className="text-2xl font-bold">Customers</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            All Pipedrive deals — click a row to view the full client profile
          </p>
        </div>
      </div>

      {/* Demo mode banner */}
      {demoMode && !loading && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 text-amber-600" />
          <span>Showing sample data — connect Pipedrive to see real clients.</span>
          <a
            href="/dashboard/settings/deploy"
            className="ml-auto flex items-center gap-1 text-amber-700 font-semibold hover:underline whitespace-nowrap"
          >
            <Settings size={13} /> Settings
          </a>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search company or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Stages</option>
          {stages.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {loading ? 'Loading…' : `${filtered.length} deal${filtered.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-medium">Company</th>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('value')}
                    >
                      <span className="flex items-center gap-1">
                        Value <SortIcon col="value" />
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Stage</th>
                    <th className="text-left px-4 py-3 font-medium">Owner</th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('age')}
                    >
                      <span className="flex items-center gap-1">
                        Age <SortIcon col="age" />
                      </span>
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                      onClick={() => toggleSort('last_activity')}
                    >
                      <span className="flex items-center gap-1">
                        Last Activity <SortIcon col="last_activity" />
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground text-sm">
                        No deals found.
                      </td>
                    </tr>
                  )}
                  {filtered.map((deal) => {
                    const age = dealAge(deal);
                    const lastAct = lastActivity(deal);
                    const stageName = deal.stage_name || stages.find((s) => s.id === deal.stage_id)?.name || '';
                    return (
                      <tr
                        key={deal.id}
                        className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/customers/${deal.id}`)}
                      >
                        <td className="px-6 py-3 font-medium">
                          {deal.org_name || deal.title || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {deal.person_name || '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-700">
                          {deal.value > 0 ? `$${Number(deal.value).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3">{stageBadge(stageName)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {deal.owner_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {age > 0 ? `${age}d` : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {lastAct.getTime() > 0
                            ? lastAct.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">{statusBadge(deal.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
