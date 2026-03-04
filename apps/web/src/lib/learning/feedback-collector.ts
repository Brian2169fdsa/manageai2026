/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface BuildFeedback {
  ticket_id: string;
  feedback_type: 'revision' | 'rejection' | 'approval' | 'deploy_failure' | 'client_complaint';
  platform: string;
  category: string | null;
  details: string;
  original_prompt_snippet?: string;
  revision_count?: number;
}

/**
 * Records feedback about a build outcome for later analysis.
 * Called when:
 *  - A build is sent back for revision (REVIEW_PENDING → BUILDING)
 *  - A build fails deployment
 *  - A client reports issues post-deploy
 *  - A build is approved first-try (positive signal)
 */
export async function recordBuildFeedback(feedback: BuildFeedback): Promise<void> {
  const supabase = getSupabase();

  try {
    const { error } = await supabase.from('build_feedback').insert({
      ticket_id: feedback.ticket_id,
      feedback_type: feedback.feedback_type,
      platform: feedback.platform,
      category: feedback.category,
      details: feedback.details,
      original_prompt_snippet: feedback.original_prompt_snippet ?? null,
      revision_count: feedback.revision_count ?? 0,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[feedback-collector] Failed to record feedback:', error.message);
    }
  } catch (err: any) {
    console.error('[feedback-collector] Error:', err.message);
  }
}

/**
 * Retrieves recent feedback entries for a given platform and time window.
 */
export async function getRecentFeedback(
  platform: string,
  daysBack: number = 30
): Promise<BuildFeedback[]> {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data, error } = await supabase
    .from('build_feedback')
    .select('*')
    .eq('platform', platform)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[feedback-collector] Failed to fetch feedback:', error.message);
    return [];
  }

  return (data ?? []) as BuildFeedback[];
}

/**
 * Gets a summary of feedback counts by type for a given platform.
 */
export async function getFeedbackSummary(
  platform: string,
  daysBack: number = 30
): Promise<Record<string, number>> {
  const feedback = await getRecentFeedback(platform, daysBack);
  const summary: Record<string, number> = {};

  for (const f of feedback) {
    summary[f.feedback_type] = (summary[f.feedback_type] ?? 0) + 1;
  }

  return summary;
}
