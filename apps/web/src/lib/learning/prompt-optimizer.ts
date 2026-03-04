/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRecentFeedback, type BuildFeedback } from './feedback-collector';

export interface OptimizationInsight {
  platform: string;
  totalBuilds: number;
  revisionRate: number;
  approvalRate: number;
  commonIssues: Array<{ category: string; count: number; examples: string[] }>;
  recommendations: string[];
}

/**
 * Analyzes recent build feedback to identify patterns and suggest prompt improvements.
 * This is the core of the self-improving build engine — it learns from revision
 * patterns and generates actionable recommendations.
 */
export async function analyzeBuildFeedback(
  platform: string,
  daysBack: number = 30
): Promise<OptimizationInsight> {
  const feedback = await getRecentFeedback(platform, daysBack);

  if (feedback.length === 0) {
    return {
      platform,
      totalBuilds: 0,
      revisionRate: 0,
      approvalRate: 0,
      commonIssues: [],
      recommendations: ['Not enough data yet. Continue building to generate insights.'],
    };
  }

  const revisions = feedback.filter((f) => f.feedback_type === 'revision');
  const approvals = feedback.filter((f) => f.feedback_type === 'approval');
  const failures = feedback.filter((f) => f.feedback_type === 'deploy_failure');
  const complaints = feedback.filter((f) => f.feedback_type === 'client_complaint');

  const totalBuilds = feedback.length;
  const revisionRate = totalBuilds > 0 ? Math.round((revisions.length / totalBuilds) * 100) : 0;
  const approvalRate = totalBuilds > 0 ? Math.round((approvals.length / totalBuilds) * 100) : 0;

  // Group issues by category
  const categoryMap = new Map<string, BuildFeedback[]>();
  for (const f of [...revisions, ...failures, ...complaints]) {
    const cat = f.category ?? 'uncategorized';
    const existing = categoryMap.get(cat) ?? [];
    existing.push(f);
    categoryMap.set(cat, existing);
  }

  const commonIssues = Array.from(categoryMap.entries())
    .map(([category, items]) => ({
      category,
      count: items.length,
      examples: items.slice(0, 3).map((i) => i.details),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Generate recommendations
  const recommendations = generateRecommendations({
    revisionRate,
    approvalRate,
    commonIssues,
    failures: failures.length,
    complaints: complaints.length,
    platform,
  });

  return {
    platform,
    totalBuilds,
    revisionRate,
    approvalRate,
    commonIssues,
    recommendations,
  };
}

function generateRecommendations(ctx: {
  revisionRate: number;
  approvalRate: number;
  commonIssues: Array<{ category: string; count: number }>;
  failures: number;
  complaints: number;
  platform: string;
}): string[] {
  const recs: string[] = [];

  if (ctx.revisionRate > 50) {
    recs.push(
      `High revision rate (${ctx.revisionRate}%) — consider adding more detailed examples to the ${ctx.platform} prompt builder for common use cases.`
    );
  }

  if (ctx.failures > 0) {
    recs.push(
      `${ctx.failures} deploy failure(s) detected — review the ${ctx.platform} deployer error handling and add pre-deploy validation.`
    );
  }

  if (ctx.complaints > 0) {
    recs.push(
      `${ctx.complaints} client complaint(s) — review post-deploy monitoring and add automated health checks.`
    );
  }

  for (const issue of ctx.commonIssues.slice(0, 3)) {
    if (issue.count >= 3) {
      recs.push(
        `Recurring issue in "${issue.category}" (${issue.count} occurrences) — add specific guidance for this pattern in the prompt template.`
      );
    }
  }

  if (ctx.approvalRate > 80) {
    recs.push(
      `Strong approval rate (${ctx.approvalRate}%) — current prompt patterns are working well for ${ctx.platform}.`
    );
  }

  if (recs.length === 0) {
    recs.push('Build quality is within normal parameters. Continue monitoring.');
  }

  return recs;
}

/**
 * Analyzes all platforms and returns a combined report.
 */
export async function analyzeAllPlatforms(
  daysBack: number = 30
): Promise<OptimizationInsight[]> {
  const platforms = ['n8n', 'make', 'zapier'];
  const results = await Promise.all(
    platforms.map((p) => analyzeBuildFeedback(p, daysBack))
  );
  return results;
}
