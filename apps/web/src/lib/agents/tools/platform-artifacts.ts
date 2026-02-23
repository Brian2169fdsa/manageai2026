/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentTool } from '../types';

export const platformArtifactsTools: AgentTool[] = [
  {
    name: 'getArtifacts',
    description:
      'List all AI-generated artifacts (build plan, solution demo, workflow JSON) for a ticket.',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'UUID of the ticket to get artifacts for',
        },
      },
      required: ['ticket_id'],
    },
    execute: async ({ ticket_id }: any, supabase: any) => {
      const start = Date.now();
      const { data, error } = await supabase
        .from('ticket_artifacts')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`getArtifacts failed: ${error.message}`);
      console.log(
        `[tool:getArtifacts] Returned ${data?.length ?? 0} artifacts in ${Date.now() - start}ms`
      );
      return { artifacts: data ?? [], count: data?.length ?? 0 };
    },
  },

  {
    name: 'triggerRebuild',
    description:
      'Trigger a rebuild (regenerate all AI artifacts) for a ticket. The ticket must be in a state that allows rebuilding.',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'UUID of the ticket to rebuild',
        },
      },
      required: ['ticket_id'],
    },
    execute: async ({ ticket_id }: any, supabase: any) => {
      const start = Date.now();

      // Set ticket to BUILDING status before calling generate-build
      const { error: updateErr } = await supabase
        .from('tickets')
        .update({ status: 'BUILDING', updated_at: new Date().toISOString() })
        .eq('id', ticket_id);

      if (updateErr) throw new Error(`triggerRebuild status update failed: ${updateErr.message}`);

      // Call the generate-build API internally
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/generate-build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id }),
      });

      const result = await response.json();
      console.log(`[tool:triggerRebuild] Rebuild triggered for ${ticket_id} in ${Date.now() - start}ms`);

      if (!response.ok) {
        throw new Error(`Rebuild failed: ${result.error ?? 'Unknown error'}`);
      }

      return {
        success: true,
        ticket_id,
        artifacts_created: result.artifacts?.length ?? 0,
        template_matched: result.template_matched,
      };
    },
  },

  {
    name: 'getWorkflowJson',
    description: 'Retrieve the workflow JSON content for a ticket (the importable automation file).',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'UUID of the ticket',
        },
      },
      required: ['ticket_id'],
    },
    execute: async ({ ticket_id }: any, supabase: any) => {
      const start = Date.now();

      // Get the most recent workflow JSON artifact
      const { data: artifacts, error } = await supabase
        .from('ticket_artifacts')
        .select('*')
        .eq('ticket_id', ticket_id)
        .eq('artifact_type', 'workflow_json')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw new Error(`getWorkflowJson failed: ${error.message}`);
      if (!artifacts || artifacts.length === 0) {
        return { workflow: null, message: 'No workflow JSON artifact found for this ticket' };
      }

      const artifact = artifacts[0];

      // Download from storage
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('ticket-files')
        .download(artifact.file_path);

      if (dlErr) throw new Error(`Storage download failed: ${dlErr.message}`);

      const text = await fileData.text();
      console.log(
        `[tool:getWorkflowJson] Retrieved workflow JSON (${text.length} chars) in ${Date.now() - start}ms`
      );

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      return {
        artifact_id: artifact.id,
        file_name: artifact.file_name,
        created_at: artifact.created_at,
        metadata: artifact.metadata,
        workflow: parsed,
        raw: parsed ? undefined : text.slice(0, 2000),
      };
    },
  },
];
