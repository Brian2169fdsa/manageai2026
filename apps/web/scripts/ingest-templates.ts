#!/usr/bin/env tsx
/**
 * Ingest n8n templates from GitHub mega-repo into Supabase `templates` table.
 *
 * Usage (from apps/web/):
 *   npx tsx scripts/ingest-templates.ts
 *
 * Options (env vars):
 *   MAX_WORKFLOWS=500   Limit records for a test run (default: unlimited)
 *   SKIP_CLONE=1        Skip git clone if repo already present at CLONE_DIR
 *   BATCH_SIZE=50       Records per Supabase insert (default: 50)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ── Env loading (no dotenv dep required) ─────────────────────────────────────
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

// ── Config ────────────────────────────────────────────────────────────────────
const REPO_URL    = 'https://github.com/zengfr/n8n-workflow-all-templates.git';
const CLONE_DIR   = '/tmp/n8n-templates-zengfr';
const SOURCE_ID   = 'github:zengfr/n8n-workflow-all-templates';
const SOURCE_REPO = 'github.com/zengfr/n8n-workflow-all-templates';
const BATCH_SIZE  = Number(process.env.BATCH_SIZE  ?? 50);
const MAX_WORKFLOWS_ENV = process.env.MAX_WORKFLOWS;
const MAX_WORKFLOWS = MAX_WORKFLOWS_ENV ? Number(MAX_WORKFLOWS_ENV) : Infinity;
const SKIP_CLONE  = process.env.SKIP_CLONE === '1';
const MAX_JSON_BYTES = 400_000; // skip workflows whose JSON exceeds ~400KB

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure apps/web/.env.local exists and contains these variables.');
  process.exit(1);
}

// ── Node-type → tag lookup ────────────────────────────────────────────────────
// Ordered longest-prefix-first so more specific prefixes match first.
const NODE_TAG_MAP: [string, string][] = [
  // AI / LLM
  ['@n8n/n8n-nodes-langchain',              'AI/LLM'],
  ['n8n-nodes-base.openAi',                 'AI/LLM'],
  ['n8n-nodes-base.anthropic',              'AI/LLM'],
  // Communication
  ['n8n-nodes-base.slack',                  'Slack'],
  ['n8n-nodes-base.discord',                'Discord'],
  ['n8n-nodes-base.telegram',               'Telegram'],
  ['n8n-nodes-base.microsoftTeams',         'Microsoft Teams'],
  ['n8n-nodes-base.whatsApp',               'WhatsApp'],
  // Email
  ['n8n-nodes-base.gmail',                  'Gmail'],
  ['n8n-nodes-base.sendGrid',               'Email Marketing'],
  ['n8n-nodes-base.mailchimp',              'Email Marketing'],
  ['n8n-nodes-base.microsoftOutlook',       'Outlook'],
  ['n8n-nodes-base.emailSend',              'Email'],
  ['n8n-nodes-base.emailReadImap',          'Email'],
  // CRM
  ['n8n-nodes-base.hubspot',                'HubSpot'],
  ['n8n-nodes-base.salesforce',             'Salesforce'],
  ['n8n-nodes-base.pipedrive',              'Pipedrive'],
  // Productivity
  ['n8n-nodes-base.notion',                 'Notion'],
  ['n8n-nodes-base.googleSheets',           'Google Sheets'],
  ['n8n-nodes-base.airtable',               'Airtable'],
  ['n8n-nodes-base.trello',                 'Project Management'],
  ['n8n-nodes-base.asana',                  'Project Management'],
  ['n8n-nodes-base.jira',                   'Jira'],
  ['n8n-nodes-base.googleCalendar',         'Google Calendar'],
  // Dev tools
  ['n8n-nodes-base.github',                 'GitHub'],
  ['n8n-nodes-base.gitlab',                 'GitLab'],
  // Files / Storage
  ['n8n-nodes-base.googleDrive',            'Google Drive'],
  ['n8n-nodes-base.dropbox',                'Dropbox'],
  ['n8n-nodes-base.microsoftOneDrive',      'OneDrive'],
  ['n8n-nodes-base.awsS3',                  'AWS S3'],
  ['n8n-nodes-base.ftp',                    'FTP'],
  // HTTP / Webhooks
  ['n8n-nodes-base.webhook',                'Webhook'],
  ['n8n-nodes-base.httpRequest',            'HTTP/API'],
  // Scheduling
  ['n8n-nodes-base.scheduleTrigger',        'Scheduled'],
  ['n8n-nodes-base.cron',                   'Scheduled'],
  // Social
  ['n8n-nodes-base.twitter',                'Twitter/X'],
  ['n8n-nodes-base.linkedin',               'LinkedIn'],
  ['n8n-nodes-base.instagram',              'Instagram'],
  ['n8n-nodes-base.facebook',               'Facebook'],
  // Finance / E-commerce
  ['n8n-nodes-base.stripe',                 'Stripe'],
  ['n8n-nodes-base.quickbooks',             'QuickBooks'],
  ['n8n-nodes-base.xero',                   'Xero'],
  ['n8n-nodes-base.shopify',                'Shopify'],
  ['n8n-nodes-base.woocommerce',            'WooCommerce'],
  // HR
  ['n8n-nodes-base.bambooHr',               'BambooHR'],
  // Database
  ['n8n-nodes-base.postgres',               'Database'],
  ['n8n-nodes-base.mysql',                  'Database'],
  ['n8n-nodes-base.mongodb',                'Database'],
  ['n8n-nodes-base.redis',                  'Database'],
  // Support
  ['n8n-nodes-base.zendesk',                'Zendesk'],
  ['n8n-nodes-base.intercom',               'Intercom'],
  ['n8n-nodes-base.freshdesk',              'Freshdesk'],
  // Communication (extras)
  ['n8n-nodes-base.twilio',                 'SMS'],
  ['n8n-nodes-base.zoom',                   'Zoom'],
  // Misc
  ['n8n-nodes-base.wordpress',              'WordPress'],
  ['n8n-nodes-base.aws',                    'AWS'],
];

function extractTags(nodeTypes: string[]): string[] {
  const seen = new Set<string>();
  for (const nodeType of nodeTypes) {
    for (const [prefix, tag] of NODE_TAG_MAP) {
      if (nodeType === prefix || nodeType.startsWith(prefix)) {
        seen.add(tag);
        break;
      }
    }
  }
  return [...seen];
}

// ── Category determination ────────────────────────────────────────────────────
function determineCategory(nodeTypes: string[]): string {
  const joined = nodeTypes.join(' ').toLowerCase();

  if (/hubspot|salesforce|pipedrive|crm/.test(joined))                         return 'Sales & CRM';
  if (/openai|langchain|anthropic|chatgpt|gpt|llm|ai/.test(joined))            return 'AI & Automation';
  if (/github|gitlab|jira|jenkins|bitbucket|sonar/.test(joined))               return 'Development';
  if (/bamboohr|gusto|workday|bamboo/.test(joined))                             return 'HR & Recruiting';
  if (/stripe|quickbooks|xero|invoic|payment|paypal/.test(joined))             return 'Finance';
  if (/shopify|woocommerce|magento|ecommerce|bigcommerce/.test(joined))        return 'E-Commerce';
  if (/googledrive|dropbox|onedrive|s3|ftp|storage/.test(joined))              return 'File Management';
  if (/mailchimp|sendgrid|facebook|instagram|twitter|linkedin/.test(joined))   return 'Marketing';
  if (/zendesk|intercom|freshdesk|freshservice|support/.test(joined))          return 'Customer Support';
  if (/slack|discord|telegram|teams|whatsapp/.test(joined))                    return 'Communication';
  if (/postgres|mysql|mongodb|redis|database|sqlite/.test(joined))             return 'Data';
  if (/cron|schedule|report|analytics/.test(joined))                           return 'Reporting';

  return 'General Automation';
}

// ── Complexity ────────────────────────────────────────────────────────────────
function determineComplexity(nodeCount: number): string {
  if (nodeCount <= 3) return 'Beginner';
  if (nodeCount <= 7) return 'Intermediate';
  return 'Advanced';
}

// ── Trigger type ──────────────────────────────────────────────────────────────
function extractTriggerType(nodes: Array<{ type?: string; name?: string }>): string {
  const TRIGGER_PATTERNS: [RegExp, string][] = [
    [/webhook/i,                  'Webhook'],
    [/scheduleTrigger|cron/i,     'Schedule'],
    [/emailRead|imap/i,           'Email'],
    [/form/i,                     'Form'],
    [/chat|message/i,             'Message'],
    [/manualTrigger|start/i,      'Manual'],
  ];

  const triggerNode = nodes.find(n => {
    const t = n.type || '';
    return t.toLowerCase().includes('trigger') ||
           t.includes('webhook') ||
           t.includes('cron') ||
           t.includes('schedule') ||
           t.includes('manualTrigger');
  });

  if (!triggerNode?.type) return 'Webhook';

  for (const [pattern, label] of TRIGGER_PATTERNS) {
    if (pattern.test(triggerNode.type)) return label;
  }

  // Extract app name from type string like "n8n-nodes-base.slackTrigger"
  const base = triggerNode.type
    .replace('n8n-nodes-base.', '')
    .replace('@n8n/n8n-nodes-langchain.', '')
    .replace(/Trigger$/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1) || 'Webhook';
}

// ── Description generator ─────────────────────────────────────────────────────
// Format: "Connects App1, App2, and App3 with N steps"
function generateDescription(tags: string[], nodeCount: number): string {
  const appTags = tags.filter(t =>
    !['Webhook', 'HTTP/API', 'Scheduled', 'Manual', 'Database', 'FTP'].includes(t)
  );

  if (appTags.length === 0) {
    return `Automates a ${nodeCount}-step workflow using n8n.`;
  }

  const uniqueApps = [...new Set(appTags)].slice(0, 3);
  const appStr =
    uniqueApps.length === 1 ? uniqueApps[0] :
    uniqueApps.length === 2 ? `${uniqueApps[0]} and ${uniqueApps[1]}` :
    `${uniqueApps[0]}, ${uniqueApps[1]}, and ${uniqueApps[2]}`;

  return `Connects ${appStr} with ${nodeCount} step${nodeCount !== 1 ? 's' : '.'}`;
}

// ── Filesystem walker ─────────────────────────────────────────────────────────
function* walkJsonFiles(dir: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      yield* walkJsonFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      yield fullPath;
    }
  }
}

// ── Non-workflow JSON files to skip ──────────────────────────────────────────
const SKIP_FILENAMES = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json',
  'composer.json', '.eslintrc.json', 'manifest.json',
]);

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ManageAI — n8n Template Ingestion');
  console.log('  Source:', REPO_URL);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Clone ──────────────────────────────────────────────────────────
  if (SKIP_CLONE && fs.existsSync(CLONE_DIR)) {
    console.log(`✓ Using cached repo at ${CLONE_DIR}`);
  } else if (fs.existsSync(CLONE_DIR)) {
    console.log(`✓ Repo already present at ${CLONE_DIR} (use SKIP_CLONE=1 to skip re-check)`);
  } else {
    console.log(`Cloning ${REPO_URL} (depth=1, may take a minute)...`);
    try {
      execSync(`git clone --depth 1 "${REPO_URL}" "${CLONE_DIR}"`, { stdio: 'inherit' });
      console.log('✓ Clone complete');
    } catch (err) {
      console.error('ERROR: Clone failed:', err);
      process.exit(1);
    }
  }

  // ── Step 2: Delete existing records from this source (+ legacy source ID) ──
  const sourcesToClear = [SOURCE_ID, 'zengfr-mega']; // include legacy id from earlier runs
  let totalCleared = 0;
  for (const src of sourcesToClear) {
    const { error: delErr, count: delCount } = await supabase
      .from('templates')
      .delete({ count: 'exact' })
      .eq('source', src);
    if (delErr) {
      console.warn(`  Warning — could not clear source="${src}": ${delErr.message}`);
    } else if ((delCount ?? 0) > 0) {
      totalCleared += delCount ?? 0;
    }
  }
  console.log(`\nCleared ${totalCleared} old records (sources: ${sourcesToClear.join(', ')})`);
  if (totalCleared === 0) console.log('  (none found — fresh insert)');

  // ── Step 3: Parse all JSON files ───────────────────────────────────────────
  console.log('\nParsing workflow files...');
  type TemplateRow = {
    name: string; platform: string; category: string; description: string;
    node_count: number; tags: string[]; json_template: unknown;
    source_repo: string; source_filename: string; source: string;
    trigger_type: string; complexity: string;
  };

  const records: TemplateRow[] = [];
  let filesScanned = 0;
  let skippedNotWorkflow = 0;
  let skippedTooLarge = 0;
  let skippedBadJson = 0;

  for (const filePath of walkJsonFiles(CLONE_DIR)) {
    if (records.length >= MAX_WORKFLOWS) break;

    filesScanned++;
    const basename = path.basename(filePath);

    // Skip obvious non-workflow files
    if (SKIP_FILENAMES.has(basename) || basename.startsWith('.')) {
      skippedNotWorkflow++;
      continue;
    }

    // Read raw text first so we can check size before parsing
    let rawText: string;
    try {
      rawText = fs.readFileSync(filePath, 'utf-8');
    } catch {
      skippedBadJson++;
      continue;
    }

    if (Buffer.byteLength(rawText, 'utf-8') > MAX_JSON_BYTES) {
      skippedTooLarge++;
      continue;
    }

    // Parse JSON
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawText);
    } catch {
      skippedBadJson++;
      continue;
    }

    // Must have a non-empty nodes array — n8n workflow signature
    if (!Array.isArray(json.nodes) || (json.nodes as unknown[]).length === 0) {
      skippedNotWorkflow++;
      continue;
    }

    const nodes = json.nodes as Array<{ type?: string; name?: string }>;
    const nodeTypes = nodes.map(n => n.type ?? '').filter(Boolean);

    const tags        = extractTags(nodeTypes);
    const category    = determineCategory(nodeTypes);
    const nodeCount   = nodes.length;
    const complexity  = determineComplexity(nodeCount);
    const triggerType = extractTriggerType(nodes);

    // Name: prefer json.name; fall back to filename.
    // Strip leading numeric ID prefix: "6102_Salesforce_Lead..." → "Salesforce Lead..."
    const jsonName = typeof json.name === 'string' ? json.name.trim() : '';
    const rawName = jsonName ||
      path.basename(basename, '.json')
        .replace(/^\d+[_\s-]*/, '')   // strip leading "6102_"
        .replace(/[_]+/g, ' ')        // underscores → spaces
        .replace(/\s+/g, ' ')
        .trim();

    if (!rawName) { skippedNotWorkflow++; continue; }

    const name = rawName.slice(0, 200); // cap at 200 chars

    records.push({
      name,
      platform: 'n8n',
      category,
      description: generateDescription(tags, nodeCount),
      node_count: nodeCount,
      tags,
      json_template: json,
      source_repo: SOURCE_REPO,
      source_filename: path.relative(CLONE_DIR, filePath),
      source: SOURCE_ID,
      trigger_type: triggerType,
      complexity,
    });

    if (records.length % 500 === 0) {
      process.stdout.write(`  Parsed ${records.length.toLocaleString()} workflows (scanned ${filesScanned.toLocaleString()} files)...\r`);
    }
  }

  console.log(`\n✓ Parsed ${records.length.toLocaleString()} valid workflows`);
  console.log(`  Scanned: ${filesScanned.toLocaleString()} files`);
  console.log(`  Skipped (not workflow): ${skippedNotWorkflow.toLocaleString()}`);
  console.log(`  Skipped (too large):    ${skippedTooLarge.toLocaleString()}`);
  console.log(`  Skipped (bad JSON):     ${skippedBadJson.toLocaleString()}`);

  if (records.length === 0) {
    console.error('\nERROR: No valid workflow JSONs found. Check CLONE_DIR:', CLONE_DIR);
    process.exit(1);
  }

  // ── Step 4: Upsert in batches ───────────────────────────────────────────────
  console.log(`\nInserting ${records.length.toLocaleString()} records (batch=${BATCH_SIZE})...`);
  const startTime = Date.now();
  let inserted = 0;
  let batchErrors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    const { error } = await supabase.from('templates').insert(batch);

    if (error) {
      batchErrors++;
      // If first batch fails, log the full error; otherwise just count
      if (batchErrors <= 3) {
        console.error(`\n  Batch ${batchNum}/${totalBatches} error: ${error.message}`);
      }
    } else {
      inserted += batch.length;
    }

    // Progress every 10 batches
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = Math.round((Math.min(i + BATCH_SIZE, records.length) / records.length) * 100);
      process.stdout.write(
        `  [${pct.toString().padStart(3)}%] ${inserted.toLocaleString()} inserted, ${batchErrors} batch errors — ${elapsed}s\r`
      );
    }

    // Small delay to avoid rate limiting
    if (i + BATCH_SIZE < records.length) {
      await new Promise(r => setTimeout(r, 30));
    }
  }

  // ── Step 5: Final count ────────────────────────────────────────────────────
  const { count: totalInDB } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n═══════════════════════════════════════════════════════════`);
  console.log(`  INGESTION COMPLETE in ${elapsed}s`);
  console.log(`  Records inserted:      ${inserted.toLocaleString()} / ${records.length.toLocaleString()}`);
  console.log(`  Batch errors:          ${batchErrors}`);
  console.log(`  Total templates in DB: ${(totalInDB ?? 0).toLocaleString()}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  // Category breakdown
  const catCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log('Category breakdown:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(25)} ${count.toLocaleString()}`);
  }

  const tagCounts = records.reduce<Record<string, number>>((acc, r) => {
    for (const tag of r.tags) acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\nTop 15 tags:');
  for (const [tag, count] of topTags) {
    console.log(`  ${tag.padEnd(25)} ${count.toLocaleString()}`);
  }
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
