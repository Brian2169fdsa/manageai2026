'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Zap, BookOpen, ChevronLeft, ChevronRight,
  SlidersHorizontal, X, Download, ExternalLink,
} from 'lucide-react';
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
  source_repo?: string;
  json_template?: unknown;
}

interface CountsData {
  total: number;
  platforms: { n8n: number; make: number; zapier: number };
  categories: { name: string; count: number }[];
  topTags: { tag: string; count: number }[];
}

const PAGE_SIZE = 48;

const PLATFORM_STYLES = {
  n8n:    { label: 'n8n',      color: '#FF6D5A', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  make:   { label: 'Make.com', color: '#6D00CC', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  zapier: { label: 'Zapier',   color: '#FF4A00', class: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const COMPLEXITY_STYLES: Record<string, string> = {
  Beginner:     'bg-green-100 text-green-700',
  Intermediate: 'bg-blue-100 text-blue-700',
  Advanced:     'bg-red-100 text-red-700',
};

export default function TemplatesPage() {
  const router = useRouter();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [platform,   setPlatform]   = useState<'all' | 'n8n' | 'make' | 'zapier'>('all');
  const [category,   setCategory]   = useState('');
  const [complexity, setComplexity] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search,     setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Data state ────────────────────────────────────────────────────────────
  const [templates,  setTemplates]  = useState<Template[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page,       setPage]       = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [counts,     setCounts]     = useState<CountsData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [usingStatic, setUsingStatic] = useState(false);

  // Build category options from counts data
  const categoryOptions = counts ? ['All', ...counts.categories.map((c) => c.name)] : ['All'];

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
  useEffect(() => { setPage(0); }, [platform, category, complexity, selectedTags]);

  // ── Load counts (sidebar) ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/templates/counts')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setCounts(d); })
      .catch(() => null);
  }, []);

  // ── Load templates ─────────────────────────────────────────────────────────
  const loadPage = useCallback(async () => {
    setLoading(true);
    setUsingStatic(false);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: 'name',
      });
      if (platform !== 'all') params.set('platform', platform);
      if (category) params.set('category', category);
      if (complexity) params.set('complexity', complexity);
      if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
      if (debouncedSearch) params.set('q', debouncedSearch);

      const res = await fetch(`/api/templates?${params.toString()}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      if (data.templates && data.templates.length > 0 || data.total > 0) {
        setTemplates(data.templates);
        setTotalCount(data.total);
      } else {
        // If no results from API, show empty state (not static fallback)
        setTemplates([]);
        setTotalCount(0);
      }
    } catch {
      setTemplates([]);
      setTotalCount(0);
      setUsingStatic(true);
    } finally {
      setLoading(false);
    }
  }, [platform, category, complexity, selectedTags, debouncedSearch, page]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // ── Load template detail ──────────────────────────────────────────────────
  async function openDetail(t: Template) {
    setSelectedTemplate(t);
    setShowJsonPreview(false);
    if (!t.json_template) {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/templates/${t.id}`);
        if (res.ok) {
          const full = await res.json();
          setSelectedTemplate(full);
        }
      } catch { /* ok */ }
      setDetailLoading(false);
    }
  }

  function handleUseTemplate(t: Template) {
    const what = `Based on the "${t.name}" template: ${t.description}`;
    const params = new URLSearchParams({
      platform: t.platform,
      project_name: t.name,
      what_to_build: what,
    });
    router.push(`/portal/new-ticket?${params.toString()}`);
  }

  function handleDownloadJson(t: Template) {
    if (!t.json_template) return;
    const blob = new Blob([JSON.stringify(t.json_template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function clearAllFilters() {
    setPlatform('all');
    setCategory('');
    setComplexity('');
    setSelectedTags([]);
    setSearch('');
  }

  const totalPages = totalCount !== null ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const hasFilters = platform !== 'all' || category !== '' || complexity !== '' || selectedTags.length > 0 || debouncedSearch !== '';

  return (
    <>
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
          {(['all', 'n8n', 'make', 'zapier'] as const).map((p) => {
            const label = p === 'all' ? 'All Platforms' : PLATFORM_STYLES[p]?.label ?? p;
            const count = p === 'all' ? counts?.total : counts?.platforms?.[p];
            const dotColor = p !== 'all' ? PLATFORM_STYLES[p]?.color : undefined;
            return (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  platform === p
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {dotColor && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                )}
                {label}
                {count !== undefined && count !== null && (
                  <span className="text-[10px] tabular-nums opacity-60 ml-0.5">{count.toLocaleString()}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Category */}
        <Select value={category || 'All'} onValueChange={(v) => setCategory(v === 'All' ? '' : v)}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Complexity */}
        <Select value={complexity || 'All'} onValueChange={(v) => setComplexity(v === 'All' ? '' : v)}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SlidersHorizontal size={13} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Complexity" />
          </SelectTrigger>
          <SelectContent>
            {['All', 'Beginner', 'Intermediate', 'Advanced'].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Active filters + result count */}
        <div className="flex items-center gap-2 ml-auto">
          {hasFilters && (
            <button
              onClick={clearAllFilters}
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

      {/* Active tag pills */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtering by app:</span>
          {selectedTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="flex items-center gap-1 text-[11px] bg-blue-600 text-white rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-700 transition-colors"
            >
              {tag} <X size={9} />
            </button>
          ))}
          <button onClick={() => setSelectedTags([])} className="text-xs text-blue-600 hover:underline ml-1">Clear</button>
        </div>
      )}

      {usingStatic && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          Showing limited results. Run <code className="font-mono">npm run ingest-templates</code> to load the full library.
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-52 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <BookOpen size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">No templates match your filters</p>
          <button
            onClick={clearAllFilters}
            className="text-blue-600 text-sm mt-2 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onOpen={openDetail} onUse={handleUseTemplate} onTagClick={toggleTag} selectedTags={selectedTags} />
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
            onClick={() => setPage((p) => p - 1)}
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
            onClick={() => setPage((p) => p + 1)}
            className="gap-1"
          >
            Next <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>

      {/* ── Detail slide-over ─────────────────────────────────────────────── */}
      {selectedTemplate && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setSelectedTemplate(null)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-lg font-bold leading-snug line-clamp-2">{selectedTemplate.name}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold border', PLATFORM_STYLES[selectedTemplate.platform]?.class)}>
                    {PLATFORM_STYLES[selectedTemplate.platform]?.label}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {selectedTemplate.category}
                  </span>
                  {selectedTemplate.complexity && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', COMPLEXITY_STYLES[selectedTemplate.complexity] ?? '')}>
                      {selectedTemplate.complexity}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                    <Zap size={10} /> {selectedTemplate.node_count} nodes
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedTemplate.description}</p>

              {/* All tags */}
              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Integrations</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          toggleTag(tag);
                          setSelectedTemplate(null);
                        }}
                        className={cn(
                          'text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors',
                          selectedTags.includes(tag)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-muted text-muted-foreground hover:border-blue-400 hover:text-blue-700'
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Platform', value: PLATFORM_STYLES[selectedTemplate.platform]?.label },
                  { label: 'Trigger', value: selectedTemplate.trigger_type || '—' },
                  { label: 'Complexity', value: selectedTemplate.complexity || '—' },
                  { label: 'Node count', value: String(selectedTemplate.node_count) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-muted p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                    <div className="text-sm font-medium">{value}</div>
                  </div>
                ))}
              </div>

              {/* Source attribution */}
              {selectedTemplate.source_repo && (
                <p className="text-[10px] text-muted-foreground">
                  Source: {selectedTemplate.source_repo}
                </p>
              )}

              {/* JSON preview */}
              {detailLoading ? (
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
              ) : !!selectedTemplate.json_template && (
                <div>
                  <button
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-2 font-medium"
                  >
                    <ExternalLink size={11} />
                    {showJsonPreview ? 'Hide' : 'Preview'} workflow JSON
                  </button>
                  {showJsonPreview && (
                    <pre className="text-[10px] bg-[#1A1A2E] text-[#d4d4d4] rounded-lg p-4 overflow-auto max-h-64 font-mono leading-relaxed">
                      {JSON.stringify(selectedTemplate.json_template, null, 2).split('\n').slice(0, 60).join('\n')}
                      {JSON.stringify(selectedTemplate.json_template, null, 2).split('\n').length > 60 && '\n... (truncated)'}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t p-4 flex gap-3">
              {!!selectedTemplate.json_template && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleDownloadJson(selectedTemplate)}
                >
                  <Download size={13} /> Download JSON
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                onClick={() => {
                  handleUseTemplate(selectedTemplate);
                  setSelectedTemplate(null);
                }}
              >
                <SlidersHorizontal size={13} /> Create Ticket from Template
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({
  template: t,
  onOpen,
  onUse,
  onTagClick,
  selectedTags,
}: {
  template: Template;
  onOpen: (t: Template) => void;
  onUse: (t: Template) => void;
  onTagClick: (tag: string) => void;
  selectedTags: string[];
}) {
  const plat = PLATFORM_STYLES[t.platform] ?? PLATFORM_STYLES.n8n;
  const complexityClass = t.complexity ? (COMPLEXITY_STYLES[t.complexity] ?? '') : '';

  return (
    <div
      className="flex flex-col border rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all p-4 gap-3 min-h-[13rem] cursor-pointer group"
      onClick={() => onOpen(t)}
    >
      {/* Top badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold border shrink-0', plat.class)}>
          {plat.label}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium truncate max-w-[110px]">
          {t.category}
        </span>
        {t.complexity && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', complexityClass)}>
            {t.complexity}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-0.5 shrink-0">
          <Zap size={10} />{t.node_count}
        </span>
      </div>

      {/* Name + desc */}
      <div className="flex-1">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">{t.name}</h3>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">{t.description}</p>
      </div>

      {/* Tags */}
      {t.tags && t.tags.length > 0 && (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {t.tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-muted text-muted-foreground hover:border-blue-400 hover:text-blue-600'
              )}
            >
              {tag}
            </button>
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
        onClick={(e) => { e.stopPropagation(); onUse(t); }}
      >
        Use Template
      </Button>
    </div>
  );
}
