import { NextResponse } from 'next/server';
import { getPipelines, getStages, getDealsSummary, isConfigured } from '@/lib/integrations/pipedrive';

const SAMPLE_PIPELINE = {
  pipeline: { id: 1, name: 'Sales Pipeline' },
  stages: [
    { id: 1, name: 'Lead', order_nr: 1, pipeline_id: 1 },
    { id: 2, name: 'Qualified', order_nr: 2, pipeline_id: 1 },
    { id: 3, name: 'Proposal Sent', order_nr: 3, pipeline_id: 1 },
    { id: 4, name: 'Negotiation', order_nr: 4, pipeline_id: 1 },
    { id: 5, name: 'Closed Won', order_nr: 5, pipeline_id: 1 },
  ],
  summary: {
    per_stages: {
      '1': { count: 3, value: { value: 14000, currency: 'USD' } },
      '2': { count: 2, value: { value: 12000, currency: 'USD' } },
      '3': { count: 1, value: { value: 15000, currency: 'USD' } },
      '4': { count: 1, value: { value: 8000, currency: 'USD' } },
      '5': { count: 4, value: { value: 42000, currency: 'USD' } },
    },
    total_count: 11,
    total_value: { value: 91000, currency: 'USD' },
  },
};

/** GET /api/pipedrive/pipeline */
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ ...SAMPLE_PIPELINE, demo_mode: true });
  }

  const [pipelinesResult, stagesResult, summaryResult] = await Promise.all([
    getPipelines(),
    getStages(),
    getDealsSummary(),
  ]);

  if (!pipelinesResult.success) {
    return NextResponse.json(
      { error: pipelinesResult.error, ...SAMPLE_PIPELINE, demo_mode: false },
      { status: 502 }
    );
  }

  const pipelines = Array.isArray(pipelinesResult.data) ? pipelinesResult.data : [];
  const pipeline = pipelines[0] ?? { id: 1, name: 'Sales Pipeline' };

  const stages = stagesResult.success && Array.isArray(stagesResult.data)
    ? stagesResult.data
        .filter((s: Record<string, unknown>) => s.pipeline_id === pipeline.id)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          Number(a.order_nr ?? 0) - Number(b.order_nr ?? 0)
        )
    : SAMPLE_PIPELINE.stages;

  return NextResponse.json({
    pipeline,
    stages,
    summary: summaryResult.success ? summaryResult.data : SAMPLE_PIPELINE.summary,
    demo_mode: false,
  });
}
