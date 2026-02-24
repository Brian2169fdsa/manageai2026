import { NextRequest, NextResponse } from 'next/server';
import { getDeals, isConfigured } from '@/lib/integrations/pipedrive';

// Sample data for demo mode
const SAMPLE_DEALS = [
  {
    id: 1001,
    title: 'Acme Corp — HR Automation',
    status: 'open',
    value: 8000,
    currency: 'USD',
    stage_id: 1,
    stage_name: 'Qualified',
    expected_close_date: '2026-03-15',
    person_name: 'Sarah Johnson',
    org_name: 'Acme Corp',
    owner_name: 'Brian R.',
    pipeline_id: 1,
  },
  {
    id: 1002,
    title: 'TechStart — Lead Sync',
    status: 'open',
    value: 4000,
    currency: 'USD',
    stage_id: 2,
    stage_name: 'Proposal Sent',
    expected_close_date: '2026-03-08',
    person_name: 'Mike Chen',
    org_name: 'TechStart',
    owner_name: 'Brian R.',
    pipeline_id: 1,
  },
  {
    id: 1003,
    title: 'RetailCo — Order Automation',
    status: 'open',
    value: 15000,
    currency: 'USD',
    stage_id: 3,
    stage_name: 'Negotiation',
    expected_close_date: '2026-02-28',
    person_name: 'Jessica Lee',
    org_name: 'RetailCo',
    owner_name: 'Brian R.',
    pipeline_id: 1,
  },
  {
    id: 1004,
    title: 'HealthPlus — Patient Intake',
    status: 'won',
    value: 12000,
    currency: 'USD',
    stage_id: 4,
    stage_name: 'Closed Won',
    expected_close_date: '2026-02-10',
    person_name: 'Dr. Robert Kim',
    org_name: 'HealthPlus',
    owner_name: 'Brian R.',
    pipeline_id: 1,
  },
  {
    id: 1005,
    title: 'FinanceHub — Report Builder',
    status: 'open',
    value: 6000,
    currency: 'USD',
    stage_id: 1,
    stage_name: 'Qualified',
    expected_close_date: '2026-04-01',
    person_name: 'Alex Torres',
    org_name: 'FinanceHub',
    owner_name: 'Brian R.',
    pipeline_id: 1,
  },
  {
    id: 1006,
    title: 'EduTech — Enrollment Flow',
    status: 'lost',
    value: 5000,
    currency: 'USD',
    stage_id: 0,
    stage_name: 'Closed Lost',
    expected_close_date: '2026-01-20',
    person_name: 'Maria Santos',
    org_name: 'EduTech',
    owner_name: 'Brian R.',
    pipeline_id: 1,
  },
];

/** GET /api/pipedrive/deals */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as 'open' | 'won' | 'lost' | null;

  if (!isConfigured()) {
    const filtered = status ? SAMPLE_DEALS.filter((d) => d.status === status) : SAMPLE_DEALS;
    return NextResponse.json({ deals: filtered, demo_mode: true });
  }

  // Fetch up to 500 deals (Pipedrive max per request) to avoid missing deals
  const result = await getDeals({ status: status ?? 'open', limit: 500 });

  if (!result.success) {
    return NextResponse.json({ error: result.error, deals: [], demo_mode: false }, { status: 502 });
  }

  // Normalise the Pipedrive deal shape
  // - person_name and org_name are plain strings in the v1 API
  // - owner lives in user_id.name (not a top-level owner_name field)
  const deals = (Array.isArray(result.data) ? result.data : []).map((d: Record<string, unknown>) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    value: d.value,
    currency: d.currency,
    stage_id: d.stage_id,
    stage_name: '',
    expected_close_date: d.expected_close_date,
    person_name: (d.person_name as string) ?? '',
    org_name: (d.org_name as string) ?? '',
    owner_name: (d.user_id as { name?: string })?.name ?? '',
    pipeline_id: d.pipeline_id,
  }));

  return NextResponse.json({ deals, demo_mode: false });
}
