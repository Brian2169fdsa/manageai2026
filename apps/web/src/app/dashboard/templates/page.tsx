'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Zap, BookOpen, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  platform: 'n8n' | 'make' | 'zapier';
  category: string;
  description: string;
  node_count: number;
  tags: string[];
  complexity?: string;
  trigger_type?: string;
}

const PAGE_SIZE = 48;

const PLATFORM_STYLES = {
  n8n:    { label: 'n8n',      class: 'bg-orange-100 text-orange-700 border-orange-200' },
  make:   { label: 'Make.com', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  zapier: { label: 'Zapier',   class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
};

const COMPLEXITY_STYLES: Record<string, string> = {
  Beginner:     'bg-green-100 text-green-700',
  Intermediate: 'bg-blue-100 text-blue-700',
  Advanced:     'bg-red-100 text-red-700',
};

// All categories — covers both legacy static templates and ingested workflows
const CATEGORIES = [
  'All',
  // From ingestion script
  'Sales & CRM',
  'AI & Automation',
  'Marketing',
  'Development',
  'HR & Recruiting',
  'Finance',
  'E-Commerce',
  'File Management',
  'Customer Support',
  'Communication',
  'Data',
  'Reporting',
  'General Automation',
  // Legacy (static templates) — kept so existing DB records still match
  'Lead Gen',
  'CRM',
  'Operations',
  'HR',
  'AI/ML',
];

const COMPLEXITY_OPTIONS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

// ── Static fallback (shown when DB has no templates yet) ─────────────────────
const STATIC_TEMPLATES: Template[] = [
  { id: 's1',  name: 'Lead Capture → CRM Sync',        platform: 'n8n',    category: 'Lead Gen',         description: 'Capture leads from any web form, enrich with Clearbit, and push to HubSpot or Salesforce with automatic deal creation.',              node_count: 8,  tags: ['HubSpot','Clearbit'],       complexity: 'Intermediate' },
  { id: 's2',  name: 'AI Email Campaign Automator',     platform: 'n8n',    category: 'Marketing',        description: 'Generate personalized email sequences with Claude AI, schedule sends via SendGrid, and track opens in Airtable.',                   node_count: 11, tags: ['Email Marketing','AI/LLM'], complexity: 'Advanced' },
  { id: 's3',  name: 'Invoice Processing & Approval',   platform: 'n8n',    category: 'Finance',          description: 'Parse PDF invoices with AI, route for approval via Slack, sync to QuickBooks, and archive to Google Drive.',                       node_count: 14, tags: ['Slack','Google Drive'],     complexity: 'Advanced' },
  { id: 's4',  name: 'Slack Notification Hub',          platform: 'n8n',    category: 'Communication',    description: 'Aggregate alerts from PagerDuty, GitHub, Stripe, and Jira into a unified Slack digest with smart deduplication.',                   node_count: 9,  tags: ['Slack','GitHub'],           complexity: 'Intermediate' },
  { id: 's5',  name: 'Support Ticket Router',           platform: 'n8n',    category: 'Customer Support', description: 'Classify inbound support emails using AI sentiment analysis, assign priority, and route to the correct Zendesk team queue.',         node_count: 10, tags: ['Zendesk','AI/LLM'],         complexity: 'Intermediate' },
  { id: 's6',  name: 'Employee Onboarding Workflow',    platform: 'n8n',    category: 'HR',               description: 'Trigger from BambooHR new hire event, provision Okta account, create Notion onboarding page, and send welcome Slack message.',    node_count: 13, tags: ['BambooHR','Notion'],        complexity: 'Advanced' },
  { id: 's7',  name: 'Social Media Cross-Poster',       platform: 'n8n',    category: 'Marketing',        description: 'Publish content from a Google Sheets calendar to Twitter/X, LinkedIn, and Instagram simultaneously with platform formatting.',       node_count: 7,  tags: ['Twitter/X','LinkedIn'],     complexity: 'Intermediate' },
  { id: 's8',  name: 'AI Content Writer Pipeline',      platform: 'n8n',    category: 'AI/ML',            description: 'Generate SEO blog posts with Claude, add images via Unsplash API, publish to WordPress, and post summary to Slack.',              node_count: 12, tags: ['AI/LLM','WordPress'],       complexity: 'Advanced' },
  { id: 's21', name: 'Lead Scoring & Router',           platform: 'make',   category: 'Lead Gen',         description: 'Score inbound leads from web forms using firmographic data, route hot leads to sales Slack channel, cold leads to nurture sequence.', node_count: 9, tags: ['HubSpot','Slack'],          complexity: 'Intermediate' },
  { id: 's22', name: 'HubSpot → Slack Deal Alerts',     platform: 'make',   category: 'CRM',              description: 'Send rich Slack notifications when HubSpot deals advance stages, including deal value, contact info, and next steps.',            node_count: 4,  tags: ['HubSpot','Slack'],          complexity: 'Beginner' },
  { id: 's41', name: 'New Lead → CRM + Slack Alert',    platform: 'zapier', category: 'Lead Gen',         description: 'Capture leads from Facebook Lead Ads or website forms, add to Salesforce, and post rich lead card to sales Slack channel.',       node_count: 4,  tags: ['Salesforce','Slack'],       complexity: 'Beginner' },
  { id: 's43', name: 'Stripe → QuickBooks Sync',        platform: 'zapier', category: 'Finance',          description: 'Sync Stripe payments, refunds, and subscriptions to QuickBooks Online in real-time with automatic invoice and customer matching.', node_count: 4, tags: ['Stripe'],                   complexity: 'Beginner' },
];

export default function TemplatesPage() {
  const router = useRouter();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [platform,   setPlatform]   = useState<'all' | 'n8n' | 'make' | 'zapier'>('all');
  const [category,   setCategory]   = useState('All');
  const [complexity, setComplexity] = useState('All');
  const [search,     setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [templates,  setTemplates]  = useState<Template[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page,       setPage]       = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [usingStatic, setUsingStatic] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [platform, category, complexity]);

  // ── Data loader ─────────────────────────────────────────────────────────────
  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('templates')
        .select('id, name, platform, category, description, node_count, tags, complexity, trigger_type', { count: 'exact' })
        .order('name')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (platform   !== 'all') query = query.eq('platform', platform);
      if (category   !== 'All') query = query.eq('category', category);
      if (complexity !== 'All') query = query.eq('complexity', complexity);
      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error, count } = await query;

      if (!error && data && (data.length > 0 || count !== null)) {
        setTemplates(data as Template[]);
        setTotalCount(count ?? data.length);
        setUsingStatic(false);
      } else {
        // Fall back to static templates, filtered client-side
        const filtered = STATIC_TEMPLATES.filter(t => {
          if (platform !== 'all' && t.platform !== platform) return false;
          if (category !== 'All' && t.category !== category) return false;
          if (complexity !== 'All' && t.complexity !== complexity) return false;
          if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
          }
          return true;
        });
        setTemplates(filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
        setTotalCount(filtered.length);
        setUsingStatic(true);
      }
    } catch {
      setTemplates(STATIC_TEMPLATES);
      setTotalCount(STATIC_TEMPLATES.length);
      setUsingStatic(true);
    } finally {
      setLoading(false);
    }
  }, [platform, category, complexity, debouncedSearch, page]);

  useEffect(() => { loadPage(); }, [loadPage]);

  function handleUseTemplate(t: Template) {
    const what = `Based on the "${t.name}" template: ${t.description}`;
    const params = new URLSearchParams({
      platform: t.platform,
      project_name: t.name,
      what_to_build: what,
    });
    router.push(`/portal/new-ticket?${params.toString()}`);
  }

  const totalPages = totalCount !== null ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const hasFilters = platform !== 'all' || category !== 'All' || complexity !== 'All' || debouncedSearch !== '';

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automation Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and deploy pre-built workflows for n8n, Make.com, and Zapier
          </p>
        </div>
        {totalCount !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{totalCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">templates</div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Platform tabs */}
        <div className="flex items-center rounded-lg border bg-muted/30 p-1 gap-0.5">
          {(['all', 'n8n', 'make', 'zapier'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                platform === p
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'all' ? 'All Platforms' : p === 'make' ? 'Make.com' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Category */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Complexity */}
        <Select value={complexity} onValueChange={setComplexity}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SlidersHorizontal size={13} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Complexity" />
          </SelectTrigger>
          <SelectContent>
            {COMPLEXITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Active filters + result count */}
        <div className="flex items-center gap-2 ml-auto">
          {hasFilters && (
            <button
              onClick={() => { setPlatform('all'); setCategory('All'); setComplexity('All'); setSearch(''); }}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
          {!loading && totalCount !== null && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Static fallback notice */}
      {usingStatic && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          Showing sample templates. Run the ingestion script to load the full library.
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(PAGE_SIZE > 12 ? 12 : PAGE_SIZE)].map((_, i) => (
            <div key={i} className="h-52 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <BookOpen size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">No templates match your filters</p>
          <button
            onClick={() => { setPlatform('all'); setCategory('All'); setComplexity('All'); setSearch(''); }}
            className="text-blue-600 text-sm mt-2 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map(t => (
            <TemplateCard key={t.id} template={t} onUse={handleUseTemplate} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage(p => p - 1)}
            className="gap-1"
          >
            <ChevronLeft size={14} /> Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages.toLocaleString()}
            {' · '}
            {((page * PAGE_SIZE) + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, totalCount ?? 0).toLocaleString()} of {(totalCount ?? 0).toLocaleString()}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage(p => p + 1)}
            className="gap-1"
          >
            Next <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({
  template: t,
  onUse,
}: {
  template: Template;
  onUse: (t: Template) => void;
}) {
  const plat = PLATFORM_STYLES[t.platform] ?? PLATFORM_STYLES.n8n;
  const complexityClass = t.complexity ? (COMPLEXITY_STYLES[t.complexity] ?? '') : '';

  return (
    <div className="flex flex-col border rounded-xl bg-white hover:shadow-md transition-shadow p-4 gap-3 min-h-[13rem]">
      {/* Top badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold border', plat.class)}>
          {plat.label}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium truncate max-w-[120px]">
          {t.category}
        </span>
        {t.complexity && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', complexityClass)}>
            {t.complexity}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-0.5 shrink-0">
          <Zap size={10} />
          {t.node_count}
        </span>
      </div>

      {/* Name + description */}
      <div className="flex-1">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{t.name}</h3>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">
          {t.description}
        </p>
      </div>

      {/* Tags */}
      {t.tags && t.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {tag}
            </Badge>
          ))}
          {t.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground self-center">+{t.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* CTA */}
      <Button
        size="sm"
        className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
        onClick={() => onUse(t)}
      >
        Use Template
      </Button>
    </div>
  );
}
