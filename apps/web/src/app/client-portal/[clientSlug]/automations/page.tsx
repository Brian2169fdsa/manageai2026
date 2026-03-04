'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle, AlertTriangle, XCircle, Pause, HelpCircle } from 'lucide-react';

interface Automation {
  id: string;
  platform: string;
  external_url: string | null;
  status: string;
  health: string | null;
  last_run: string | null;
  error_count: number;
  run_count: number;
  ticket_id: string | null;
}

const HEALTH_ICONS: Record<string, { icon: typeof CheckCircle; color: string }> = {
  healthy: { icon: CheckCircle, color: 'text-green-500' },
  degraded: { icon: AlertTriangle, color: 'text-yellow-500' },
  failing: { icon: XCircle, color: 'text-red-500' },
  inactive: { icon: Pause, color: 'text-gray-400' },
  unknown: { icon: HelpCircle, color: 'text-gray-400' },
};

export default function AutomationsPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('client_automations')
        .select('*')
        .eq('client_id', clientSlug)
        .order('created_at', { ascending: false });

      setAutomations(data ?? []);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Automations</h1>
        <p className="text-sm text-gray-500 mt-1">
          {automations.length} automation{automations.length !== 1 ? 's' : ''} deployed
        </p>
      </div>

      {automations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">No automations deployed yet.</p>
          <a
            href={`/client-portal/${clientSlug}/request`}
            className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Request Your First Build
          </a>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Health</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Platform</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Run</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Runs</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {automations.map((auto) => {
                const hi = HEALTH_ICONS[auto.health ?? 'unknown'] ?? HEALTH_ICONS.unknown;
                const Icon = hi.icon;
                return (
                  <tr key={auto.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Icon className={`w-5 h-5 ${hi.color}`} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {auto.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700">{auto.status}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {auto.last_run
                        ? new Date(auto.last_run).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {auto.run_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={auto.error_count > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {auto.error_count ?? 0}
                      </span>
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
