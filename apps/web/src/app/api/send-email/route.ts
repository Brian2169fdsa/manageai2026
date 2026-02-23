import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/notifications';

/** POST /api/send-email — send a transactional email */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, html, ticket_id } = body as {
      to: string;
      subject: string;
      html: string;
      ticket_id?: string;
    };

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'to, subject, and html are required' }, { status: 400 });
    }

    const result = await sendEmail({ to, subject, html, ticket_id });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
