/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { publishEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

/**
 * Receives form submissions from the ManageAI website (or any external form).
 * Creates a lead.qualified event so Sales AI and Marketing AI can react.
 *
 * Expected body:
 * {
 *   company_name: string,
 *   contact_name: string,
 *   email: string,
 *   phone?: string,
 *   industry?: string,
 *   message?: string,
 *   source?: string
 * }
 */
export async function POST(request: NextRequest) {
  let lead: any;
  try {
    lead = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const companyName = lead.company_name ?? lead.company ?? '';
  const contactName = lead.contact_name ?? lead.name ?? '';
  const email = lead.email ?? '';

  if (!email && !companyName) {
    return NextResponse.json({ error: 'Missing company_name or email' }, { status: 400 });
  }

  console.log(`[webhook:form] New lead: ${companyName} / ${contactName} / ${email}`);

  await publishEvent({
    type: 'lead.qualified',
    payload: {
      companyName,
      contactName,
      email,
      phone: lead.phone ?? '',
      industry: lead.industry ?? '',
      message: lead.message ?? '',
      source: lead.source ?? 'website-form',
    },
    fromAgent: 'website-webhook',
    toAgents: ['Sales AI', 'Marketing AI'],
    priority: 'high',
  });

  return NextResponse.json({ received: true, lead: companyName || email });
}
