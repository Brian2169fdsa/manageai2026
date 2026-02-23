/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentTool } from '../types';

export const platformTicketsTools: AgentTool[] = [
  {
    name: 'searchTickets',
    description: 'Search tickets by query text, status filter, or platform type. Returns matching tickets with key fields.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to search in project name, company name, or what_to_build field',
        },
        status: {
          type: 'string',
          description:
            'Filter by ticket status: SUBMITTED, CONTEXT_PENDING, ANALYZING, QUESTIONS_PENDING, BUILDING, REVIEW_PENDING, APPROVED, DEPLOYED, CLOSED',
        },
        platform: {
          type: 'string',
          description: 'Filter by automation platform: n8n, make, or zapier',
        },
      },
    },
    execute: async ({ query, status, platform }: any, supabase: any) => {
      const start = Date.now();
      let q = supabase
        .from('tickets')
        .select(
          'id, company_name, contact_name, contact_email, project_name, status, ticket_type, priority, what_to_build, created_at, updated_at'
        );

      if (status) q = q.eq('status', status);
      if (platform) q = q.eq('ticket_type', platform);
      if (query) {
        q = q.or(
          `company_name.ilike.%${query}%,project_name.ilike.%${query}%,what_to_build.ilike.%${query}%`
        );
      }

      q = q.order('created_at', { ascending: false }).limit(20);

      const { data, error } = await q;
      if (error) throw new Error(`searchTickets failed: ${error.message}`);

      console.log(
        `[tool:searchTickets] Returned ${data?.length ?? 0} results in ${Date.now() - start}ms`
      );
      return { tickets: data ?? [], count: data?.length ?? 0 };
    },
  },

  {
    name: 'getTicket',
    description:
      'Get full details for a specific ticket including its assets (uploaded files) and artifacts (AI-generated outputs).',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'The UUID of the ticket to retrieve',
        },
      },
      required: ['ticket_id'],
    },
    execute: async ({ ticket_id }: any, supabase: any) => {
      const start = Date.now();

      const [{ data: ticket, error: tErr }, { data: assets }, { data: artifacts }] =
        await Promise.all([
          supabase.from('tickets').select('*').eq('id', ticket_id).single(),
          supabase.from('ticket_assets').select('*').eq('ticket_id', ticket_id),
          supabase.from('ticket_artifacts').select('*').eq('ticket_id', ticket_id),
        ]);

      if (tErr) throw new Error(`getTicket failed: ${tErr.message}`);

      console.log(`[tool:getTicket] Fetched ticket ${ticket_id} in ${Date.now() - start}ms`);
      return { ticket, assets: assets ?? [], artifacts: artifacts ?? [] };
    },
  },

  {
    name: 'updateTicketNote',
    description: 'Add or update a note/description on a ticket.',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'The UUID of the ticket to update',
        },
        note: {
          type: 'string',
          description: 'The note content to save on the ticket description field',
        },
      },
      required: ['ticket_id', 'note'],
    },
    execute: async ({ ticket_id, note }: any, supabase: any) => {
      const start = Date.now();
      const { error } = await supabase
        .from('tickets')
        .update({ description: note, updated_at: new Date().toISOString() })
        .eq('id', ticket_id);

      if (error) throw new Error(`updateTicketNote failed: ${error.message}`);
      console.log(`[tool:updateTicketNote] Updated ticket ${ticket_id} in ${Date.now() - start}ms`);
      return { success: true, ticket_id };
    },
  },

  {
    name: 'getTicketStats',
    description: 'Get aggregate counts of tickets grouped by status, platform, and priority.',
    input_schema: {
      type: 'object',
      properties: {},
    },
    execute: async (_params: any, supabase: any) => {
      const start = Date.now();
      const { data, error } = await supabase
        .from('tickets')
        .select('status, ticket_type, priority, created_at');

      if (error) throw new Error(`getTicketStats failed: ${error.message}`);

      const tickets = data ?? [];

      const byStatus: Record<string, number> = {};
      const byPlatform: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      for (const t of tickets) {
        byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
        byPlatform[t.ticket_type] = (byPlatform[t.ticket_type] ?? 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      }

      console.log(`[tool:getTicketStats] Stats for ${tickets.length} tickets in ${Date.now() - start}ms`);
      return {
        total: tickets.length,
        byStatus,
        byPlatform,
        byPriority,
      };
    },
  },

  {
    name: 'listRecentTickets',
    description: 'List the most recent tickets, optionally limited to a certain count.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent tickets to return (default: 10, max: 50)',
        },
      },
    },
    execute: async ({ limit = 10 }: any, supabase: any) => {
      const start = Date.now();
      const { data, error } = await supabase
        .from('tickets')
        .select(
          'id, company_name, project_name, status, ticket_type, priority, created_at, contact_name'
        )
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 50));

      if (error) throw new Error(`listRecentTickets failed: ${error.message}`);
      console.log(
        `[tool:listRecentTickets] Returned ${data?.length ?? 0} tickets in ${Date.now() - start}ms`
      );
      return { tickets: data ?? [], count: data?.length ?? 0 };
    },
  },
];
