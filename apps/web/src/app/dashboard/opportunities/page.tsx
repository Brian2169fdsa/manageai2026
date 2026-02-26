'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { OpportunityAssessment } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, PlusCircle, FileBarChart2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  converted: 'Converted',
};

function formatCurrency(n: number): string {
  if (!n) return '–';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export default function OpportunitiesPage() {
  const [assessments, setAssessments] = useState<OpportunityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tableError, setTableError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('opportunity_assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          const isMissing =
            error.message?.includes('does not exist') ||
            error.code === 'PGRST116' ||
            (error as { code?: string }).code === '42P01';
          if (isMissing) {
            setTableError('missing');
          }
        }
        setAssessments((data as OpportunityAssessment[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = search
    ? assessments.filter(
        (a) =>
          a.company_name?.toLowerCase().includes(search.toLowerCase()) ||
          a.contact_name?.toLowerCase().includes(search.toLowerCase())
      )
    : assessments;

  const convertedCount = assessments.filter((a) => a.status === 'converted').length;
  const sentCount = assessments.filter((a) => a.status === 'sent').length;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Opportunity Assessments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '–' : `${filtered.length} assessments — ${convertedCount} converted, ${sentCount} sent`}
          </p>
        </div>
        <Link href="/dashboard/opportunities/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
            <PlusCircle size={15} />
            New Assessment
          </Button>
        </Link>
      </div>

      {/* Missing table banner */}
      {tableError === 'missing' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-900">Database table not created yet</div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                The <code className="font-mono bg-amber-100 px-1 rounded">opportunity_assessments</code> table
                is missing from your Supabase database. Run the migration SQL to activate this feature.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="https://supabase.com/dashboard/project/kozfvbduvkpkvcastsah/sql/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-amber-800 underline hover:text-amber-900"
                >
                  Open Supabase SQL Editor →
                </a>
                <span className="text-xs text-amber-700">
                  Paste <strong>apps/web/scripts/migrate-opportunity-assessments.sql</strong> and click Run
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by company or contact name..."
          className="pl-9 h-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileBarChart2 size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">
            {search ? 'No assessments match your search' : 'No assessments yet'}
          </p>
          {!search && (
            <Link href="/dashboard/opportunities/new">
              <Button variant="outline" size="sm" className="mt-4 gap-2">
                <PlusCircle size={13} /> Create first assessment
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Company / Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Industry
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Annual Savings
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Opportunities
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((assessment) => {
                const metrics = assessment.assessment?.metrics;
                return (
                  <tr
                    key={assessment.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/opportunities/${assessment.id}`}>
                        <div className="font-medium group-hover:text-blue-600 transition-colors">
                          {assessment.company_name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {assessment.contact_name}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {assessment.form_data?.industry || '–'}
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald-700">
                      {metrics?.annual_cost_savings
                        ? formatCurrency(metrics.annual_cost_savings)
                        : '–'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {metrics?.opportunities_count != null ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          {metrics.opportunities_count}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          STATUS_BADGE[assessment.status] ?? 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {STATUS_LABEL[assessment.status] ?? assessment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(assessment.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
