/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentTool } from '../types';
import {
  getDeals,
  getDeal,
  updateDeal,
  addDealNote,
  getPipelines,
  getStages,
  getDealsSummary,
  isConfigured,
} from '@/lib/integrations/pipedrive';

const NOT_CONFIGURED = {
  success: false,
  error: 'Pipedrive not configured. Add PIPEDRIVE_API_TOKEN and PIPEDRIVE_DOMAIN to environment variables.',
  demo_mode: true,
};

function formatDeal(d: Record<string, any>): string {
  const value = d.value ? `$${Number(d.value).toLocaleString()}` : 'No value';
  const close = d.expected_close_date ? `closes ${d.expected_close_date}` : '';
  const contact = d.person_name?.name ?? d.person_name ?? '';
  const company = d.org_name?.name ?? d.org_name ?? '';
  const owner = d.owner_name ?? '';
  return `#${d.id} "${d.title}" — ${value} | Stage: ${d.stage_id_name ?? d.stage_id} | ${company}${contact ? ` (${contact})` : ''} | ${close}${owner ? ` | Owner: ${owner}` : ''}`;
}

export const pipedriveTools: AgentTool[] = [
  {
    name: 'listDeals',
    description:
      'List deals from Pipedrive CRM. Can filter by status (open/won/lost). Returns deal title, value, stage, contact, expected close date.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'won', 'lost', 'all_not_deleted'],
          description: 'Filter by deal status. Defaults to open.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of deals to return (default 20, max 50)',
        },
      },
      required: [],
    },
    execute: async ({ status = 'open', limit = 20 }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:listDeals] status=${status}, limit=${limit}`);

      if (!isConfigured()) return { ...NOT_CONFIGURED, duration_ms: Date.now() - start };

      const result = await getDeals({ status, limit: Math.min(limit, 50) });

      if (!result.success) {
        return { success: false, error: result.error, duration_ms: Date.now() - start };
      }

      const deals: any[] = Array.isArray(result.data) ? result.data : [];
      const summary = {
        count: deals.length,
        total_value: deals.reduce((sum: number, d: any) => sum + Number(d.value ?? 0), 0),
        deals: deals.map(formatDeal),
        duration_ms: Date.now() - start,
      };

      console.log(`[tool:listDeals] Returned ${deals.length} deals in ${summary.duration_ms}ms`);
      return summary;
    },
  },

  {
    name: 'getDealDetails',
    description: 'Get full details of a specific Pipedrive deal by ID.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'number',
          description: 'Pipedrive deal ID (numeric)',
        },
      },
      required: ['deal_id'],
    },
    execute: async ({ deal_id }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:getDealDetails] deal_id=${deal_id}`);

      if (!isConfigured()) return { ...NOT_CONFIGURED, duration_ms: Date.now() - start };

      const result = await getDeal(Number(deal_id));

      if (!result.success) {
        return { success: false, error: result.error, duration_ms: Date.now() - start };
      }

      const d: any = result.data;
      const formatted = {
        id: d.id,
        title: d.title,
        status: d.status,
        value: d.value ? `$${Number(d.value).toLocaleString()} ${d.currency ?? ''}`.trim() : 'No value set',
        stage: d.stage_id_name ?? d.stage_id,
        pipeline: d.pipeline_id,
        expected_close_date: d.expected_close_date ?? 'Not set',
        contact: d.person_name?.name ?? d.person_name ?? 'No contact',
        company: d.org_name?.name ?? d.org_name ?? 'No company',
        owner: d.owner_name ?? 'Unassigned',
        probability: d.probability ? `${d.probability}%` : null,
        last_activity: d.last_activity_date ?? 'None',
        notes_count: d.notes_count ?? 0,
        created_at: d.add_time ?? null,
        duration_ms: Date.now() - start,
      };

      console.log(`[tool:getDealDetails] Fetched deal ${deal_id} in ${formatted.duration_ms}ms`);
      return formatted;
    },
  },

  {
    name: 'updateDealStage',
    description:
      'Move a deal to a different pipeline stage in Pipedrive. Use getPipelineOverview first to get stage IDs.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'number',
          description: 'Pipedrive deal ID to update',
        },
        stage_id: {
          type: 'number',
          description: 'Target stage ID (get from getPipelineOverview)',
        },
      },
      required: ['deal_id', 'stage_id'],
    },
    execute: async ({ deal_id, stage_id }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:updateDealStage] deal_id=${deal_id}, stage_id=${stage_id}`);

      if (!isConfigured()) return { ...NOT_CONFIGURED, duration_ms: Date.now() - start };

      const result = await updateDeal(Number(deal_id), { stage_id: Number(stage_id) });

      if (!result.success) {
        return { success: false, error: result.error, duration_ms: Date.now() - start };
      }

      const d: any = result.data;
      console.log(`[tool:updateDealStage] Updated deal ${deal_id} to stage ${stage_id} in ${Date.now() - start}ms`);
      return {
        success: true,
        deal_id,
        new_stage: d?.stage_id_name ?? stage_id,
        title: d?.title,
        duration_ms: Date.now() - start,
      };
    },
  },

  {
    name: 'addNoteToDeal',
    description:
      'Add a note to a Pipedrive deal. Use this to log build updates, client feedback, or delivery milestones.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'number',
          description: 'Pipedrive deal ID',
        },
        note: {
          type: 'string',
          description: 'Note content to add to the deal',
        },
      },
      required: ['deal_id', 'note'],
    },
    execute: async ({ deal_id, note }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:addNoteToDeal] deal_id=${deal_id}, note="${note.slice(0, 60)}"`);

      if (!isConfigured()) return { ...NOT_CONFIGURED, duration_ms: Date.now() - start };

      const result = await addDealNote(Number(deal_id), note);

      if (!result.success) {
        return { success: false, error: result.error, duration_ms: Date.now() - start };
      }

      console.log(`[tool:addNoteToDeal] Note added to deal ${deal_id} in ${Date.now() - start}ms`);
      return {
        success: true,
        deal_id,
        note_id: (result.data as any)?.id,
        message: `Note added to deal #${deal_id}`,
        duration_ms: Date.now() - start,
      };
    },
  },

  {
    name: 'getPipelineOverview',
    description:
      'Get pipeline stages and deal counts. Shows the full sales pipeline structure with how many deals are in each stage and their total value.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async (_params: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:getPipelineOverview] Fetching pipeline structure`);

      if (!isConfigured()) return { ...NOT_CONFIGURED, duration_ms: Date.now() - start };

      const [pipelinesResult, stagesResult, summaryResult] = await Promise.all([
        getPipelines(),
        getStages(),
        getDealsSummary(),
      ]);

      if (!pipelinesResult.success) {
        return { success: false, error: pipelinesResult.error, duration_ms: Date.now() - start };
      }

      const pipelines: any[] = Array.isArray(pipelinesResult.data) ? pipelinesResult.data : [];
      const stages: any[] = stagesResult.success && Array.isArray(stagesResult.data)
        ? stagesResult.data
        : [];

      const summary: any = summaryResult.success ? summaryResult.data : null;
      const perStages: Record<string, any> = summary?.per_stages ?? {};

      const stageBreakdown = stages.map((s: any) => {
        const stageData = perStages[String(s.id)];
        return {
          stage_id: s.id,
          name: s.name,
          order: s.order_nr,
          deal_count: stageData?.count ?? 0,
          total_value: stageData?.value?.value
            ? `$${Number(stageData.value.value).toLocaleString()} ${stageData.value.currency ?? ''}`
            : '$0',
        };
      });

      const totalValue = summary?.total_value?.value
        ? `$${Number(summary.total_value.value).toLocaleString()} ${summary.total_value.currency ?? ''}`
        : 'Unknown';

      console.log(`[tool:getPipelineOverview] Done in ${Date.now() - start}ms`);
      return {
        success: true,
        pipelines: pipelines.map((p: any) => ({ id: p.id, name: p.name })),
        stages: stageBreakdown,
        total_open_deals: summary?.total_count ?? 0,
        total_pipeline_value: totalValue,
        duration_ms: Date.now() - start,
      };
    },
  },
];
