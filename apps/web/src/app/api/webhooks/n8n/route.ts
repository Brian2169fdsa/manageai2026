/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Receives execution reports from deployed n8n instances.
 * Updates client_automations table and publishes events on errors.
 *
 * Expected body:
 * {
 *   workflowId: string,
 *   executionId: string,
 *   status: 'success' | 'error',
 *   errorMessage?: string,
 *   startedAt?: string,
 *   finishedAt?: string
 * }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { workflowId, executionId, status, errorMessage } = body;

  console.log(`[webhook:n8n] workflow=${workflowId}, execution=${executionId}, status=${status}`);

  // Update client_automations table (best-effort — table may not exist yet)
  try {
    const supabase = getSupabase();

    if (status === 'success') {
      await supabase
        .from('client_automations')
        .update({
          last_run: new Date().toISOString(),
          health: 'healthy',
          last_checked: new Date().toISOString(),
        })
        .eq('external_id', workflowId);
    } else if (status === 'error') {
      await supabase
        .from('client_automations')
        .update({
          last_run: new Date().toISOString(),
          health: 'failing',
          last_checked: new Date().toISOString(),
        })
        .eq('external_id', workflowId);
    }
  } catch {
    // Table may not exist yet — continue to event publishing
  }

  // Publish error event
  if (status === 'error') {
    await publishEvent({
      type: 'automation.error',
      payload: {
        workflowId,
        executionId,
        errorMessage: errorMessage ?? 'Unknown error',
        platform: 'n8n',
      },
      fromAgent: 'n8n-webhook',
      toAgents: ['Delivery AI', 'Engineering AI'],
      priority: 'urgent',
    });
  }

  return NextResponse.json({ received: true, status });
}
