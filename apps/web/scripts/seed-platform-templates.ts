#!/usr/bin/env tsx
/**
 * Seed all platform templates (Make.com + Zapier) into Supabase.
 *
 * Usage (from apps/web/):
 *   npx tsx scripts/seed-platform-templates.ts
 *   npm run seed:templates
 *
 * Runs seed-make-templates.ts and seed-zapier-templates.ts sequentially
 * and prints a combined summary with per-platform counts.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(__dirname, '../.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.local'));

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ManageAI — Platform Template Seeder (Make + Zapier)      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('Make sure apps/web/.env.local exists and contains these variables.');
    process.exit(1);
  }

  const scriptsDir = __dirname;
  const tsx = 'npx tsx';

  // ── Run Make.com seeder ────────────────────────────────────────────────────
  console.log('━━━ Step 1/2: Seeding Make.com templates ━━━\n');
  try {
    execSync(`${tsx} "${path.join(scriptsDir, 'seed-make-templates.ts')}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.error('\n✗ Make.com seeder failed. Check the error above.\n');
    process.exit(1);
  }

  // ── Run Zapier seeder ──────────────────────────────────────────────────────
  console.log('\n━━━ Step 2/2: Seeding Zapier templates ━━━\n');
  try {
    execSync(`${tsx} "${path.join(scriptsDir, 'seed-zapier-templates.ts')}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.error('\n✗ Zapier seeder failed. Check the error above.\n');
    process.exit(1);
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [totalRes, n8nRes, makeRes, zapierRes] = await Promise.all([
    supabase.from('templates').select('*', { count: 'exact', head: true }),
    supabase.from('templates').select('*', { count: 'exact', head: true }).eq('platform', 'n8n'),
    supabase.from('templates').select('*', { count: 'exact', head: true }).eq('platform', 'make'),
    supabase.from('templates').select('*', { count: 'exact', head: true }).eq('platform', 'zapier'),
  ]);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  SEEDING COMPLETE — Template Library Summary              ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  n8n       ${String(n8nRes.count ?? 0).padStart(5)} templates                                    ║`);
  console.log(`║  Make.com  ${String(makeRes.count ?? 0).padStart(5)} templates                                    ║`);
  console.log(`║  Zapier    ${String(zapierRes.count ?? 0).padStart(5)} templates                                    ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  TOTAL     ${String(totalRes.count ?? 0).padStart(5)} templates                                    ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('✓ Template library ready. Visit /dashboard/templates to browse.\n');
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
