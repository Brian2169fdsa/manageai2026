import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgMembership } from '@/lib/org/middleware';
import { canManageSettings } from '@/lib/org/rbac';
import { testN8nConnection } from '@/lib/deploy/n8n-deployer';
import { testMakeConnection } from '@/lib/deploy/make-deployer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DeployConfigs {
  n8n?: { instanceUrl?: string; apiKey?: string };
  make?: { apiToken?: string; teamId?: number; folderId?: number };
  zapier?: { mode?: string };
}

/** GET /api/deploy/config — returns current deploy configs (redacts API keys) */
export async function GET(req: NextRequest) {
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));

    const { data: org, error } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', membership.orgId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const deploy = ((org?.settings as Record<string, unknown>)?.deploy ?? {}) as DeployConfigs;

    // Redact secrets — only return whether they're configured
    return NextResponse.json({
      n8n: {
        instanceUrl: deploy.n8n?.instanceUrl ?? '',
        configured: !!(deploy.n8n?.instanceUrl && deploy.n8n?.apiKey),
      },
      make: {
        teamId: deploy.make?.teamId ?? null,
        folderId: deploy.make?.folderId ?? null,
        configured: !!(deploy.make?.apiToken && deploy.make?.teamId),
      },
      zapier: {
        mode: deploy.zapier?.mode ?? 'manual',
        configured: true,
      },
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

/** POST /api/deploy/config — save deploy configs */
export async function POST(req: NextRequest) {
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));

    if (!canManageSettings(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions — admin or owner required' }, { status: 403 });
    }

    const body = await req.json();
    const incoming = body as DeployConfigs;

    // Fetch current org settings
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', membership.orgId)
      .single();

    if (fetchError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const currentSettings = (org.settings ?? {}) as Record<string, unknown>;
    const currentDeploy = (currentSettings.deploy ?? {}) as DeployConfigs;

    // Merge new configs with existing (don't wipe keys not in request)
    const newDeploy: DeployConfigs = {
      n8n: incoming.n8n !== undefined
        ? { ...currentDeploy.n8n, ...incoming.n8n }
        : currentDeploy.n8n,
      make: incoming.make !== undefined
        ? { ...currentDeploy.make, ...incoming.make }
        : currentDeploy.make,
      zapier: incoming.zapier !== undefined
        ? { ...currentDeploy.zapier, ...incoming.zapier }
        : currentDeploy.zapier,
    };

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        settings: { ...currentSettings, deploy: newDeploy },
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.orgId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

/** POST /api/deploy/config?action=test&platform=n8n|make — test connection */
export async function PUT(req: NextRequest) {
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');

    const body = await req.json();

    if (platform === 'n8n') {
      const { instanceUrl, apiKey } = body as { instanceUrl: string; apiKey: string };
      const result = await testN8nConnection({ instanceUrl, apiKey });
      return NextResponse.json(result);
    }

    if (platform === 'make') {
      const { apiToken, teamId } = body as { apiToken: string; teamId: number };
      const result = await testMakeConnection({ apiToken, teamId });
      return NextResponse.json(result);
    }

    void membership; // suppress unused warning
    return NextResponse.json({ error: 'platform must be n8n or make' }, { status: 400 });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
