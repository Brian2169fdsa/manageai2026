'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { FileText } from 'lucide-react';

interface Report {
  id: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  sent_at: string | null;
  created_at: string;
  metrics: Record<string, unknown> | null;
}

export default function ReportsPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('client_reports')
        .select('id, report_type, period_start, period_end, sent_at, created_at, metrics')
        .eq('client_id', clientSlug)
        .order('created_at', { ascending: false });

      setReports(data ?? []);
      setLoading(false);
    }
    load();
  }, [clientSlug]);

  async function viewReport(id: string) {
    setSelectedReport(id);
    const { data } = await supabase
      .from('client_reports')
      .select('content')
      .eq('id', id)
      .single();
    setReportContent(data?.content ?? 'Report content not available.');
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Performance Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          {reports.length} report{reports.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No reports generated yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Monthly reports are generated automatically by your account manager.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 capitalize">
                      {r.report_type} Report
                    </h3>
                    <p className="text-sm text-gray-500">
                      {r.period_start && r.period_end
                        ? `${new Date(r.period_start).toLocaleDateString()} — ${new Date(r.period_end).toLocaleDateString()}`
                        : `Generated ${new Date(r.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => viewReport(r.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Report
                </button>
              </div>

              {selectedReport === r.id && reportContent && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: reportContent }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
