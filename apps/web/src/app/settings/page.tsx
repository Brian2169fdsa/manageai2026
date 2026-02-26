'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Rocket, ChevronRight, CheckCircle2, AlertCircle,
  Database, BarChart3, Loader2, TableProperties,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableStatus {
  name: string;
  description: string;
  exists: boolean;
  error: string | null;
}

interface DbStatus {
  total: number;
  existing: number;
  missing: number;
  tables: TableStatus[];
  all_ok: boolean;
}

interface IntegrationStatus {
  pipedrive: 'connected' | 'error' | 'checking';
  templateCount: number | null;
}

const INTEGRATIONS = [
  {
    key: 'supabase',
    name: 'Supabase',
    description: 'Database and authentication',
    icon: '🗄️',
    status: 'connected' as const,
  },
  {
    key: 'anthropic',
    name: 'Anthropic Claude',
    description: 'AI analysis and build generation',
    icon: '🤖',
    status: 'connected' as const,
  },
  {
    key: 'pipedrive',
    name: 'Pipedrive CRM',
    description: 'Sales pipeline and deal management',
    icon: '🎯',
    status: 'dynamic' as const,
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Team notifications — add SLACK_BOT_TOKEN to enable',
    icon: '💬',
    status: 'setup_required' as const,
  },
  {
    key: 'resend',
    name: 'Resend',
    description: 'Email delivery — add RESEND_API_KEY to enable',
    icon: '✉️',
    status: 'setup_required' as const,
  },
];

const CONFIG_SECTIONS = [
  {
    href: '/dashboard/settings/deploy',
    icon: Rocket,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    title: 'Deploy Configuration',
    description: 'Configure n8n, Make.com, and Zapier connection settings for one-click deployment',
    badge: 'Active',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    href: '/dashboard/analytics',
    icon: BarChart3,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
    title: 'Analytics',
    description: 'Platform usage metrics, build success rates, and automation statistics',
    badge: 'Live',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  {
    href: '/dashboard/templates',
    icon: Database,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
    title: 'Template Library',
    description: 'Browse and manage the 8,076+ workflow templates across n8n, Make.com, and Zapier',
    badge: '8,076+',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
];

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus>({
    pipedrive: 'checking',
    templateCount: null,
  });
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [sqlCopied, setSqlCopied] = useState(false);

  const MIGRATION_SQL = `-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/kozfvbduvkpkvcastsah/sql/new
-- File: apps/web/scripts/migrate-opportunity-assessments.sql

CREATE TABLE IF NOT EXISTS opportunity_assessments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_deal_id   INTEGER,
  company_name        TEXT        NOT NULL,
  contact_name        TEXT        NOT NULL,
  form_data           JSONB       NOT NULL DEFAULT '{}',
  transcript          TEXT,
  assessment          JSONB       NOT NULL DEFAULT '{}',
  html_content        TEXT,
  status              TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'sent', 'converted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE opportunity_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated read"
  ON opportunity_assessments FOR SELECT TO authenticated USING (true);`;

  function copyMigrationSql() {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    });
  }

  useEffect(() => {
    // Test Pipedrive connectivity
    fetch('/api/pipedrive/deals?limit=1')
      .then((r) => (r.ok ? 'connected' : 'error'))
      .catch(() => 'error' as const)
      .then((s) =>
        setStatus((prev) => ({ ...prev, pipedrive: s as 'connected' | 'error' }))
      );

    // Get template count
    fetch('/api/templates/counts')
      .then((r) => r.json())
      .then((data) =>
        setStatus((prev) => ({ ...prev, templateCount: data?.total ?? null }))
      )
      .catch(() => {});

    // Check DB table status
    fetch('/api/admin/db-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setDbStatus(data);
        setDbLoading(false);
      })
      .catch(() => setDbLoading(false));
  }, []);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration and integration management
        </p>
      </div>

      {/* Configuration sections */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Configuration
        </h2>
        <div className="space-y-2">
          {CONFIG_SECTIONS.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                <CardContent className="pt-4 pb-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-2.5 rounded-xl shrink-0', section.iconBg)}>
                      <section.icon size={18} className={section.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold group-hover:text-blue-700 transition-colors">
                          {section.title}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                            section.badgeClass
                          )}
                        >
                          {section.badge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-muted-foreground shrink-0 group-hover:text-blue-600 transition-colors"
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Integration status */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Integrations
        </h2>
        <Card>
          <CardContent className="pt-0 pb-0 px-0">
            <div className="divide-y">
              {INTEGRATIONS.map((integration) => {
                const resolvedStatus =
                  integration.status === 'dynamic'
                    ? status.pipedrive
                    : integration.status;

                return (
                  <div
                    key={integration.key}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <span className="text-xl shrink-0">{integration.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{integration.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {integration.description}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {resolvedStatus === 'checking' ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          <Loader2 size={10} className="animate-spin" />
                          Checking
                        </span>
                      ) : resolvedStatus === 'connected' ? (
                        <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                          <CheckCircle2 size={11} /> Connected
                        </span>
                      ) : resolvedStatus === 'setup_required' ? (
                        <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                          <AlertCircle size={11} /> Setup Required
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                          <AlertCircle size={11} /> Not Configured
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Add{' '}
          <code className="bg-muted px-1 rounded text-[11px]">SLACK_BOT_TOKEN</code> and{' '}
          <code className="bg-muted px-1 rounded text-[11px]">RESEND_API_KEY</code> to your
          environment variables to activate those integrations.
        </p>
      </section>

      {/* Database Tables */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Database Tables
        </h2>
        <Card>
          <CardContent className="pt-4 pb-4 px-5">
            {dbLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={13} className="animate-spin" />
                Checking tables…
              </div>
            ) : !dbStatus ? (
              <p className="text-sm text-muted-foreground">Could not check table status</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <TableProperties size={15} className="text-muted-foreground" />
                    {dbStatus.existing} / {dbStatus.total} tables exist
                  </div>
                  {dbStatus.all_ok ? (
                    <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                      <CheckCircle2 size={11} /> All tables ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                      <AlertCircle size={11} /> {dbStatus.missing} missing
                    </span>
                  )}
                </div>

                {/* Show missing tables */}
                {dbStatus.missing > 0 && (
                  <div className="space-y-2 border rounded-lg overflow-hidden">
                    {dbStatus.tables.filter((t) => !t.exists).map((t) => (
                      <div key={t.name} className="flex items-start gap-3 px-3 py-2 bg-amber-50 border-b last:border-b-0">
                        <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <code className="text-xs font-mono text-amber-900">{t.name}</code>
                          <div className="text-xs text-amber-700">{t.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Migration SQL for missing tables */}
                {dbStatus.missing > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">Migration SQL to run in Supabase SQL Editor:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={copyMigrationSql}
                          className="text-xs px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted transition-colors font-medium"
                        >
                          {sqlCopied ? '✓ Copied!' : 'Copy SQL'}
                        </button>
                        <a
                          href="https://supabase.com/dashboard/project/kozfvbduvkpkvcastsah/sql/new"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                        >
                          Open SQL Editor →
                        </a>
                      </div>
                    </div>
                    <pre className="text-[10px] font-mono bg-muted rounded-lg p-3 overflow-x-auto leading-relaxed text-muted-foreground whitespace-pre-wrap border">
{`-- Run: apps/web/scripts/migrate-opportunity-assessments.sql
-- Also run: apps/web/scripts/migrate-new-tables.sql (for client_accounts etc.)
CREATE TABLE IF NOT EXISTS opportunity_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_deal_id INTEGER,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}',
  transcript TEXT,
  assessment JSONB NOT NULL DEFAULT '{}',
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE opportunity_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "authenticated read"
  ON opportunity_assessments FOR SELECT TO authenticated USING (true);`}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Platform info */}
      {status.templateCount !== null && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Platform
          </h2>
          <Card>
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 shrink-0">
                  <Database size={16} className="text-slate-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {status.templateCount.toLocaleString()} Templates
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Available across n8n, Make.com, and Zapier
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
