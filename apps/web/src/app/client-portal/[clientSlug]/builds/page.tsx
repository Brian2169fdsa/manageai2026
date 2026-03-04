'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface Ticket {
  id: string;
  project_name: string | null;
  ticket_type: string | null;
  status: string;
  priority: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-gray-100 text-gray-700',
  ANALYZING: 'bg-blue-100 text-blue-700',
  QUESTIONS_PENDING: 'bg-yellow-100 text-yellow-700',
  BUILDING: 'bg-indigo-100 text-indigo-700',
  REVIEW_PENDING: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  DEPLOYED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-gray-100 text-gray-500',
};

export default function BuildsPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    async function load() {
      // Get company name from client_accounts
      const { data: acct } = await supabase
        .from('client_accounts')
        .select('company_name')
        .eq('id', clientSlug)
        .single();

      const name = acct?.company_name ?? '';
      setCompanyName(name);

      if (name) {
        const { data } = await supabase
          .from('tickets')
          .select('id, project_name, ticket_type, status, priority, created_at')
          .ilike('company_name', `%${name}%`)
          .order('created_at', { ascending: false });

        setTickets(data ?? []);
      }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Builds</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tickets.length} build{tickets.length !== 1 ? 's' : ''} for {companyName || 'your organization'}
          </p>
        </div>
        <a
          href={`/client-portal/${clientSlug}/request`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Request New Build
        </a>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">No builds yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Platform</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {t.project_name || 'Untitled'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                      {t.ticket_type ?? 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{t.priority ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(t.created_at).toLocaleDateString()}
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
