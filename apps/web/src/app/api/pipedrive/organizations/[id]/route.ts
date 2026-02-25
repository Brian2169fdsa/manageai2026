import { NextRequest, NextResponse } from 'next/server';
import { getOrganization, getOrgPersons, getDeals, isConfigured } from '@/lib/integrations/pipedrive';

const SAMPLE_ORG = {
  org: {
    id: 201,
    name: 'Acme Corp',
    address: '123 Main St, San Francisco, CA',
    industry: 'Technology',
    employee_count: 150,
    web_site_url: 'https://acmecorp.com',
    add_time: '2026-01-10T09:00:00Z',
    update_time: '2026-02-18T12:00:00Z',
  },
  persons: [
    {
      id: 101,
      name: 'Sarah Johnson',
      email: [{ value: 'sarah@acmecorp.com', primary: true }],
      phone: [{ value: '+1 555-123-4567', primary: true }],
      job_title: 'HR Director',
    },
  ],
  deals: [
    {
      id: 1001,
      title: 'Acme Corp — HR Automation',
      status: 'open',
      value: 8000,
      currency: 'USD',
    },
  ],
  demo_mode: true,
};

/** GET /api/pipedrive/organizations/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orgId = parseInt(id, 10);

  if (isNaN(orgId)) {
    return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ ...SAMPLE_ORG, demo_mode: true });
  }

  const [orgResult, personsResult, dealsResult] = await Promise.all([
    getOrganization(orgId),
    getOrgPersons(orgId),
    getDeals({ limit: 500 }),
  ]);

  if (!orgResult.success) {
    return NextResponse.json({ error: orgResult.error }, { status: 502 });
  }

  return NextResponse.json({
    org: orgResult.data,
    persons: personsResult.success && Array.isArray(personsResult.data) ? personsResult.data : [],
    deals: dealsResult.success && Array.isArray(dealsResult.data)
      ? (dealsResult.data as Array<Record<string, unknown>>).filter(
          (d) => (d.org_id as { value?: number })?.value === orgId
        )
      : [],
    demo_mode: false,
  });
}
