#!/usr/bin/env tsx
/**
 * Seed Make.com templates into Supabase `templates` table.
 * Usage: cd apps/web && npx tsx ../../scripts/seed-make-templates.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ── Env loading ──────────────────────────────────────────────────────────────
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
loadEnvFile(path.join(__dirname, '../apps/web/.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.local'));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SOURCE = 'seed:make-templates-v2';
const BATCH = 10;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Types ────────────────────────────────────────────────────────────────────
type Mod = {
  id: number; module: string; version: number;
  parameters: Record<string, unknown>; mapper: Record<string, unknown>;
  metadata: { designer: { x: number; y: number } };
};
type T = {
  name: string; category: string; description: string;
  tags: string[]; trigger_type: string; flow: Mod[];
};

function m(id: number, mod: string, x: number, mapper: Record<string, unknown> = {}): Mod {
  return { id, module: mod, version: 1, parameters: {}, mapper, metadata: { designer: { x, y: 150 } } };
}

// ── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES: T[] = [

// ═══ CRM & SALES (10) ═══════════════════════════════════════════════════════
{
  name: 'Inbound Lead Capture → HubSpot + Slack Notification',
  category: 'CRM & Sales',
  description: 'Capture webhook leads from any form, create HubSpot contacts, and alert the sales channel in Slack.',
  tags: ['HubSpot', 'Slack', 'Lead Capture'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'hubspot:createContact', 300, { email: '{{1.body.email}}', firstname: '{{1.body.first_name}}', lastname: '{{1.body.last_name}}', company: '{{1.body.company}}' }),
    m(3, 'slack:sendMessage', 600, { channel: '{{SLACK_SALES_CHANNEL}}', text: 'New lead: {{1.body.first_name}} {{1.body.last_name}} ({{1.body.email}}) from {{1.body.company}}' }),
  ],
},
{
  name: 'Pipedrive Deal Stage Change → CRM Sync + Follow-up Email',
  category: 'CRM & Sales',
  description: 'When a Pipedrive deal moves stages, log it in Google Sheets and send a follow-up email to the contact.',
  tags: ['Pipedrive', 'Google Sheets', 'Gmail'],
  trigger_type: 'Event',
  flow: [
    m(1, 'pipedrive:createDeal', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{SHEET_ID}}', values: ['{{1.title}}', '{{1.stage_id}}', '{{1.value}}', '{{formatDate(now,"YYYY-MM-DD")}}'] }),
    m(3, 'gmail:sendEmail', 600, { to: '{{1.person_id.email}}', subject: 'Update on {{1.title}}', content: 'Hi {{1.person_id.name}}, your deal has moved to the next stage.' }),
  ],
},
{
  name: 'Lead Scoring Router — High/Med/Low Priority Handling',
  category: 'CRM & Sales',
  description: 'Score inbound leads and route them: high-value get instant Slack + call, medium get email nurture, low get drip sequence.',
  tags: ['Lead Scoring', 'Slack', 'Gmail', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Score this lead 1-10: {{1.body.company}} with {{1.body.employees}} employees in {{1.body.industry}}. Reply JSON: {"score":N}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '{{SLACK_SALES_CHANNEL}}', text: '🔥 HIGH-VALUE LEAD: {{1.body.first_name}} {{1.body.last_name}} — Score: {{3.score}}' }),
    m(6, 'gmail:sendEmail', 1200, { to: '{{1.body.email}}', subject: 'Thanks for your interest', content: 'We received your inquiry and will be in touch within 24 hours.' }),
  ],
},
{
  name: 'Weekly Pipeline Digest → AI Summary to Slack',
  category: 'CRM & Sales',
  description: 'Every Monday, pull open deals from HubSpot, generate an AI summary, and post the pipeline digest to Slack.',
  tags: ['HubSpot', 'OpenAI', 'Slack', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 604800 }),
    m(2, 'hubspot:searchCRM', 300, { objectType: 'deals', filters: [{ propertyName: 'dealstage', operator: 'NEQ', value: 'closedwon' }] }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Summarize this pipeline for a Monday standup: {{json(2.results)}}' }] }),
    m(4, 'slack:sendMessage', 900, { channel: '{{SLACK_SALES_CHANNEL}}', text: '📊 Weekly Pipeline Digest:\n{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Salesforce Contact → HubSpot Sync + Dedup Check',
  category: 'CRM & Sales',
  description: 'Sync new Salesforce contacts to HubSpot with deduplication. Skip if contact already exists.',
  tags: ['Salesforce', 'HubSpot', 'Sync'],
  trigger_type: 'Event',
  flow: [
    m(1, 'salesforce:watchRecords', 0, { object: 'Contact' }),
    m(2, 'hubspot:searchCRM', 300, { objectType: 'contacts', filters: [{ propertyName: 'email', operator: 'EQ', value: '{{1.Email}}' }] }),
    m(3, 'flow-control:router', 600),
    m(4, 'hubspot:createContact', 900, { email: '{{1.Email}}', firstname: '{{1.FirstName}}', lastname: '{{1.LastName}}', phone: '{{1.Phone}}' }),
    m(5, 'hubspot:updateContact', 900, { id: '{{2.results[0].id}}', phone: '{{1.Phone}}', company: '{{1.Company}}' }),
  ],
},
{
  name: 'Meeting Prep Bot — Pull CRM Data Before Calls',
  category: 'CRM & Sales',
  description: 'When a Calendly meeting is booked, pull the contact from HubSpot, summarize with AI, and send prep notes to the rep.',
  tags: ['Calendly', 'HubSpot', 'OpenAI', 'Gmail'],
  trigger_type: 'Event',
  flow: [
    m(1, 'calendly:watchInvitees', 0),
    m(2, 'hubspot:searchCRM', 300, { objectType: 'contacts', filters: [{ propertyName: 'email', operator: 'EQ', value: '{{1.email}}' }] }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Create meeting prep notes for a call with {{1.name}} from contact data: {{json(2.results[0])}}' }] }),
    m(4, 'gmail:sendEmail', 900, { to: '{{1.event_type.owner.email}}', subject: 'Meeting Prep: {{1.name}}', content: '{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Referral Tracking — Form → CRM + Referrer Credit',
  category: 'CRM & Sales',
  description: 'Track referrals from a form submission, create CRM deals, and credit the referrer in a Google Sheet.',
  tags: ['Typeform', 'HubSpot', 'Google Sheets'],
  trigger_type: 'Event',
  flow: [
    m(1, 'typeform:watchResponses', 0),
    m(2, 'hubspot:createContact', 300, { email: '{{1.answers[0].email}}', firstname: '{{1.answers[1].text}}' }),
    m(3, 'hubspot:createDeal', 600, { dealname: 'Referral: {{1.answers[1].text}}', pipeline: 'default', dealstage: 'appointmentscheduled' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{REFERRAL_SHEET}}', values: ['{{1.answers[2].text}}', '{{1.answers[1].text}}', '{{formatDate(now,"YYYY-MM-DD")}}', 'pending'] }),
  ],
},
{
  name: 'Quote Generator — Deal Data → PDF Quote Email',
  category: 'CRM & Sales',
  description: 'When a deal reaches proposal stage, generate a quote PDF from deal data and email it to the contact.',
  tags: ['Pipedrive', 'PDF', 'Gmail'],
  trigger_type: 'Event',
  flow: [
    m(1, 'pipedrive:updateDeal', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Generate HTML quote for: {{1.title}}, value ${{1.value}}, contact {{1.person_id.name}}' }] }),
    m(3, 'pdf-co:convertHTML', 600, { html: '{{2.choices[0].message.content}}', name: 'quote_{{1.id}}.pdf' }),
    m(4, 'gmail:sendEmail', 900, { to: '{{1.person_id.email}}', subject: 'Quote for {{1.title}}', content: 'Please find your quote attached.', attachments: ['{{3.url}}'] }),
  ],
},
{
  name: 'Win-Back Campaign — Lost Deals Reactivation',
  category: 'CRM & Sales',
  description: 'Every week, find deals lost 30+ days ago, craft personalized win-back emails with AI, and send them.',
  tags: ['HubSpot', 'OpenAI', 'SendGrid', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 604800 }),
    m(2, 'hubspot:searchCRM', 300, { objectType: 'deals', filters: [{ propertyName: 'dealstage', operator: 'EQ', value: 'closedlost' }] }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.results}}' }),
    m(4, 'openai:createChatCompletion', 900, { model: 'gpt-4', messages: [{ role: 'user', content: 'Write a warm win-back email for {{3.dealname}} lost on {{3.closedate}}. Be empathetic, offer value.' }] }),
    m(5, 'sendgrid:sendEmail', 1200, { to: '{{3.contact_email}}', subject: 'We miss you — new offer inside', content: '{{4.choices[0].message.content}}' }),
    m(6, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'Lead Enrichment — Webhook → AI Scoring → Datastore',
  category: 'CRM & Sales',
  description: 'Enrich incoming leads with AI scoring, store results in a datastore for lookup, and notify if high-value.',
  tags: ['OpenAI', 'Datastore', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Enrich and score: {{json(1.body)}}. Return JSON with score, industry, company_size.' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'datastore:addRecord', 900, { key: '{{1.body.email}}', data: { score: '{{3.score}}', industry: '{{3.industry}}', enriched_at: '{{now}}' } }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '{{SLACK_SALES_CHANNEL}}', text: '🎯 High-value lead: {{1.body.email}} scored {{3.score}}/10' }),
  ],
},

// ═══ MARKETING (10) ═══════════════════════════════════════════════════════════
{
  name: 'Social Cross-Post — Blog RSS → Twitter + LinkedIn + Facebook',
  category: 'Marketing',
  description: 'When a new blog post publishes via RSS, automatically share it across Twitter, LinkedIn, and Facebook.',
  tags: ['RSS', 'Twitter', 'LinkedIn', 'Facebook'],
  trigger_type: 'Event',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Write 3 social posts (twitter 280 chars, linkedin professional, facebook casual) for: {{1.body.title}} - {{1.body.excerpt}}. Return JSON array.' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'http:makeRequest', 900, { url: 'https://api.twitter.com/2/tweets', method: 'POST', body: { text: '{{3[0].twitter}}' } }),
    m(5, 'http:makeRequest', 1200, { url: 'https://api.linkedin.com/v2/ugcPosts', method: 'POST', body: { text: '{{3[0].linkedin}}' } }),
    m(6, 'http:makeRequest', 1500, { url: 'https://graph.facebook.com/me/feed', method: 'POST', body: { message: '{{3[0].facebook}}' } }),
  ],
},
{
  name: 'Webinar Registration → Email Sequence + CRM Tag',
  category: 'Marketing',
  description: 'When someone registers for a webinar, add them to Mailchimp, tag them, and start a 3-email warmup sequence.',
  tags: ['Typeform', 'Mailchimp', 'HubSpot'],
  trigger_type: 'Event',
  flow: [
    m(1, 'typeform:watchResponses', 0),
    m(2, 'mailchimp:addSubscriber', 300, { email: '{{1.answers[0].email}}', listId: '{{MAILCHIMP_LIST}}', firstName: '{{1.answers[1].text}}' }),
    m(3, 'mailchimp:tagSubscriber', 600, { email: '{{1.answers[0].email}}', tags: ['webinar-registered', '{{1.form_id}}'] }),
    m(4, 'hubspot:createContact', 900, { email: '{{1.answers[0].email}}', firstname: '{{1.answers[1].text}}', lifecycle_stage: 'lead' }),
  ],
},
{
  name: 'AI Newsletter Generator — Weekly Content Roundup',
  category: 'Marketing',
  description: 'Every week, pull recent blog posts, summarize with AI, format into a newsletter, and send via SendGrid.',
  tags: ['OpenAI', 'SendGrid', 'Google Sheets', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 604800 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{CONTENT_SHEET}}', filter: 'published_date >= {{subtractDays(now, 7)}}' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Create an engaging HTML newsletter from these articles: {{json(2.rows)}}. Include summaries, CTAs, and a catchy subject line. Return JSON: {subject, html}' }] }),
    m(4, 'json:parseJSON', 900, { value: '{{3.choices[0].message.content}}' }),
    m(5, 'sendgrid:sendEmail', 1200, { to: '{{NEWSLETTER_LIST}}', subject: '{{4.subject}}', content: '{{4.html}}' }),
  ],
},
{
  name: 'Content Calendar Automation — Notion → Social Queue',
  category: 'Marketing',
  description: 'When a content piece moves to "Ready" in Notion, auto-schedule posts and update the calendar.',
  tags: ['Notion', 'Slack', 'Google Sheets'],
  trigger_type: 'Event',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'notion:queryDatabase', 300, { databaseId: '{{NOTION_DB}}', filter: { property: 'Status', select: { equals: 'Ready' } } }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.results}}' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{CALENDAR_SHEET}}', values: ['{{3.properties.Title.title[0].text.content}}', '{{3.properties.Platform.select.name}}', '{{3.properties.Date.date.start}}'] }),
    m(5, 'slack:sendMessage', 1200, { channel: '#content', text: '📅 Scheduled: "{{3.properties.Title.title[0].text.content}}" for {{3.properties.Date.date.start}}' }),
    m(6, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'SEO Rank Monitor — Scheduled Check + Alert',
  category: 'Marketing',
  description: 'Daily check keyword rankings via API, store in datastore, and alert Slack if any drop below threshold.',
  tags: ['HTTP', 'Datastore', 'Slack', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'http:makeRequest', 300, { url: '{{SEO_API_URL}}/rankings', method: 'GET', headers: { Authorization: 'Bearer {{SEO_API_KEY}}' } }),
    m(3, 'json:parseJSON', 600, { value: '{{2.body}}' }),
    m(4, 'flow-control:iterator', 900, { array: '{{3.keywords}}' }),
    m(5, 'datastore:addRecord', 1200, { key: '{{4.keyword}}', data: { rank: '{{4.position}}', date: '{{now}}' } }),
    m(6, 'flow-control:router', 1500),
    m(7, 'slack:sendMessage', 1800, { channel: '#seo', text: '⚠️ Rank drop: "{{4.keyword}}" dropped to position {{4.position}}' }),
    m(8, 'flow-control:aggregator', 2100),
  ],
},
{
  name: 'Campaign ROI Reporter — Ads Data → AI Analysis',
  category: 'Marketing',
  description: 'Pull ad campaign data from Google Sheets, analyze ROI with AI, and post the report to Slack.',
  tags: ['Google Sheets', 'OpenAI', 'Slack', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 604800 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{ADS_SHEET}}' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze this ad campaign data and provide ROI insights, top performers, and recommendations: {{json(2.rows)}}' }] }),
    m(4, 'slack:sendMessage', 900, { channel: '#marketing', text: '📊 Weekly Campaign Report:\n{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Landing Page Lead → Segment + Nurture Flow',
  category: 'Marketing',
  description: 'Capture landing page form submissions, segment by interest, and start appropriate nurture email sequences.',
  tags: ['Webhook', 'Mailchimp', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:router', 300),
    m(3, 'mailchimp:addSubscriber', 600, { email: '{{1.body.email}}', listId: '{{ENTERPRISE_LIST}}', tags: ['enterprise'] }),
    m(4, 'mailchimp:addSubscriber', 600, { email: '{{1.body.email}}', listId: '{{SMB_LIST}}', tags: ['smb'] }),
    m(5, 'mailchimp:addSubscriber', 600, { email: '{{1.body.email}}', listId: '{{STARTUP_LIST}}', tags: ['startup'] }),
  ],
},
{
  name: 'Social Listening — Brand Mentions → Datastore + Alert',
  category: 'Marketing',
  description: 'Monitor brand mentions via webhook, store in datastore for analysis, and alert on negative sentiment.',
  tags: ['Webhook', 'OpenAI', 'Datastore', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze sentiment of this brand mention: "{{1.body.text}}". Return JSON: {sentiment, score, summary}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'datastore:addRecord', 900, { key: '{{1.body.id}}', data: { text: '{{1.body.text}}', sentiment: '{{3.sentiment}}', score: '{{3.score}}', source: '{{1.body.platform}}' } }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#brand', text: '🚨 Negative mention ({{3.score}}): "{{1.body.text}}" on {{1.body.platform}}' }),
  ],
},
{
  name: 'A/B Test Results Collector — Sheets → Slack Summary',
  category: 'Marketing',
  description: 'When A/B test results are logged in Google Sheets, analyze them with AI and share insights in Slack.',
  tags: ['Google Sheets', 'OpenAI', 'Slack'],
  trigger_type: 'Event',
  flow: [
    m(1, 'google-sheets:watchRows', 0, { spreadsheetId: '{{AB_TEST_SHEET}}' }),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze A/B test: Variant A={{1.variant_a_conversion}}% vs B={{1.variant_b_conversion}}%. Sample={{1.sample_size}}. Is it significant? Recommend next steps.' }] }),
    m(3, 'slack:sendMessage', 600, { channel: '#marketing', text: '🧪 A/B Test Result: {{1.test_name}}\n{{2.choices[0].message.content}}' }),
  ],
},
{
  name: 'Email List Hygiene — Bounce Processing + Cleanup',
  category: 'Marketing',
  description: 'Process email bounces, update subscriber status, and maintain list health metrics in a datastore.',
  tags: ['SendGrid', 'Datastore', 'Iterator'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:iterator', 300, { array: '{{1.body.bounces}}' }),
    m(3, 'datastore:searchRecords', 600, { key: '{{2.email}}' }),
    m(4, 'datastore:updateRecord', 900, { key: '{{2.email}}', data: { status: 'bounced', bounce_count: '{{add(3.bounce_count, 1)}}', last_bounce: '{{now}}' } }),
    m(5, 'flow-control:aggregator', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#marketing', text: '📧 Processed {{1.body.bounces.length}} bounces. List updated.' }),
  ],
},

// ═══ OPERATIONS (10) ═════════════════════════════════════════════════════════
{
  name: 'Form Approval Workflow — Submit → Route → Approve/Reject',
  category: 'Operations',
  description: 'Route form submissions to the right approver based on type. Track approvals in Google Sheets.',
  tags: ['Jotform', 'Slack', 'Google Sheets', 'Router'],
  trigger_type: 'Event',
  flow: [
    m(1, 'jotform:watchSubmissions', 0),
    m(2, 'flow-control:router', 300),
    m(3, 'slack:sendMessage', 600, { channel: '{{FINANCE_CHANNEL}}', text: 'Finance approval needed: {{1.submission_id}} — ${{1.amount}}' }),
    m(4, 'slack:sendMessage', 600, { channel: '{{HR_CHANNEL}}', text: 'HR approval needed: {{1.submission_id}} — {{1.request_type}}' }),
    m(5, 'google-sheets:addRow', 900, { spreadsheetId: '{{APPROVALS_SHEET}}', values: ['{{1.submission_id}}', '{{1.type}}', '{{1.amount}}', 'pending', '{{now}}'] }),
  ],
},
{
  name: 'AI Document Extraction — Upload → Parse → Store',
  category: 'Operations',
  description: 'When a document is uploaded, extract key information with AI and store structured data in Airtable.',
  tags: ['Google Drive', 'OpenAI', 'Airtable'],
  trigger_type: 'Event',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'google-drive:downloadFile', 300, { fileId: '{{1.body.file_id}}' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Extract key data from this document: {{2.content}}. Return JSON with: title, date, parties, key_terms, amounts.' }] }),
    m(4, 'json:parseJSON', 900, { value: '{{3.choices[0].message.content}}' }),
    m(5, 'airtable:createRecord', 1200, { baseId: '{{AIRTABLE_BASE}}', tableId: '{{DOCS_TABLE}}', fields: { Title: '{{4.title}}', Date: '{{4.date}}', Parties: '{{4.parties}}', Amount: '{{4.amounts}}' } }),
  ],
},
{
  name: 'Inventory Alert System — Low Stock → Reorder + Notify',
  category: 'Operations',
  description: 'Monitor inventory levels in Google Sheets. When stock drops below threshold, create reorder requests and alert the team.',
  tags: ['Google Sheets', 'Slack', 'Gmail', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 3600 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{INVENTORY_SHEET}}', filter: 'quantity < reorder_point' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#ops', text: '🚨 CRITICAL: {{3.product_name}} at {{3.quantity}} units (min: {{3.reorder_point}})' }),
    m(6, 'gmail:sendEmail', 1200, { to: '{{3.supplier_email}}', subject: 'Reorder: {{3.product_name}}', content: 'Please process reorder of {{3.reorder_quantity}} units of {{3.product_name}}.' }),
    m(7, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'Expense Report Processing — Receipt → Extract → Approve',
  category: 'Operations',
  description: 'Process expense receipts: extract amounts with AI, categorize, and route for approval based on amount.',
  tags: ['Gmail', 'OpenAI', 'Google Sheets', 'Router'],
  trigger_type: 'Event',
  flow: [
    m(1, 'gmail:watchEmails', 0, { label: 'expenses' }),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Extract from this expense email: {{1.text}}. Return JSON: {amount, category, vendor, date, description}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{EXPENSE_SHEET}}', values: ['{{1.from}}', '{{3.amount}}', '{{3.category}}', '{{3.vendor}}', '{{3.date}}', 'pending'] }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#finance', text: 'Expense over $500 needs approval: ${{3.amount}} from {{1.from}} at {{3.vendor}}' }),
  ],
},
{
  name: 'Daily Standup Bot — Collect + Summarize + Post',
  category: 'Operations',
  description: 'At 9am, collect standup updates from a Slack channel, summarize with AI, and post a digest.',
  tags: ['Slack', 'OpenAI', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'slack:sendMessage', 300, { channel: '#standup', text: '🌅 Good morning! Drop your standup: 1) Yesterday 2) Today 3) Blockers' }),
    m(3, 'flow-control:sleep', 600, { delay: 3600 }),
    m(4, 'http:makeRequest', 900, { url: 'https://slack.com/api/conversations.history', method: 'GET', qs: { channel: '{{STANDUP_CHANNEL}}', limit: 50 } }),
    m(5, 'openai:createChatCompletion', 1200, { model: 'gpt-4', messages: [{ role: 'user', content: 'Summarize these standup updates into a clean digest: {{json(4.body.messages)}}' }] }),
    m(6, 'slack:sendMessage', 1500, { channel: '#team', text: '📋 Daily Standup Summary:\n{{5.choices[0].message.content}}' }),
  ],
},
{
  name: 'Visitor Check-In System — QR Scan → Notify Host',
  category: 'Operations',
  description: 'When a visitor scans a QR code, log their visit and notify the host via Slack and SMS.',
  tags: ['Webhook', 'Twilio', 'Slack', 'Google Sheets'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{VISITOR_LOG}}', values: ['{{1.body.visitor_name}}', '{{1.body.company}}', '{{1.body.host_name}}', '{{now}}', 'checked-in'] }),
    m(3, 'slack:sendMessage', 600, { channel: '@{{1.body.host_slack}}', text: '🏢 Your visitor {{1.body.visitor_name}} from {{1.body.company}} has arrived at reception.' }),
    m(4, 'twilio:sendSMS', 900, { to: '{{1.body.host_phone}}', body: 'Your visitor {{1.body.visitor_name}} from {{1.body.company}} has arrived.' }),
  ],
},
{
  name: 'Contract Renewal Tracker — 30/15/7 Day Alerts',
  category: 'Operations',
  description: 'Check contract expiry dates daily and send tiered alerts at 30, 15, and 7 days before expiration.',
  tags: ['Google Sheets', 'Slack', 'Gmail', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{CONTRACTS_SHEET}}' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#ops', text: '🔴 CONTRACT EXPIRING IN 7 DAYS: {{3.client}} — {{3.contract_name}}' }),
    m(6, 'slack:sendMessage', 1200, { channel: '#ops', text: '🟡 Contract renewal in 15 days: {{3.client}} — {{3.contract_name}}' }),
    m(7, 'gmail:sendEmail', 1200, { to: '{{3.owner_email}}', subject: '30 day notice: {{3.contract_name}} renewal', content: 'The contract {{3.contract_name}} for {{3.client}} expires in 30 days.' }),
    m(8, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'AI Meeting Notes — Transcript → Summary → Action Items',
  category: 'Operations',
  description: 'Process meeting transcripts with AI to extract summaries and action items, then distribute to attendees.',
  tags: ['Webhook', 'OpenAI', 'Gmail', 'Notion'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Summarize this meeting transcript. Provide: 1) Key decisions 2) Action items with owners 3) Follow-ups needed. Transcript: {{1.body.transcript}}' }] }),
    m(3, 'notion:createPage', 600, { databaseId: '{{MEETINGS_DB}}', properties: { Title: '{{1.body.meeting_title}}', Date: '{{1.body.date}}' }, content: '{{2.choices[0].message.content}}' }),
    m(4, 'gmail:sendEmail', 900, { to: '{{1.body.attendees}}', subject: 'Meeting Notes: {{1.body.meeting_title}}', content: '{{2.choices[0].message.content}}' }),
  ],
},
{
  name: 'Supply Request Workflow — Form → Budget Check → Order',
  category: 'Operations',
  description: 'Process supply requests: check budget availability, auto-approve under threshold, escalate larger requests.',
  tags: ['Jotform', 'Google Sheets', 'Slack', 'Router'],
  trigger_type: 'Event',
  flow: [
    m(1, 'jotform:watchSubmissions', 0),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{BUDGET_SHEET}}', filter: 'department = "{{1.department}}"' }),
    m(3, 'flow-control:router', 600),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{ORDERS_SHEET}}', values: ['{{1.item}}', '{{1.quantity}}', '{{1.cost}}', 'auto-approved', '{{now}}'] }),
    m(5, 'slack:sendMessage', 900, { channel: '#approvals', text: '⚠️ Supply request over budget: {{1.item}} (${{1.cost}}) by {{1.requester}}. Remaining budget: ${{2.rows[0].remaining}}' }),
  ],
},
{
  name: 'SOP Version Control — Doc Update → Notify + Archive',
  category: 'Operations',
  description: 'When an SOP document is updated in Google Drive, archive the old version and notify the team.',
  tags: ['Google Drive', 'Slack', 'Google Sheets'],
  trigger_type: 'Event',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'google-drive:downloadFile', 300, { fileId: '{{1.body.file_id}}' }),
    m(3, 'google-drive:uploadFile', 600, { name: '{{1.body.file_name}}_v{{1.body.version}}_archive', parents: ['{{SOP_ARCHIVE_FOLDER}}'] }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{SOP_LOG}}', values: ['{{1.body.file_name}}', '{{1.body.version}}', '{{1.body.updated_by}}', '{{now}}'] }),
    m(5, 'slack:sendMessage', 1200, { channel: '#ops', text: '📝 SOP Updated: {{1.body.file_name}} (v{{1.body.version}}) by {{1.body.updated_by}}' }),
  ],
},

// ═══ FINANCE (8) ═════════════════════════════════════════════════════════════
{
  name: 'Invoice Data Extraction — Email → AI Parse → Sheets',
  category: 'Finance',
  description: 'Extract invoice data from emails with AI, parse amounts and vendor info, and log in Google Sheets.',
  tags: ['Gmail', 'OpenAI', 'Google Sheets'],
  trigger_type: 'Event',
  flow: [
    m(1, 'gmail:watchEmails', 0, { label: 'invoices' }),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Extract invoice details: {{1.text}}. Return JSON: {vendor, invoice_number, amount, due_date, line_items}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{INVOICE_SHEET}}', values: ['{{3.vendor}}', '{{3.invoice_number}}', '{{3.amount}}', '{{3.due_date}}', 'pending', '{{now}}'] }),
  ],
},
{
  name: 'Payment Received → Update Tracker + Thank You Email',
  category: 'Finance',
  description: 'When Stripe receives a payment, update the tracking sheet and send an automated thank-you email.',
  tags: ['Stripe', 'Google Sheets', 'Gmail'],
  trigger_type: 'Event',
  flow: [
    m(1, 'stripe:watchEvents', 0, { events: ['payment_intent.succeeded'] }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{PAYMENTS_SHEET}}', filter: 'invoice_id = "{{1.data.object.invoice}}"' }),
    m(3, 'google-sheets:updateRow', 600, { spreadsheetId: '{{PAYMENTS_SHEET}}', rowNumber: '{{2.rows[0].__rowNumber}}', values: { status: 'paid', paid_date: '{{now}}', amount: '{{divide(1.data.object.amount, 100)}}' } }),
    m(4, 'gmail:sendEmail', 900, { to: '{{1.data.object.receipt_email}}', subject: 'Payment received — Thank you!', content: 'We received your payment of ${{divide(1.data.object.amount, 100)}}. Invoice: {{1.data.object.invoice}}.' }),
  ],
},
{
  name: 'Overdue Invoice Escalation — 7/14/30 Day Tiers',
  category: 'Finance',
  description: 'Check for overdue invoices daily and escalate with increasingly urgent reminders.',
  tags: ['Google Sheets', 'SendGrid', 'Slack', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{INVOICE_SHEET}}', filter: 'status = "pending" AND due_date < now()' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'sendgrid:sendEmail', 1200, { to: '{{3.contact_email}}', subject: 'FINAL NOTICE: Invoice {{3.invoice_number}}', content: 'This invoice is 30+ days overdue. Amount: ${{3.amount}}.' }),
    m(6, 'sendgrid:sendEmail', 1200, { to: '{{3.contact_email}}', subject: 'Reminder: Invoice {{3.invoice_number}} overdue', content: 'Your invoice of ${{3.amount}} is 14 days past due.' }),
    m(7, 'sendgrid:sendEmail', 1200, { to: '{{3.contact_email}}', subject: 'Friendly reminder: Invoice {{3.invoice_number}}', content: 'Your invoice of ${{3.amount}} is 7 days past due.' }),
    m(8, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'Expense Approval Workflow — Router by Amount',
  category: 'Finance',
  description: 'Route expense approvals: auto-approve under $100, manager for $100-500, VP for $500+.',
  tags: ['Webhook', 'Slack', 'Google Sheets', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:router', 300),
    m(3, 'google-sheets:addRow', 600, { spreadsheetId: '{{EXPENSE_SHEET}}', values: ['{{1.body.employee}}', '{{1.body.amount}}', '{{1.body.category}}', 'auto-approved', '{{now}}'] }),
    m(4, 'slack:sendMessage', 600, { channel: '@{{1.body.manager_slack}}', text: 'Expense approval needed: ${{1.body.amount}} by {{1.body.employee}} — {{1.body.description}}' }),
    m(5, 'slack:sendMessage', 600, { channel: '#vp-approvals', text: '🔴 High-value expense: ${{1.body.amount}} by {{1.body.employee}} — Requires VP approval' }),
  ],
},
{
  name: 'Monthly Financial Summary — AI Report Generation',
  category: 'Finance',
  description: 'At month end, pull financial data, generate an AI summary with insights, and distribute to leadership.',
  tags: ['Google Sheets', 'OpenAI', 'Gmail', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 2592000 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{FINANCE_SHEET}}' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Create a concise monthly financial report with key metrics, trends, and concerns from: {{json(2.rows)}}' }] }),
    m(4, 'gmail:sendEmail', 900, { to: '{{CFO_EMAIL}},{{CEO_EMAIL}}', subject: 'Monthly Financial Summary — {{formatDate(now, "MMMM YYYY")}}', content: '{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Subscription Billing Tracker — Stripe → Sheets Sync',
  category: 'Finance',
  description: 'Track all subscription billing events from Stripe, log in Google Sheets, and alert on failures.',
  tags: ['Stripe', 'Google Sheets', 'Slack', 'Router'],
  trigger_type: 'Event',
  flow: [
    m(1, 'stripe:watchEvents', 0, { events: ['invoice.paid', 'invoice.payment_failed'] }),
    m(2, 'flow-control:router', 300),
    m(3, 'google-sheets:addRow', 600, { spreadsheetId: '{{BILLING_SHEET}}', values: ['{{1.data.object.customer_email}}', '{{divide(1.data.object.amount_paid, 100)}}', 'paid', '{{now}}'] }),
    m(4, 'google-sheets:addRow', 600, { spreadsheetId: '{{BILLING_SHEET}}', values: ['{{1.data.object.customer_email}}', '{{divide(1.data.object.amount_due, 100)}}', 'failed', '{{now}}'] }),
    m(5, 'slack:sendMessage', 900, { channel: '#billing', text: '❌ Payment failed: {{1.data.object.customer_email}} — ${{divide(1.data.object.amount_due, 100)}}' }),
  ],
},
{
  name: 'Budget Alert Monitor — Threshold Notifications',
  category: 'Finance',
  description: 'Monitor department budgets and alert when spending reaches 80% or 100% of allocated amounts.',
  tags: ['Google Sheets', 'Slack', 'Scheduled', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{BUDGET_SHEET}}' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#finance', text: '🔴 BUDGET EXCEEDED: {{3.department}} has spent ${{3.spent}} of ${{3.budget}} ({{3.percentage}}%)' }),
    m(6, 'slack:sendMessage', 1200, { channel: '#finance', text: '🟡 Budget warning: {{3.department}} at {{3.percentage}}% (${{3.spent}}/${{3.budget}})' }),
    m(7, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'Revenue Milestone Celebrations — Auto Detect + Notify',
  category: 'Finance',
  description: 'Track revenue milestones. When a new milestone is hit, celebrate in Slack and log it.',
  tags: ['Stripe', 'Datastore', 'Slack'],
  trigger_type: 'Event',
  flow: [
    m(1, 'stripe:watchEvents', 0, { events: ['payment_intent.succeeded'] }),
    m(2, 'datastore:searchRecords', 300, { key: 'revenue_total' }),
    m(3, 'tools:setVariable', 600, { name: 'new_total', value: '{{add(2.data.total, divide(1.data.object.amount, 100))}}' }),
    m(4, 'datastore:updateRecord', 900, { key: 'revenue_total', data: { total: '{{3.new_total}}' } }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#general', text: '🎉🎉🎉 MILESTONE: We just crossed ${{3.new_total}} in revenue! 🚀' }),
  ],
},

// ═══ CUSTOMER SUPPORT (10) ═══════════════════════════════════════════════════
{
  name: 'Ticket Routing — AI Classification → Team Assignment',
  category: 'Customer Support',
  description: 'Classify incoming tickets with AI and route to the right team: billing, technical, or general.',
  tags: ['Webhook', 'OpenAI', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Classify this support ticket into: billing, technical, general. Ticket: "{{1.body.subject}} — {{1.body.message}}". Return JSON: {category, priority, summary}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#support-billing', text: '💰 Billing ticket: {{1.body.subject}} ({{3.priority}})' }),
    m(6, 'slack:sendMessage', 1200, { channel: '#support-tech', text: '🔧 Technical ticket: {{1.body.subject}} ({{3.priority}})' }),
    m(7, 'slack:sendMessage', 1200, { channel: '#support-general', text: '📩 General ticket: {{1.body.subject}} ({{3.priority}})' }),
  ],
},
{
  name: 'SLA Escalation Timer — Auto-Escalate Overdue Tickets',
  category: 'Customer Support',
  description: 'Check for tickets approaching SLA breach. Escalate to managers at 80% and directors at 100%.',
  tags: ['Google Sheets', 'Slack', 'Gmail', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 900 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{TICKETS_SHEET}}', filter: 'status != "resolved"' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#support-escalations', text: '🔴 SLA BREACH: Ticket #{{3.id}} — {{3.subject}} ({{3.hours_open}}h open)' }),
    m(6, 'gmail:sendEmail', 1200, { to: '{{3.manager_email}}', subject: 'SLA Warning: Ticket #{{3.id}}', content: 'Ticket approaching SLA breach at 80%.' }),
    m(7, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'CSAT Survey Analysis — Collect + AI Insights',
  category: 'Customer Support',
  description: 'Analyze CSAT responses with AI, detect patterns, and generate weekly insight reports.',
  tags: ['Google Forms', 'OpenAI', 'Slack', 'Google Sheets'],
  trigger_type: 'Event',
  flow: [
    m(1, 'google-forms:watchResponses', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{CSAT_SHEET}}', values: ['{{1.email}}', '{{1.score}}', '{{1.feedback}}', '{{now}}'] }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze this CSAT feedback: Score={{1.score}}/5, Comment="{{1.feedback}}". Return JSON: {sentiment, themes, action_needed, summary}' }] }),
    m(4, 'json:parseJSON', 900, { value: '{{3.choices[0].message.content}}' }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#support', text: '⚠️ Low CSAT ({{1.score}}/5) from {{1.email}}: {{4.summary}}. Action: {{4.action_needed}}' }),
  ],
},
{
  name: 'AI FAQ Bot — Auto-Reply to Common Questions',
  category: 'Customer Support',
  description: 'Use AI to detect FAQ-type questions and send instant auto-replies, escalating complex issues to humans.',
  tags: ['Gmail', 'OpenAI', 'Router'],
  trigger_type: 'Event',
  flow: [
    m(1, 'gmail:watchEmails', 0, { label: 'support' }),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'system', content: 'You are a support bot. Classify: "faq" if common question, "complex" if needs human. Return JSON: {type, answer, confidence}' }, { role: 'user', content: '{{1.subject}}: {{1.text}}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'gmail:sendEmail', 1200, { to: '{{1.from}}', subject: 'Re: {{1.subject}}', content: '{{3.answer}}\n\n—\nIf this doesn\'t help, reply and a human will follow up.' }),
    m(6, 'slack:sendMessage', 1200, { channel: '#support-queue', text: '🧑 Human needed: "{{1.subject}}" from {{1.from}}' }),
  ],
},
{
  name: 'Bug Report Processor — Form → Jira + Slack Alert',
  category: 'Customer Support',
  description: 'Process bug report submissions, create Jira-style tickets in Notion, and alert the engineering team.',
  tags: ['Typeform', 'Notion', 'Slack'],
  trigger_type: 'Event',
  flow: [
    m(1, 'typeform:watchResponses', 0),
    m(2, 'notion:createPage', 300, { databaseId: '{{BUGS_DB}}', properties: { Title: '{{1.answers[0].text}}', Severity: '{{1.answers[1].choice.label}}', Reporter: '{{1.answers[2].email}}', Status: 'Open' } }),
    m(3, 'slack:sendMessage', 600, { channel: '#engineering', text: '🐛 New bug report: {{1.answers[0].text}} ({{1.answers[1].choice.label}}) — {{2.url}}' }),
  ],
},
{
  name: 'Churn Risk Detection — Usage Drop → Save Campaign',
  category: 'Customer Support',
  description: 'Monitor customer usage data. When usage drops significantly, trigger a save campaign with personalized outreach.',
  tags: ['Webhook', 'OpenAI', 'Gmail', 'Slack', 'Datastore'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'datastore:searchRecords', 300, { key: '{{1.body.customer_id}}' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Customer usage dropped from {{2.data.prev_usage}} to {{1.body.current_usage}}. Account: {{2.data.plan}}, tenure: {{2.data.months}}mo. Write a personalized retention email.' }] }),
    m(4, 'gmail:sendEmail', 900, { to: '{{2.data.email}}', subject: 'We noticed you\'ve been quiet — can we help?', content: '{{3.choices[0].message.content}}' }),
    m(5, 'slack:sendMessage', 1200, { channel: '#cs-churn', text: '⚠️ Churn risk: {{2.data.company}} — usage down {{1.body.drop_percentage}}%. Save email sent.' }),
    m(6, 'datastore:updateRecord', 1500, { key: '{{1.body.customer_id}}', data: { churn_risk: true, last_outreach: '{{now}}' } }),
  ],
},
{
  name: 'Knowledge Base Auto-Update — Resolved Tickets → Docs',
  category: 'Customer Support',
  description: 'When tickets are resolved, use AI to determine if the solution should become a KB article.',
  tags: ['Webhook', 'OpenAI', 'Notion', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Should this resolved ticket become a KB article? Issue: {{1.body.subject}}, Resolution: {{1.body.resolution}}. Return JSON: {should_publish, title, article_content}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'notion:createPage', 1200, { databaseId: '{{KB_DB}}', properties: { Title: '{{3.title}}', Status: 'Draft' }, content: '{{3.article_content}}' }),
    m(6, 'slack:sendMessage', 1500, { channel: '#support', text: '📚 New KB article drafted: "{{3.title}}" — please review' }),
  ],
},
{
  name: 'Follow-Up Survey Sender — Post Resolution',
  category: 'Customer Support',
  description: 'Send a follow-up satisfaction survey 24 hours after a ticket is resolved.',
  tags: ['Webhook', 'SendGrid', 'Google Sheets'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:sleep', 300, { delay: 86400 }),
    m(3, 'sendgrid:sendEmail', 600, { to: '{{1.body.customer_email}}', subject: 'How did we do? Quick feedback on ticket #{{1.body.ticket_id}}', content: 'We hope your issue is resolved. Please rate your experience: {{SURVEY_URL}}?ticket={{1.body.ticket_id}}' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{SURVEY_LOG}}', values: ['{{1.body.ticket_id}}', '{{1.body.customer_email}}', 'sent', '{{now}}'] }),
  ],
},
{
  name: 'VIP Customer Routing — Priority Queue',
  category: 'Customer Support',
  description: 'Identify VIP customers from a datastore and route their tickets to the priority support queue.',
  tags: ['Webhook', 'Datastore', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'datastore:searchRecords', 300, { key: '{{1.body.customer_email}}' }),
    m(3, 'flow-control:router', 600),
    m(4, 'slack:sendMessage', 900, { channel: '#vip-support', text: '⭐ VIP ticket from {{1.body.customer_email}} ({{2.data.plan}}): {{1.body.subject}}' }),
    m(5, 'slack:sendMessage', 900, { channel: '#support-queue', text: '📩 New ticket from {{1.body.customer_email}}: {{1.body.subject}}' }),
  ],
},
{
  name: 'Multi-Channel Merge — Email + Chat → Unified View',
  category: 'Customer Support',
  description: 'Merge support messages from email and chat into a unified record per customer.',
  tags: ['Gmail', 'Slack', 'Datastore', 'Airtable'],
  trigger_type: 'Event',
  flow: [
    m(1, 'gmail:watchEmails', 0, { label: 'support' }),
    m(2, 'datastore:searchRecords', 300, { key: '{{1.from}}' }),
    m(3, 'flow-control:router', 600),
    m(4, 'datastore:addRecord', 900, { key: '{{1.from}}', data: { messages: [{ channel: 'email', subject: '{{1.subject}}', date: '{{now}}' }] } }),
    m(5, 'datastore:updateRecord', 900, { key: '{{1.from}}', data: { messages: '{{append(2.data.messages, {channel: "email", subject: "{{1.subject}}", date: "{{now}}"})}}' } }),
    m(6, 'airtable:createRecord', 1200, { baseId: '{{AIRTABLE_BASE}}', tableId: '{{SUPPORT_TABLE}}', fields: { Email: '{{1.from}}', Subject: '{{1.subject}}', Channel: 'email', Date: '{{now}}' } }),
  ],
},

// ═══ HR & PEOPLE (8) ═════════════════════════════════════════════════════════
{
  name: 'Employee Onboarding — New Hire Setup Automation',
  category: 'HR & People',
  description: 'When a new hire is added, create their accounts, add to Slack channels, and schedule orientation.',
  tags: ['Google Sheets', 'Slack', 'Gmail', 'Google Calendar'],
  trigger_type: 'Event',
  flow: [
    m(1, 'google-sheets:watchRows', 0, { spreadsheetId: '{{HIRES_SHEET}}' }),
    m(2, 'slack:sendMessage', 300, { channel: '#general', text: '🎉 Welcome {{1.name}} to the team! They\'re joining as {{1.role}} in {{1.department}}.' }),
    m(3, 'gmail:sendEmail', 600, { to: '{{1.personal_email}}', subject: 'Welcome to the team, {{1.name}}!', content: 'Your start date is {{1.start_date}}. Please complete the onboarding form: {{ONBOARDING_URL}}' }),
    m(4, 'google-calendar:createEvent', 900, { summary: 'Orientation: {{1.name}}', start: '{{1.start_date}}T09:00:00', end: '{{1.start_date}}T12:00:00', attendees: ['{{1.email}}', '{{1.manager_email}}'] }),
  ],
},
{
  name: 'Leave Request Workflow — Submit → Approve → Calendar',
  category: 'HR & People',
  description: 'Process leave requests: route to manager, track in sheets, and add approved leave to the team calendar.',
  tags: ['Jotform', 'Slack', 'Google Sheets', 'Google Calendar'],
  trigger_type: 'Event',
  flow: [
    m(1, 'jotform:watchSubmissions', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{LEAVE_SHEET}}', values: ['{{1.employee}}', '{{1.start_date}}', '{{1.end_date}}', '{{1.type}}', 'pending'] }),
    m(3, 'slack:sendMessage', 600, { channel: '@{{1.manager_slack}}', text: 'Leave request from {{1.employee}}: {{1.type}} from {{1.start_date}} to {{1.end_date}}. React ✅ to approve.' }),
    m(4, 'google-calendar:createEvent', 900, { summary: '🌴 {{1.employee}} — {{1.type}}', start: '{{1.start_date}}', end: '{{1.end_date}}', description: 'Pending approval' }),
  ],
},
{
  name: 'Birthday & Anniversary Bot — Auto Celebrations',
  category: 'HR & People',
  description: 'Check for upcoming birthdays and work anniversaries, then post celebrations in Slack.',
  tags: ['Google Sheets', 'Slack', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{EMPLOYEES_SHEET}}' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#general', text: '🎂 Happy Birthday {{3.name}}! 🎉' }),
    m(6, 'slack:sendMessage', 1200, { channel: '#general', text: '🏆 Congrats {{3.name}} on {{3.years}} years with us! 🎊' }),
    m(7, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'Time Tracking Digest — Weekly Hours Summary',
  category: 'HR & People',
  description: 'Aggregate weekly time entries from Google Sheets, flag anomalies, and send summaries to managers.',
  tags: ['Google Sheets', 'OpenAI', 'Gmail', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 604800 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{TIMESHEET}}' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Summarize weekly timesheet. Flag anyone under 30h or over 50h: {{json(2.rows)}}. Return a clean summary.' }] }),
    m(4, 'gmail:sendEmail', 900, { to: '{{HR_MANAGER_EMAIL}}', subject: 'Weekly Timesheet Summary', content: '{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Performance Review Cycle — Schedule + Collect + Compile',
  category: 'HR & People',
  description: 'Kick off performance review cycles: send forms, collect responses, and compile summaries for managers.',
  tags: ['Google Sheets', 'Gmail', 'OpenAI', 'Iterator'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 7776000 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{EMPLOYEES_SHEET}}' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'gmail:sendEmail', 900, { to: '{{3.email}}', subject: 'Performance Review Time', content: 'Please complete your self-review by {{addDays(now, 14)}}. Link: {{REVIEW_FORM_URL}}?employee={{3.id}}' }),
    m(5, 'flow-control:aggregator', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#hr', text: '📋 Performance review cycle started. {{2.rows.length}} forms sent.' }),
  ],
},
{
  name: 'Applicant Screening — Resume → AI Score → Notify',
  category: 'HR & People',
  description: 'Screen job applicants with AI: parse resume data, score fit, and notify hiring managers.',
  tags: ['Gmail', 'OpenAI', 'Google Sheets', 'Slack'],
  trigger_type: 'Event',
  flow: [
    m(1, 'gmail:watchEmails', 0, { label: 'applications' }),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Score this job applicant 1-10 for fit. Email: {{1.text}}. Return JSON: {score, strengths, concerns, recommendation}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{APPLICANTS_SHEET}}', values: ['{{1.from}}', '{{3.score}}', '{{3.recommendation}}', '{{3.strengths}}', '{{now}}'] }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#hiring', text: '⭐ Strong candidate ({{3.score}}/10): {{1.from}} — {{3.recommendation}}' }),
  ],
},
{
  name: 'Offboarding Checklist — Exit Process Automation',
  category: 'HR & People',
  description: 'When an employee exits, trigger the offboarding checklist: revoke access, schedule exit interview, notify IT.',
  tags: ['Webhook', 'Slack', 'Gmail', 'Google Calendar'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'slack:sendMessage', 300, { channel: '#it-ops', text: '🔒 Offboarding: Revoke access for {{1.body.employee_name}} ({{1.body.email}}) by {{1.body.last_day}}' }),
    m(3, 'gmail:sendEmail', 600, { to: '{{1.body.email}}', subject: 'Offboarding Details', content: 'Your last day is {{1.body.last_day}}. Please return equipment and complete the exit survey: {{EXIT_SURVEY_URL}}' }),
    m(4, 'google-calendar:createEvent', 900, { summary: 'Exit Interview: {{1.body.employee_name}}', start: '{{1.body.last_day}}T14:00:00', end: '{{1.body.last_day}}T15:00:00', attendees: ['{{1.body.email}}', '{{HR_EMAIL}}'] }),
  ],
},
{
  name: 'Employee Feedback Collection — Anonymous Survey Bot',
  category: 'HR & People',
  description: 'Send monthly anonymous pulse surveys, collect responses, and generate AI insight summaries.',
  tags: ['Scheduled', 'SendGrid', 'Google Sheets', 'OpenAI'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 2592000 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{EMPLOYEES_SHEET}}' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'sendgrid:sendEmail', 900, { to: '{{3.email}}', subject: 'Monthly Pulse Survey — Your Voice Matters', content: 'Share your anonymous feedback: {{PULSE_URL}}' }),
    m(5, 'flow-control:aggregator', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#hr', text: '📩 Monthly pulse survey sent to {{2.rows.length}} employees.' }),
  ],
},

// ═══ DEVOPS (8) ═══════════════════════════════════════════════════════════════
{
  name: 'GitHub PR Notifications → Slack Team Channel',
  category: 'DevOps',
  description: 'Post GitHub PR events (opened, merged, reviewed) to the relevant Slack engineering channel.',
  tags: ['GitHub', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:router', 300),
    m(3, 'slack:sendMessage', 600, { channel: '#pr-reviews', text: '🔍 PR opened: {{1.body.pull_request.title}} by {{1.body.pull_request.user.login}} — {{1.body.pull_request.html_url}}' }),
    m(4, 'slack:sendMessage', 600, { channel: '#deployments', text: '✅ PR merged: {{1.body.pull_request.title}} into {{1.body.pull_request.base.ref}}' }),
    m(5, 'slack:sendMessage', 600, { channel: '#pr-reviews', text: '💬 PR review: {{1.body.review.state}} on {{1.body.pull_request.title}} by {{1.body.review.user.login}}' }),
  ],
},
{
  name: 'Error Alert Pipeline — Sentry → Slack + Notion Ticket',
  category: 'DevOps',
  description: 'When Sentry reports an error, post to Slack and auto-create a bug ticket in Notion.',
  tags: ['Webhook', 'Slack', 'Notion'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'slack:sendMessage', 300, { channel: '#alerts', text: '🚨 Error: {{1.body.event.title}} in {{1.body.project.slug}} ({{1.body.event.environment}})' }),
    m(3, 'notion:createPage', 600, { databaseId: '{{BUGS_DB}}', properties: { Title: '{{1.body.event.title}}', Priority: 'High', Environment: '{{1.body.event.environment}}', Status: 'Open' } }),
  ],
},
{
  name: 'Deploy Tracker — CI/CD Events → Log + Notify',
  category: 'DevOps',
  description: 'Track deployments from CI/CD webhooks, log them in Google Sheets, and notify the team.',
  tags: ['Webhook', 'Google Sheets', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{DEPLOY_LOG}}', values: ['{{1.body.repo}}', '{{1.body.branch}}', '{{1.body.commit_sha}}', '{{1.body.environment}}', '{{1.body.status}}', '{{now}}'] }),
    m(3, 'slack:sendMessage', 600, { channel: '#deployments', text: '🚀 Deploy {{1.body.status}}: {{1.body.repo}} ({{1.body.branch}}) → {{1.body.environment}} — {{1.body.commit_sha}}' }),
  ],
},
{
  name: 'Vulnerability Scanner → Ticket Creation + Alert',
  category: 'DevOps',
  description: 'Process vulnerability scan results, create tickets for critical findings, and alert security team.',
  tags: ['Webhook', 'Notion', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:iterator', 300, { array: '{{1.body.vulnerabilities}}' }),
    m(3, 'flow-control:router', 600),
    m(4, 'notion:createPage', 900, { databaseId: '{{SECURITY_DB}}', properties: { Title: '{{2.title}}', Severity: '{{2.severity}}', Package: '{{2.package}}', Status: 'Open' } }),
    m(5, 'slack:sendMessage', 1200, { channel: '#security', text: '🔴 Critical vulnerability: {{2.title}} in {{2.package}} (CVSS: {{2.cvss}})' }),
    m(6, 'flow-control:aggregator', 1500),
  ],
},
{
  name: 'Cron Job Monitor — Health Check + Failure Alerts',
  category: 'DevOps',
  description: 'Ping health check endpoints periodically. Alert Slack and create incident if any fail.',
  tags: ['HTTP', 'Slack', 'Datastore', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 300 }),
    m(2, 'http:makeRequest', 300, { url: '{{HEALTHCHECK_URL}}', method: 'GET' }),
    m(3, 'flow-control:router', 600),
    m(4, 'datastore:updateRecord', 900, { key: 'healthcheck', data: { status: 'healthy', last_check: '{{now}}' } }),
    m(5, 'slack:sendMessage', 900, { channel: '#alerts', text: '🚨 HEALTH CHECK FAILED: {{HEALTHCHECK_URL}} returned {{2.statusCode}}' }),
    m(6, 'datastore:updateRecord', 1200, { key: 'healthcheck', data: { status: 'down', last_failure: '{{now}}' } }),
  ],
},
{
  name: 'Release Notes Generator — Git Tags → AI Summary → Slack',
  category: 'DevOps',
  description: 'When a new release tag is pushed, generate AI release notes from commit messages and post to Slack.',
  tags: ['Webhook', 'OpenAI', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Generate clean release notes from these commits: {{json(1.body.commits)}}. Group by: Features, Fixes, Other. Tag: {{1.body.tag}}' }] }),
    m(3, 'slack:sendMessage', 600, { channel: '#releases', text: '📦 Release {{1.body.tag}}:\n{{2.choices[0].message.content}}' }),
    m(4, 'notion:createPage', 900, { databaseId: '{{RELEASES_DB}}', properties: { Title: 'Release {{1.body.tag}}' }, content: '{{2.choices[0].message.content}}' }),
  ],
},
{
  name: 'Cloud Cost Alert — Daily Spend Monitoring',
  category: 'DevOps',
  description: 'Check cloud spending daily via API, compare to budget, and alert if thresholds are exceeded.',
  tags: ['HTTP', 'Datastore', 'Slack', 'Router'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'http:makeRequest', 300, { url: '{{CLOUD_BILLING_API}}', method: 'GET', headers: { Authorization: 'Bearer {{CLOUD_API_KEY}}' } }),
    m(3, 'json:parseJSON', 600, { value: '{{2.body}}' }),
    m(4, 'datastore:addRecord', 900, { key: 'cloud_cost_{{formatDate(now, "YYYY-MM-DD")}}', data: { total: '{{3.total}}', services: '{{json(3.breakdown)}}' } }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#infra', text: '💰 Cloud cost alert: ${{3.total}} today — {{3.percentage}}% of monthly budget' }),
  ],
},
{
  name: 'CI/CD Failure Handler — Retry + Escalate',
  category: 'DevOps',
  description: 'When a CI/CD pipeline fails, attempt auto-retry. If retry fails, escalate to the responsible engineer.',
  tags: ['Webhook', 'HTTP', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'http:makeRequest', 300, { url: '{{CI_API}}/pipelines/{{1.body.pipeline_id}}/retry', method: 'POST' }),
    m(3, 'flow-control:router', 600),
    m(4, 'slack:sendMessage', 900, { channel: '#ci-cd', text: '🔄 CI/CD auto-retried: {{1.body.pipeline_name}} — {{2.statusCode === 200 ? "retry triggered" : "retry failed"}}' }),
    m(5, 'slack:sendMessage', 900, { channel: '@{{1.body.author}}', text: '❌ CI/CD pipeline {{1.body.pipeline_name}} failed and auto-retry failed. Please investigate: {{1.body.url}}' }),
  ],
},

// ═══ CONTENT & CREATIVE (8) ═════════════════════════════════════════════════
{
  name: 'AI Content Brief Generator — Topic → Research → Brief',
  category: 'Content & Creative',
  description: 'Generate comprehensive content briefs with AI: research topic, outline structure, suggest keywords.',
  tags: ['Webhook', 'OpenAI', 'Notion', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Create a content brief for: {{1.body.topic}}. Target audience: {{1.body.audience}}. Include: outline, keywords, competitor angles, word count, CTA suggestions.' }] }),
    m(3, 'notion:createPage', 600, { databaseId: '{{CONTENT_DB}}', properties: { Title: '{{1.body.topic}}', Status: 'Brief Ready', Type: '{{1.body.content_type}}' }, content: '{{2.choices[0].message.content}}' }),
    m(4, 'slack:sendMessage', 900, { channel: '#content', text: '📝 Content brief ready: "{{1.body.topic}}" — {{3.url}}' }),
  ],
},
{
  name: 'Video Transcription → Summary + Blog Draft',
  category: 'Content & Creative',
  description: 'Transcribe video audio with OpenAI Whisper, summarize key points, and draft a blog post.',
  tags: ['Webhook', 'OpenAI', 'Notion'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createTranscription', 300, { file: '{{1.body.audio_url}}', model: 'whisper-1' }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'From this video transcript, create: 1) Key takeaways 2) Blog post draft 3) Social media snippets. Transcript: {{2.text}}' }] }),
    m(4, 'notion:createPage', 900, { databaseId: '{{CONTENT_DB}}', properties: { Title: '{{1.body.video_title}} — Repurposed', Status: 'Draft' }, content: '{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Podcast Distribution — New Episode → Multi-Platform Post',
  category: 'Content & Creative',
  description: 'When a new podcast episode publishes, create social posts, email subscribers, and update the website.',
  tags: ['Webhook', 'OpenAI', 'SendGrid', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Create promotion content for podcast episode: "{{1.body.title}}" — {{1.body.description}}. Generate: tweet, LinkedIn post, email subject+body, show notes.' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'sendgrid:sendEmail', 900, { to: '{{PODCAST_LIST}}', subject: '{{3.email_subject}}', content: '{{3.email_body}}' }),
    m(5, 'slack:sendMessage', 1200, { channel: '#marketing', text: '🎙️ New episode live: "{{1.body.title}}" — promotion content ready for distribution' }),
  ],
},
{
  name: 'Image Review Pipeline — Upload → AI Analysis → Approve',
  category: 'Content & Creative',
  description: 'Review uploaded images with AI for brand compliance, quality, and content appropriateness.',
  tags: ['Webhook', 'OpenAI', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Review this image for brand compliance. URL: {{1.body.image_url}}. Check: quality, brand colors, text readability, appropriateness. Return JSON: {approved, issues, score}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'slack:sendMessage', 1200, { channel: '#design', text: '✅ Image approved ({{3.score}}/10): {{1.body.image_url}}' }),
    m(6, 'slack:sendMessage', 1200, { channel: '#design', text: '❌ Image rejected: {{1.body.image_url}} — Issues: {{json(3.issues)}}' }),
  ],
},
{
  name: 'Content Repurposing — Blog → Social + Email + Slides',
  category: 'Content & Creative',
  description: 'Take a blog post and repurpose it into social media posts, email content, and presentation slides.',
  tags: ['Webhook', 'OpenAI', 'Google Docs', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Repurpose this blog post into: 5 tweets, 2 LinkedIn posts, 1 email newsletter section, and slide outline. Blog: {{1.body.content}}' }] }),
    m(3, 'google-docs:createDocument', 600, { title: 'Repurposed: {{1.body.title}}', content: '{{2.choices[0].message.content}}' }),
    m(4, 'slack:sendMessage', 900, { channel: '#content', text: '♻️ Content repurposed: "{{1.body.title}}" — Doc: {{3.documentId}}' }),
  ],
},
{
  name: 'Editorial Calendar Manager — Notion → Reminders',
  category: 'Content & Creative',
  description: 'Check the editorial calendar daily and send reminders for upcoming deadlines.',
  tags: ['Notion', 'Slack', 'Scheduled', 'Iterator'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'notion:queryDatabase', 300, { databaseId: '{{EDITORIAL_DB}}', filter: { property: 'Due Date', date: { on_or_before: '{{addDays(now, 3)}}' } } }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.results}}' }),
    m(4, 'slack:sendMessage', 900, { channel: '#content', text: '⏰ Content due soon: "{{3.properties.Title.title[0].text.content}}" — {{3.properties.Due Date.date.start}} (assigned: {{3.properties.Author.people[0].name}})' }),
    m(5, 'flow-control:aggregator', 1200),
  ],
},
{
  name: 'UGC Moderation — AI Content Review + Flag',
  category: 'Content & Creative',
  description: 'Moderate user-generated content with AI. Auto-approve clean content, flag questionable items for review.',
  tags: ['Webhook', 'OpenAI', 'Datastore', 'Slack', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Moderate this user content for: spam, profanity, hate speech, violence, personal info. Content: "{{1.body.content}}". Return JSON: {safe, flags, confidence}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'flow-control:router', 900),
    m(5, 'datastore:updateRecord', 1200, { key: '{{1.body.content_id}}', data: { status: 'approved', moderated_at: '{{now}}' } }),
    m(6, 'slack:sendMessage', 1200, { channel: '#moderation', text: '🚩 Content flagged: {{1.body.content_id}} — Flags: {{json(3.flags)}} (confidence: {{3.confidence}})' }),
    m(7, 'datastore:updateRecord', 1500, { key: '{{1.body.content_id}}', data: { status: 'flagged', flags: '{{json(3.flags)}}' } }),
  ],
},
{
  name: 'SEO Gap Analysis — Competitor Check + Report',
  category: 'Content & Creative',
  description: 'Weekly competitor keyword analysis: pull data, compare gaps with AI, and generate content opportunities.',
  tags: ['HTTP', 'OpenAI', 'Google Sheets', 'Slack'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 604800 }),
    m(2, 'http:makeRequest', 300, { url: '{{SEO_API}}/competitors', method: 'GET', headers: { Authorization: 'Bearer {{SEO_KEY}}' } }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze SEO gaps vs competitors: {{2.body}}. Identify top 10 content opportunities with estimated traffic potential.' }] }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{SEO_SHEET}}', values: ['{{formatDate(now, "YYYY-MM-DD")}}', '{{3.choices[0].message.content}}'] }),
    m(5, 'slack:sendMessage', 1200, { channel: '#content', text: '🔍 Weekly SEO Gap Analysis:\n{{3.choices[0].message.content}}' }),
  ],
},

// ═══ E-COMMERCE (8) ═══════════════════════════════════════════════════════════
{
  name: 'Order Fulfillment Pipeline — Shopify → Process → Notify',
  category: 'E-commerce',
  description: 'Process new Shopify orders: validate, log in sheets, and notify the fulfillment team.',
  tags: ['Shopify', 'Google Sheets', 'Slack'],
  trigger_type: 'Event',
  flow: [
    m(1, 'shopify:watchOrders', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{ORDERS_SHEET}}', values: ['{{1.order_number}}', '{{1.customer.email}}', '{{1.total_price}}', '{{1.shipping_address.city}}', 'pending', '{{now}}'] }),
    m(3, 'slack:sendMessage', 600, { channel: '#fulfillment', text: '📦 New order #{{1.order_number}}: {{1.line_items.length}} items, ${{1.total_price}} → {{1.shipping_address.city}}' }),
  ],
},
{
  name: 'Abandoned Cart Recovery — AI Personalized Email',
  category: 'E-commerce',
  description: 'When a cart is abandoned, wait 2 hours, then send an AI-personalized recovery email with incentive.',
  tags: ['Webhook', 'OpenAI', 'SendGrid'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'flow-control:sleep', 300, { delay: 7200 }),
    m(3, 'openai:createChatCompletion', 600, { model: 'gpt-4', messages: [{ role: 'user', content: 'Write a friendly cart recovery email for: {{1.body.customer_name}} who left {{1.body.items}} in cart (total: ${{1.body.total}}). Include 10% discount code: COMEBACK10' }] }),
    m(4, 'sendgrid:sendEmail', 900, { to: '{{1.body.customer_email}}', subject: 'You left something behind!', content: '{{3.choices[0].message.content}}' }),
  ],
},
{
  name: 'Product Review Manager — Collect + Analyze + Respond',
  category: 'E-commerce',
  description: 'Collect product reviews, analyze sentiment with AI, and auto-generate response drafts.',
  tags: ['Webhook', 'OpenAI', 'Google Sheets', 'Router'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'openai:createChatCompletion', 300, { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze this product review and draft a response. Rating: {{1.body.rating}}/5, Review: "{{1.body.review_text}}". Return JSON: {sentiment, response, needs_escalation}' }] }),
    m(3, 'json:parseJSON', 600, { value: '{{2.choices[0].message.content}}' }),
    m(4, 'google-sheets:addRow', 900, { spreadsheetId: '{{REVIEWS_SHEET}}', values: ['{{1.body.product}}', '{{1.body.rating}}', '{{3.sentiment}}', '{{1.body.review_text}}', '{{now}}'] }),
    m(5, 'flow-control:router', 1200),
    m(6, 'slack:sendMessage', 1500, { channel: '#reviews', text: '⚠️ Negative review needs attention: {{1.body.product}} — {{1.body.rating}}/5' }),
  ],
},
{
  name: 'Inventory Reorder Automation — Low Stock → PO + Alert',
  category: 'E-commerce',
  description: 'Monitor inventory levels. Auto-generate purchase orders when stock drops below reorder points.',
  tags: ['Google Sheets', 'Gmail', 'Slack', 'Iterator'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 3600 }),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{INVENTORY_SHEET}}', filter: 'quantity <= reorder_point' }),
    m(3, 'flow-control:iterator', 600, { array: '{{2.rows}}' }),
    m(4, 'gmail:sendEmail', 900, { to: '{{3.supplier_email}}', subject: 'Purchase Order: {{3.sku}}', content: 'Please ship {{3.reorder_qty}} units of {{3.product_name}} (SKU: {{3.sku}}).' }),
    m(5, 'google-sheets:updateRow', 1200, { spreadsheetId: '{{INVENTORY_SHEET}}', rowNumber: '{{3.__rowNumber}}', values: { po_status: 'ordered', po_date: '{{now}}' } }),
    m(6, 'flow-control:aggregator', 1500),
    m(7, 'slack:sendMessage', 1800, { channel: '#inventory', text: '📋 Reorder batch complete: {{2.rows.length}} POs generated' }),
  ],
},
{
  name: 'Refund Processing — Request → Validate → Process',
  category: 'E-commerce',
  description: 'Process refund requests: validate the order, process via Stripe, and update records.',
  tags: ['Webhook', 'Stripe', 'Google Sheets', 'Slack'],
  trigger_type: 'Webhook',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'google-sheets:searchRows', 300, { spreadsheetId: '{{ORDERS_SHEET}}', filter: 'order_id = "{{1.body.order_id}}"' }),
    m(3, 'stripe:createCharge', 600, { amount: '-{{2.rows[0].amount}}', customer: '{{2.rows[0].stripe_customer}}', description: 'Refund for order {{1.body.order_id}}' }),
    m(4, 'google-sheets:updateRow', 900, { spreadsheetId: '{{ORDERS_SHEET}}', rowNumber: '{{2.rows[0].__rowNumber}}', values: { status: 'refunded', refund_date: '{{now}}' } }),
    m(5, 'slack:sendMessage', 1200, { channel: '#orders', text: '💸 Refund processed: Order #{{1.body.order_id}} — ${{2.rows[0].amount}} to {{2.rows[0].customer_email}}' }),
  ],
},
{
  name: 'Competitor Price Monitor — Scrape + Compare + Alert',
  category: 'E-commerce',
  description: 'Check competitor prices daily, compare to your catalog, and alert on significant differences.',
  tags: ['HTTP', 'Google Sheets', 'Slack', 'Scheduled'],
  trigger_type: 'Schedule',
  flow: [
    m(1, 'schedule:interval', 0, { interval: 86400 }),
    m(2, 'http:makeRequest', 300, { url: '{{PRICE_API}}/competitors', method: 'GET' }),
    m(3, 'google-sheets:searchRows', 600, { spreadsheetId: '{{CATALOG_SHEET}}' }),
    m(4, 'openai:createChatCompletion', 900, { model: 'gpt-4', messages: [{ role: 'user', content: 'Compare our prices: {{json(3.rows)}} vs competitors: {{2.body}}. Flag items where competitor is 10%+ cheaper. Return JSON array of alerts.' }] }),
    m(5, 'slack:sendMessage', 1200, { channel: '#pricing', text: '🏷️ Daily Price Alert:\n{{4.choices[0].message.content}}' }),
  ],
},
{
  name: 'Product Syndication — New Product → Multi-Channel Publish',
  category: 'E-commerce',
  description: 'When a new product is added, syndicate the listing to multiple sales channels simultaneously.',
  tags: ['Shopify', 'Google Sheets', 'Slack'],
  trigger_type: 'Event',
  flow: [
    m(1, 'webhook:customWebhook', 0),
    m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{PRODUCTS_SHEET}}', values: ['{{1.body.sku}}', '{{1.body.title}}', '{{1.body.price}}', '{{1.body.description}}', '{{now}}'] }),
    m(3, 'http:makeRequest', 600, { url: '{{AMAZON_API}}/products', method: 'POST', body: { sku: '{{1.body.sku}}', title: '{{1.body.title}}', price: '{{1.body.price}}' } }),
    m(4, 'http:makeRequest', 900, { url: '{{EBAY_API}}/items', method: 'POST', body: { sku: '{{1.body.sku}}', title: '{{1.body.title}}', price: '{{1.body.price}}' } }),
    m(5, 'slack:sendMessage', 1200, { channel: '#products', text: '🆕 Product syndicated: {{1.body.title}} ({{1.body.sku}}) → Shopify, Amazon, eBay' }),
  ],
},
{
  name: 'Loyalty Rewards Calculator — Purchase → Points + Notify',
  category: 'E-commerce',
  description: 'Calculate loyalty points for purchases, update the customer record, and notify about rewards earned.',
  tags: ['Stripe', 'Datastore', 'SendGrid'],
  trigger_type: 'Event',
  flow: [
    m(1, 'stripe:watchEvents', 0, { events: ['charge.succeeded'] }),
    m(2, 'datastore:searchRecords', 300, { key: '{{1.data.object.receipt_email}}' }),
    m(3, 'tools:setVariable', 600, { name: 'new_points', value: '{{multiply(divide(1.data.object.amount, 100), 10)}}' }),
    m(4, 'datastore:updateRecord', 900, { key: '{{1.data.object.receipt_email}}', data: { points: '{{add(2.data.points, 3.new_points)}}', last_purchase: '{{now}}' } }),
    m(5, 'sendgrid:sendEmail', 1200, { to: '{{1.data.object.receipt_email}}', subject: 'You earned {{3.new_points}} points!', content: 'Thanks for your purchase! You earned {{3.new_points}} points. Total: {{add(2.data.points, 3.new_points)}} points.' }),
  ],
},

];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ManageAI — Make.com Template Seeder v2');
  console.log(`  Templates to seed: ${TEMPLATES.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Clear existing v2 seed records only
  const { error: delErr, count: delCount } = await supabase
    .from('templates')
    .delete({ count: 'exact' })
    .eq('source', SOURCE);
  if (delErr) {
    console.warn(`Warning — could not clear existing records: ${delErr.message}`);
  } else {
    console.log(`Cleared ${delCount ?? 0} existing v2 seed records`);
  }

  // Build DB rows
  const rows = TEMPLATES.map((t) => ({
    name: t.name,
    platform: 'make' as const,
    category: t.category,
    description: t.description,
    node_count: t.flow.length,
    tags: t.tags,
    complexity: t.flow.length <= 3 ? 'Beginner' : t.flow.length <= 7 ? 'Intermediate' : 'Advanced',
    trigger_type: t.trigger_type,
    json_template: {
      name: t.name,
      flow: t.flow,
      metadata: {
        version: 1,
        instant: t.trigger_type === 'Webhook',
        scenario: {
          roundtrips: 1,
          maxErrors: 3,
          autoCommit: true,
          autoCommitTriggerLast: true,
          sequential: false,
          confidential: false,
          dataloss: false,
        },
        designer: { orphans: [] },
      },
    },
    source: SOURCE,
    source_repo: 'seed:manageai/make-templates-v2',
    source_filename: `make/${t.category.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}/${t.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`,
  }));

  // Insert in batches with retry
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    let ok = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.from('templates').insert(batch);
      if (!error) {
        inserted += batch.length;
        console.log(`  Batch ${batchNum}: inserted ${batch.length} templates`);
        ok = true;
        break;
      }
      console.warn(`  Batch ${batchNum} attempt ${attempt} failed: ${error.message}`);
      if (attempt < 3) await sleep(2000 * attempt);
    }
    if (!ok) errors++;
    // Small pause between batches
    await sleep(500);
  }

  // Final count
  const { count: total } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'make');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Inserted: ${inserted}/${rows.length}`);
  console.log(`  Batch errors: ${errors}`);
  console.log(`  Total Make.com templates in DB: ${total ?? 0}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Category breakdown
  const cats: Record<string, number> = {};
  for (const r of rows) cats[r.category] = (cats[r.category] ?? 0) + 1;
  console.log('Category breakdown:');
  for (const [cat, count] of Object.entries(cats).sort()) {
    console.log(`  ${cat.padEnd(25)} ${count}`);
  }

  // Quality checks
  const routerCount = TEMPLATES.filter(t => t.flow.some(f => f.module === 'flow-control:router')).length;
  const iteratorCount = TEMPLATES.filter(t => t.flow.some(f => f.module === 'flow-control:iterator')).length;
  const datastoreCount = TEMPLATES.filter(t => t.flow.some(f => f.module.startsWith('datastore:'))).length;
  console.log('\nQuality checks:');
  console.log(`  Router templates:    ${routerCount} (need 10+)`);
  console.log(`  Iterator templates:  ${iteratorCount} (need 5+)`);
  console.log(`  Datastore templates: ${datastoreCount} (need 5+)`);

  if (inserted < 80) {
    console.error('\n❌ FAILED: Less than 80 templates inserted!');
    process.exit(1);
  }
  if (errors > 0) {
    console.error('\n❌ FAILED: There were batch errors!');
    process.exit(1);
  }
  console.log('\n✅ SUCCESS: All templates seeded!');
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(1); });
