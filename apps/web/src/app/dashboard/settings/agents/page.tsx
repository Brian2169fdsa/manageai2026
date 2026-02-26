'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Bot,
  RefreshCw,
} from 'lucide-react';
import { SCHEDULED_JOBS, ScheduledJob } from '@/lib/scheduler/index';

interface JobRun {
  id: string;
  job_name: string;
  department: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  output: string | null;
  error: string | null;
}

interface RunState {
  loading: boolean;
  result: { success: boolean; output: string; duration: number } | null;
}

function cronLabel(cron: string): string {
  const map: Record<string, string> = {
    '0 7 * * 1-5': 'Daily 7am (weekdays)',
    '0 8 * * 1-5': 'Daily 8am (weekdays)',
    '0 9 * * 1-5': 'Daily 9am (weekdays)',
    '0 8 * * 1': 'Mondays 8am',
    '0 9 1 * *': '1st of month 9am',
    '0 10 * * 1': 'Mondays 10am',
  };
  return map[cron] ?? cron;
}

function deptColor(dept: string): string {
  const colors: Record<string, string> = {
    ceo: 'bg-indigo-100 text-indigo-700',
    sales: 'bg-pink-100 text-pink-700',
    engineering: 'bg-emerald-100 text-emerald-700',
    delivery: 'bg-sky-100 text-sky-700',
    marketing: 'bg-amber-100 text-amber-700',
  };
  return colors[dept] ?? 'bg-gray-100 text-gray-700';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AgentJobsPage() {
  const [recentRuns, setRecentRuns] = useState<JobRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [enabledOverrides, setEnabledOverrides] = useState<Record<string, boolean>>({});

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const { data } = await supabase
        .from('scheduled_job_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      setRecentRuns(data ?? []);
    } catch {
      setRecentRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  async function handleRunNow(job: ScheduledJob) {
    setRunStates((prev) => ({
      ...prev,
      [job.name]: { loading: true, result: null },
    }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ job: job.name }),
      });
      const data = await res.json();
      setRunStates((prev) => ({
        ...prev,
        [job.name]: {
          loading: false,
          result: {
            success: data.success ?? res.ok,
            output: data.output ?? data.error ?? 'No output',
            duration: data.duration ?? 0,
          },
        },
      }));
      // Refresh run history
      fetchRuns();
    } catch (err) {
      setRunStates((prev) => ({
        ...prev,
        [job.name]: {
          loading: false,
          result: {
            success: false,
            output: err instanceof Error ? err.message : 'Request failed',
            duration: 0,
          },
        },
      }));
    }
  }

  function toggleEnabled(jobName: string, current: boolean) {
    setEnabledOverrides((prev) => ({ ...prev, [jobName]: !current }));
  }

  // Merge static enabled with any local overrides
  const jobsWithState = SCHEDULED_JOBS.map((job) => ({
    ...job,
    enabled: enabledOverrides[job.name] ?? job.enabled,
  }));

  // Most recent run per job (recentRuns is already sorted desc by started_at)
  const lastRunByJob = recentRuns.reduce<Record<string, JobRun>>((acc, run) => {
    if (!acc[run.job_name]) acc[run.job_name] = run;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="text-[#4A8FD6]" size={28} />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Scheduled Agent Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Agents that run automatically on a schedule — no human prompt needed
            </p>
          </div>
        </div>
        <button
          onClick={fetchRuns}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md border border-gray-200 hover:border-gray-300 transition"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Schedule</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last Run</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobsWithState.map((job) => {
              const state = runStates[job.name];
              return (
                <tr key={job.name} className="hover:bg-gray-50 transition">
                  {/* Job name */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {job.name
                        .split('-')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                    </div>
                    <div className="text-xs text-gray-400">{job.agentName}</div>
                  </td>

                  {/* Department badge */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${deptColor(job.department)}`}
                    >
                      {job.department}
                    </span>
                  </td>

                  {/* Schedule */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Clock size={13} />
                      {cronLabel(job.schedule)}
                    </div>
                  </td>

                  {/* Last Run */}
                  <td className="px-4 py-3 text-xs">
                    {loadingRuns ? (
                      <span className="text-gray-300">—</span>
                    ) : lastRunByJob[job.name] ? (
                      <div>
                        <span
                          className={
                            lastRunByJob[job.name].status === 'completed'
                              ? 'text-emerald-600'
                              : lastRunByJob[job.name].status === 'failed'
                                ? 'text-red-500'
                                : 'text-amber-500'
                          }
                        >
                          {timeAgo(lastRunByJob[job.name].started_at)}
                        </span>
                        <span className="ml-1 text-gray-400 capitalize">
                          · {lastRunByJob[job.name].status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>

                  {/* Toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEnabled(job.name, job.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        job.enabled ? 'bg-[#4A8FD6]' : 'bg-gray-300'
                      }`}
                      title={job.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          job.enabled ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="ml-2 text-xs text-gray-500">
                      {job.enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>

                  {/* Run Now + inline result */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {state?.result && (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            state.result.success ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {state.result.success ? (
                            <CheckCircle size={13} />
                          ) : (
                            <XCircle size={13} />
                          )}
                          {formatDuration(state.result.duration)}
                        </span>
                      )}
                      <button
                        onClick={() => handleRunNow(job)}
                        disabled={state?.loading || !job.enabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#4A8FD6] text-white hover:bg-[#3a7ec5] disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {state?.loading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                        {state?.loading ? 'Running…' : 'Run Now'}
                      </button>
                    </div>
                    {/* Inline output preview */}
                    {state?.result && (
                      <div
                        className={`mt-1.5 text-left text-xs p-2 rounded border max-w-xs ml-auto ${
                          state.result.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {state.result.output.slice(0, 200)}
                        {state.result.output.length > 200 && '…'}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent Runs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Recent Runs</h2>
          <span className="text-xs text-gray-400">Last 20</span>
        </div>

        {loadingRuns ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={16} />
            Loading run history…
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No runs yet. Use &quot;Run Now&quot; above to trigger a job manually.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Job</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Started</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentRuns.map((run) => {
                const durationMs =
                  run.completed_at && run.started_at
                    ? new Date(run.completed_at).getTime() -
                      new Date(run.started_at).getTime()
                    : null;
                const isSuccess = run.status === 'completed';
                const isFailed = run.status === 'failed';

                return (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">
                        {run.job_name
                          .split('-')
                          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {timeAgo(run.started_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {durationMs !== null ? formatDuration(durationMs) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {isSuccess && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle size={13} />
                          Completed
                        </span>
                      )}
                      {isFailed && (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle size={13} />
                          Failed
                        </span>
                      )}
                      {!isSuccess && !isFailed && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Loader2 size={13} className="animate-spin" />
                          {run.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {run.output ?? run.error ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
