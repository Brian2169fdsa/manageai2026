import { NextRequest, NextResponse } from 'next/server';
import {
  getDeal,
  getPersonsByDeal,
  getDealActivities,
  getDealNotes,
  getDealFiles,
  getDealFlow,
  getDealProducts,
  getOrganization,
  isConfigured,
} from '@/lib/integrations/pipedrive';

const SAMPLE_DEAL_DETAIL = {
  deal: {
    id: 1001,
    title: 'Acme Corp — HR Automation',
    status: 'open',
    value: 8000,
    currency: 'USD',
    stage_id: 2,
    stage_name: 'Qualified',
    expected_close_date: '2026-03-15',
    person_name: 'Sarah Johnson',
    person_id: { value: 101 },
    org_name: 'Acme Corp',
    org_id: { value: 201 },
    owner_name: 'Brian R.',
    pipeline_id: 1,
    add_time: '2026-01-15T10:00:00Z',
    update_time: '2026-02-20T14:30:00Z',
    lost_reason: null,
    close_time: null,
  },
  persons: [
    {
      id: 101,
      name: 'Sarah Johnson',
      email: [{ value: 'sarah@acmecorp.com', primary: true }],
      phone: [{ value: '+1 555-123-4567', primary: true }],
      job_title: 'HR Director',
      org_name: 'Acme Corp',
    },
  ],
  activities: [
    {
      id: 1,
      type: 'call',
      subject: 'Discovery call',
      due_date: '2026-02-10',
      done: true,
      note: 'Good conversation, they are ready to move forward.',
      user_id: 1,
    },
    {
      id: 2,
      type: 'email',
      subject: 'Proposal follow-up',
      due_date: '2026-02-18',
      done: false,
      note: '',
      user_id: 1,
    },
  ],
  notes: [
    {
      id: 1,
      content: 'Client is very interested in automating their onboarding process. Budget approved.',
      add_time: '2026-02-10T15:00:00Z',
      user: { name: 'Brian R.' },
    },
  ],
  files: [],
  flow: [],
  products: [],
  org: {
    id: 201,
    name: 'Acme Corp',
    address: '123 Main St, San Francisco, CA',
    industry: 'Technology',
    employee_count: 150,
    web_site_url: 'https://acmecorp.com',
  },
  demo_mode: true,
};

/** GET /api/pipedrive/deals/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dealId = parseInt(id, 10);

  if (isNaN(dealId)) {
    return NextResponse.json({ error: 'Invalid deal ID' }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ ...SAMPLE_DEAL_DETAIL, demo_mode: true });
  }

  // Parallel fetch all deal-related data
  const [dealResult, personsResult, activitiesResult, notesResult, filesResult, flowResult, productsResult] =
    await Promise.all([
      getDeal(dealId),
      getPersonsByDeal(dealId),
      getDealActivities(dealId),
      getDealNotes(dealId),
      getDealFiles(dealId),
      getDealFlow(dealId),
      getDealProducts(dealId),
    ]);

  if (!dealResult.success) {
    return NextResponse.json({ error: dealResult.error }, { status: 502 });
  }

  const deal = dealResult.data as Record<string, unknown>;

  // Fetch organization details if deal has one
  let org = null;
  const orgId = (deal.org_id as { value?: number } | null)?.value;
  if (orgId) {
    const orgResult = await getOrganization(orgId);
    if (orgResult.success) org = orgResult.data;
  }

  return NextResponse.json({
    deal,
    persons: personsResult.success && Array.isArray(personsResult.data) ? personsResult.data : [],
    activities: activitiesResult.success && Array.isArray(activitiesResult.data) ? activitiesResult.data : [],
    notes: notesResult.success && Array.isArray(notesResult.data) ? notesResult.data : [],
    files: filesResult.success && Array.isArray(filesResult.data) ? filesResult.data : [],
    flow: flowResult.success && Array.isArray(flowResult.data) ? flowResult.data : [],
    products: productsResult.success && Array.isArray(productsResult.data) ? productsResult.data : [],
    org,
    demo_mode: false,
  });
}
