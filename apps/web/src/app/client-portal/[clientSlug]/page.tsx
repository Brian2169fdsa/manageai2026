'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Activity, Bot, FileText, Zap } from 'lucide-react';
import Link from 'next/link';

interface ClientAccount {
  id: string;
  company_name: string;
  status: string;
  plan: string;
  health_score: number;
}

interface Stats {
  activeAutomations: number;
  totalBuilds: number;
  reportsCount: number;
  teammates: number;
}

export default function ClientHomePage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const [client, setClient] = useState<ClientAccount | null>(null);
  const [stats, setStats] = useState<Stats>({
    activeAutomations: 0,
    totalBuilds: 0,
    reportsCount: 0,
    teammates: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: acct } = await supabase
        .from('client_accounts')
        .select('*')
        .eq('id', clientSlug)
        .single();

      if (acct) setClient(acct);

      // Fetch stats in parallel
      const [autoRes, ticketRes, reportRes, tmRes] = await Promise.all([
        supabase
          .from('client_automations')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientSlug)
          .eq('status', 'active'),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('company_name', acct?.company_name ?? ''),
        supabase
          .from('client_reports')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientSlug),
        supabase
          .from('teammate_deployments')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientSlug)
          .eq('status', 'active'),
      ]);

      setStats({
        activeAutomations: autoRes.count ?? 0,
        totalBuilds: ticketRes.count ?? 0,
        reportsCount: reportRes.count ?? 0,
        teammates: tmRes.count ?? 0,
      });

      setLoading(false);
    }
    load();
  }, [clientSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const cards = [
    {
      label: 'Active Automations',
      value: stats.activeAutomations,
      icon: Zap,
      href: `/client-portal/${clientSlug}/automations`,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Total Builds',
      value: stats.totalBuilds,
      icon: Activity,
      href: `/client-portal/${clientSlug}/builds`,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Reports',
      value: stats.reportsCount,
      icon: FileText,
      href: `/client-portal/${clientSlug}/reports`,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'AI Teammates',
      value: stats.teammates,
      icon: Bot,
      href: '#',
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {client?.company_name ?? 'Client Portal'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan: <span className="capitalize">{client?.plan ?? 'N/A'}</span>
          {' · '}
          Health Score:{' '}
          <span
            className={
              (client?.health_score ?? 0) >= 80
                ? 'text-green-600'
                : (client?.health_score ?? 0) >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }
          >
            {client?.health_score ?? '—'}/100
          </span>
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-600">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/client-portal/${clientSlug}/request`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Request New Build
          </Link>
          <Link
            href={`/client-portal/${clientSlug}/automations`}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            View Automations
          </Link>
          <Link
            href={`/client-portal/${clientSlug}/reports`}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            View Reports
          </Link>
        </div>
      </div>
    </div>
  );
}
