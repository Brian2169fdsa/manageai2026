import { NextRequest, NextResponse } from 'next/server';
import { getPerson, getDealActivities, getDeals, isConfigured } from '@/lib/integrations/pipedrive';

const SAMPLE_PERSON = {
  person: {
    id: 101,
    name: 'Sarah Johnson',
    email: [{ value: 'sarah@acmecorp.com', primary: true }],
    phone: [{ value: '+1 555-123-4567', primary: true }],
    job_title: 'HR Director',
    org_name: 'Acme Corp',
    org_id: { value: 201, name: 'Acme Corp' },
    add_time: '2026-01-15T10:00:00Z',
    update_time: '2026-02-20T14:30:00Z',
  },
  activities: [
    {
      id: 1,
      type: 'call',
      subject: 'Discovery call',
      due_date: '2026-02-10',
      done: true,
      note: 'Good conversation.',
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

/** GET /api/pipedrive/persons/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = parseInt(id, 10);

  if (isNaN(personId)) {
    return NextResponse.json({ error: 'Invalid person ID' }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ ...SAMPLE_PERSON, demo_mode: true });
  }

  const [personResult, activitiesResult, dealsResult] = await Promise.all([
    getPerson(personId),
    getDealActivities(personId), // reuse—activities endpoint supports person_id too via deals
    getDeals({ limit: 50 }),
  ]);

  if (!personResult.success) {
    return NextResponse.json({ error: personResult.error }, { status: 502 });
  }

  return NextResponse.json({
    person: personResult.data,
    activities: activitiesResult.success && Array.isArray(activitiesResult.data) ? activitiesResult.data : [],
    deals: dealsResult.success && Array.isArray(dealsResult.data)
      ? (dealsResult.data as Array<Record<string, unknown>>).filter(
          (d) => (d.person_id as { value?: number })?.value === personId
        )
      : [],
    demo_mode: false,
  });
}
