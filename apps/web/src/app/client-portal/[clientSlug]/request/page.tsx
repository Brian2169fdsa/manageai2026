'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function RequestBuildPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    project_name: '',
    ticket_type: 'n8n',
    what_to_build: '',
    expected_outcome: '',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Get client account for company_name
      const { data: acct } = await supabase
        .from('client_accounts')
        .select('company_name, contact_email')
        .eq('id', clientSlug)
        .single();

      const { error: insertErr } = await supabase.from('tickets').insert({
        company_name: acct?.company_name ?? 'Client Portal',
        contact_email: acct?.contact_email ?? null,
        project_name: form.project_name,
        ticket_type: form.ticket_type,
        what_to_build: form.what_to_build,
        expected_outcome: form.expected_outcome,
        priority: form.priority,
        status: 'SUBMITTED',
        created_at: new Date().toISOString(),
        notes: `Submitted via Client Portal (client_id: ${clientSlug})`,
      });

      if (insertErr) {
        setError(insertErr.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push(`/client-portal/${clientSlug}/builds`), 2000);
    } catch {
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-gray-900">Build Request Submitted</h2>
          <p className="text-gray-500 mt-2">
            Your ManageAI team will review it shortly. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request a New Build</h1>
        <p className="text-sm text-gray-500 mt-1">
          Describe what you need and our team will get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <label htmlFor="project_name" className="block text-sm font-medium text-gray-700 mb-1">
            Project Name
          </label>
          <input
            id="project_name"
            type="text"
            value={form.project_name}
            onChange={(e) => updateField('project_name', e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="e.g., Lead Enrichment Automation"
          />
        </div>

        <div>
          <label htmlFor="ticket_type" className="block text-sm font-medium text-gray-700 mb-1">
            Platform
          </label>
          <select
            id="ticket_type"
            value={form.ticket_type}
            onChange={(e) => updateField('ticket_type', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="n8n">n8n</option>
            <option value="make">Make.com</option>
            <option value="zapier">Zapier</option>
            <option value="other">Not sure / Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="what_to_build" className="block text-sm font-medium text-gray-700 mb-1">
            What do you need built?
          </label>
          <textarea
            id="what_to_build"
            value={form.what_to_build}
            onChange={(e) => updateField('what_to_build', e.target.value)}
            required
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            placeholder="Describe the automation you need — what triggers it, what it should do, what systems are involved..."
          />
        </div>

        <div>
          <label htmlFor="expected_outcome" className="block text-sm font-medium text-gray-700 mb-1">
            Expected Outcome
          </label>
          <textarea
            id="expected_outcome"
            value={form.expected_outcome}
            onChange={(e) => updateField('expected_outcome', e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            placeholder="What result do you expect? e.g., 'Leads are automatically enriched and added to our CRM'"
          />
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="priority"
            value={form.priority}
            onChange={(e) => updateField('priority', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="low">Low — when you get to it</option>
            <option value="medium">Medium — within a week</option>
            <option value="high">High — urgent, ASAP</option>
          </select>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white font-medium rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Build Request'}
        </button>
      </form>
    </div>
  );
}
