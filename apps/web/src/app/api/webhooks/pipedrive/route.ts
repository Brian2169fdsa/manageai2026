/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { publishEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET;
  if (!secret) return true; // No secret = accept all (dev mode)
  const auth = request.headers.get('x-pipedrive-secret') ?? request.headers.get('authorization');
  return auth === secret || auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, current, previous } = body;

  console.log(`[webhook:pipedrive] event=${event}, id=${current?.id}`);

  // Deal moved to Won
  if (event === 'updated.deal' && current?.status === 'won' && previous?.status !== 'won') {
    await publishEvent({
      type: 'deal.closed',
      payload: {
        dealId: current.id,
        dealTitle: current.title,
        value: current.value,
        orgName: current.org_name ?? '',
        contactEmail: current.person_id?.email?.[0]?.value ?? '',
      },
      fromAgent: 'pipedrive-webhook',
      toAgents: ['Engineering AI', 'Delivery AI', 'Sales AI'],
      priority: 'high',
    });
  }

  // Deal stage changed
  if (event === 'updated.deal' && current?.stage_id !== previous?.stage_id) {
    await publishEvent({
      type: 'deal.closed', // reuse for stage changes — handler checks payload
      payload: {
        dealId: current.id,
        dealTitle: current.title,
        previousStage: previous?.stage_id,
        newStage: current.stage_id,
        orgName: current.org_name ?? '',
        stageChange: true,
      },
      fromAgent: 'pipedrive-webhook',
      toAgents: ['Sales AI'],
      priority: 'normal',
    });
  }

  // New person added
  if (event === 'added.person') {
    await publishEvent({
      type: 'lead.qualified',
      payload: {
        personId: current.id,
        contactName: current.name,
        companyName: current.org_name ?? '',
        email: Array.isArray(current.email) ? current.email[0]?.value : '',
        source: 'pipedrive',
      },
      fromAgent: 'pipedrive-webhook',
      toAgents: ['Sales AI'],
      priority: 'normal',
    });
  }

  return NextResponse.json({ received: true });
}
