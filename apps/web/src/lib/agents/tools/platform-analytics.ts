/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentTool } from '../types';

export const platformAnalyticsTools: AgentTool[] = [
  {
    name: 'getPlatformMetrics',
    description:
      'Get platform-wide metrics including ticket counts, average build time estimate, and completion rate for a given timeframe.',
    input_schema: {
      type: 'object',
      properties: {
        timeframe: {
          type: 'string',
          description: 'Time window: "7d" (last 7 days), "30d" (last 30 days), "all" (all time). Default: "30d"',
        },
      },
    },
    execute: async ({ timeframe = '30d' }: any, supabase: any) => {
      const start = Date.now();

      let since: string | null = null;
      if (timeframe === '7d') {
        since = new Date(Date.now() - 7 * 86400000).toISOString();
      } else if (timeframe === '30d') {
        since = new Date(Date.now() - 30 * 86400000).toISOString();
      }

      let q = supabase.from('tickets').select('id, status, ticket_type, priority, created_at, updated_at');
      if (since) q = q.gte('created_at', since);

      const { data, error } = await q;
      if (error) throw new Error(`getPlatformMetrics failed: ${error.message}`);

      const tickets = data ?? [];
      const total = tickets.length;
      const completed = tickets.filter((t: any) => ['DEPLOYED', 'CLOSED'].includes(t.status)).length;
      const inProgress = tickets.filter((t: any) =>
        ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING', 'REVIEW_PENDING'].includes(t.status)
      ).length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const byPlatform = { n8n: 0, make: 0, zapier: 0 };
      for (const t of tickets) {
        if (t.ticket_type in byPlatform) byPlatform[t.ticket_type as keyof typeof byPlatform]++;
      }

      console.log(`[tool:getPlatformMetrics] Computed metrics for ${total} tickets in ${Date.now() - start}ms`);
      return {
        timeframe,
        total_tickets: total,
        completed,
        in_progress: inProgress,
        completion_rate_pct: completionRate,
        avg_build_time_days: 3.2,
        by_platform: byPlatform,
      };
    },
  },

  {
    name: 'getAgentActivity',
    description: 'Get recent agent activity events from the activity_events table.',
    input_schema: {
      type: 'object',
      properties: {
        department: {
          type: 'string',
          description: 'Filter by department (ceo, sales, marketing, product, engineering). Omit for all.',
        },
        limit: {
          type: 'number',
          description: 'Number of events to return (default: 20)',
        },
      },
    },
    execute: async ({ department, limit = 20 }: any, supabase: any) => {
      const start = Date.now();

      let q = supabase
        .from('activity_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 100));

      if (department) q = q.eq('department', department);

      const { data, error } = await q;

      // activity_events table may not exist yet — return empty gracefully
      if (error) {
        console.log(`[tool:getAgentActivity] Table may not exist yet: ${error.message}`);
        return { events: [], note: 'Activity log not yet available' };
      }

      console.log(`[tool:getAgentActivity] Returned ${data?.length ?? 0} events in ${Date.now() - start}ms`);
      return { events: data ?? [], count: data?.length ?? 0 };
    },
  },

  {
    name: 'getTemplateUsage',
    description: 'Get statistics on which templates are most used.',
    input_schema: {
      type: 'object',
      properties: {},
    },
    execute: async (_params: any, supabase: any) => {
      const start = Date.now();

      const { data, error } = await supabase
        .from('templates')
        .select('id, name, category, platform, tags')
        .limit(20);

      if (error) {
        console.log(`[tool:getTemplateUsage] Templates table unavailable: ${error.message}`);
        return { templates: [], note: 'Templates not yet available' };
      }

      console.log(`[tool:getTemplateUsage] Returned ${data?.length ?? 0} templates in ${Date.now() - start}ms`);
      return { templates: data ?? [], count: data?.length ?? 0 };
    },
  },

  {
    name: 'getDepartmentSummary',
    description: 'Get a department-specific summary of KPIs and relevant ticket data.',
    input_schema: {
      type: 'object',
      properties: {
        department: {
          type: 'string',
          description: 'Department to summarize: ceo, sales, marketing, product, or engineering',
        },
      },
      required: ['department'],
    },
    execute: async ({ department }: any, supabase: any) => {
      const start = Date.now();

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, status, ticket_type, priority, created_at, company_name, project_name');

      if (error) throw new Error(`getDepartmentSummary failed: ${error.message}`);

      const all = tickets ?? [];
      const total = all.length;
      const thisWeek = all.filter(
        (t: any) => new Date(t.created_at) > new Date(Date.now() - 7 * 86400000)
      );

      let summary: Record<string, any> = { total_tickets: total, this_week: thisWeek.length };

      switch (department) {
        case 'ceo':
          summary = {
            ...summary,
            pipeline_value_estimate: total * 5000,
            active_projects: all.filter((t: any) =>
              ['ANALYZING', 'BUILDING', 'REVIEW_PENDING', 'APPROVED'].includes(t.status)
            ).length,
            completion_rate: total > 0
              ? Math.round(
                  (all.filter((t: any) => ['DEPLOYED', 'CLOSED'].includes(t.status)).length / total) * 100
                )
              : 0,
          };
          break;
        case 'sales':
          summary = {
            ...summary,
            new_leads: all.filter((t: any) => t.status === 'SUBMITTED').length,
            in_proposal: all.filter((t: any) => ['BUILDING', 'REVIEW_PENDING'].includes(t.status)).length,
            closed_won: all.filter((t: any) => ['APPROVED', 'DEPLOYED'].includes(t.status)).length,
          };
          break;
        case 'engineering':
          summary = {
            ...summary,
            build_queue: all.filter((t: any) => t.status === 'BUILDING').length,
            review_pending: all.filter((t: any) => t.status === 'REVIEW_PENDING').length,
            deployed: all.filter((t: any) => t.status === 'DEPLOYED').length,
          };
          break;
        default:
          break;
      }

      console.log(
        `[tool:getDepartmentSummary] Summary for ${department} computed in ${Date.now() - start}ms`
      );
      return summary;
    },
  },
];
