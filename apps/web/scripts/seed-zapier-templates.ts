#!/usr/bin/env tsx
/**
 * Seed Zapier (platform: "zapier") templates into Supabase `templates` table.
 * Rich format with detailed step configs, output fields, and setup instructions.
 *
 * Usage (from apps/web/):
 *   npx tsx scripts/seed-zapier-templates.ts
 */

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SOURCE = 'seed:zapier-templates';
const BATCH_SIZE = 50;

// ── Types ─────────────────────────────────────────────────────────────────────
type ZapStep = {
  position: number;
  type: 'trigger' | 'action';
  app: string;
  app_display_name: string;
  event: string;
  event_description: string;
  config: Record<string, unknown>;
  output_fields: string[];
  setup_instructions: string;
  input_mapping?: Record<string, string>;
};

type SeedTemplate = {
  name: string;
  category: string;
  description: string;
  tags: string[];
  trigger_type: string;
  plan: string;
  premium: string[];
  accounts: string[];
  steps: ZapStep[];
};

// ── Helper functions ──────────────────────────────────────────────────────────
// Trigger
const T = (app: string, dn: string, ev: string, ed: string, cfg: Record<string, unknown> = {}, out: string[] = []): ZapStep =>
  ({ position: 1, type: 'trigger', app, app_display_name: dn, event: ev, event_description: ed, config: cfg, output_fields: out, setup_instructions: `1. Connect ${dn}\n2. Configure ${ev} trigger` });

// Action
const A = (pos: number, app: string, dn: string, ev: string, ed: string, cfg: Record<string, unknown> = {}, out: string[] = [], map?: Record<string, string>): ZapStep =>
  ({ position: pos, type: 'action', app, app_display_name: dn, event: ev, event_description: ed, config: cfg, output_fields: out, setup_instructions: `1. Connect ${dn}\n2. Configure ${ev}`, ...(map ? { input_mapping: map } : {}) });

// Filter
const F = (pos: number, cond: string): ZapStep =>
  ({ position: pos, type: 'action', app: 'filter', app_display_name: 'Filter by Zapier', event: 'Only Continue If', event_description: `Filter: ${cond}`, config: { condition: cond }, output_fields: ['continues'], setup_instructions: `1. Set condition: ${cond}` });

// Formatter
const FM = (pos: number, transform: string, input: string): ZapStep =>
  ({ position: pos, type: 'action', app: 'formatter', app_display_name: 'Formatter by Zapier', event: `Text - ${transform}`, event_description: `Format text: ${transform}`, config: { transform, input }, output_fields: ['output'], setup_instructions: `1. Select ${transform}\n2. Map input field` });

// Paths
const P = (pos: number, pathNames: string[]): ZapStep =>
  ({ position: pos, type: 'action', app: 'paths', app_display_name: 'Paths by Zapier', event: 'Route', event_description: `Branch: ${pathNames.join(', ')}`, config: { paths: pathNames }, output_fields: pathNames, setup_instructions: `Set up ${pathNames.length} conditional paths: ${pathNames.join(', ')}` });

// Code
const C = (pos: number, desc: string, lang = 'javascript'): ZapStep =>
  ({ position: pos, type: 'action', app: 'code', app_display_name: 'Code by Zapier', event: `Run ${lang}`, event_description: desc, config: { language: lang }, output_fields: ['output'], setup_instructions: `1. Write ${lang} code\n2. ${desc}` });

// Delay
const D = (pos: number, dur: string): ZapStep =>
  ({ position: pos, type: 'action', app: 'delay', app_display_name: 'Delay by Zapier', event: 'Delay For', event_description: `Wait ${dur}`, config: { duration: dur }, output_fields: [], setup_instructions: `1. Set delay: ${dur}` });

// Looping
const L = (pos: number, desc: string): ZapStep =>
  ({ position: pos, type: 'action', app: 'looping', app_display_name: 'Looping by Zapier', event: 'Create Loop From Line Items', event_description: desc, config: {}, output_fields: ['item'], setup_instructions: `1. Map line items array\n2. ${desc}` });

// Digest
const DG = (pos: number, desc: string): ZapStep =>
  ({ position: pos, type: 'action', app: 'digest', app_display_name: 'Digest by Zapier', event: 'Append Entry and Schedule Digest', event_description: desc, config: {}, output_fields: ['digest'], setup_instructions: `1. Configure digest: ${desc}` });

// Storage
const ST = (pos: number, desc: string): ZapStep =>
  ({ position: pos, type: 'action', app: 'storage', app_display_name: 'Storage by Zapier', event: 'Set Value', event_description: desc, config: {}, output_fields: ['value'], setup_instructions: `1. Set storage key/value: ${desc}` });

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES: SeedTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CRM & Sales (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Salesforce Lead → Score Filter → HubSpot + Slack', category: 'CRM & Sales',
    description: 'Filter new Salesforce leads by score, format contact data, create HubSpot contact, and notify sales in Slack.',
    tags: ['Salesforce', 'HubSpot', 'Slack', 'lead-routing'], trigger_type: 'Event', plan: 'Professional', premium: ['salesforce', 'hubspot'], accounts: ['Salesforce', 'HubSpot', 'Slack'],
    steps: [
      T('salesforce', 'Salesforce', 'New Lead', 'Triggers when a new lead is created in Salesforce', {}, ['id', 'name', 'email', 'lead_score', 'company']),
      F(2, 'Lead Score >= 70'),
      FM(3, 'Capitalize', '{{step1.name}}'),
      A(4, 'hubspot', 'HubSpot', 'Create Contact', 'Creates a new HubSpot contact from qualified lead', { email: '{{step1.email}}', firstname: '{{step3.output}}', company: '{{step1.company}}' }, ['contact_id'], { email: 'step1.email', name: 'step3.output' }),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Posts notification to sales channel', { channel: '#sales', message: 'New qualified lead: {{step3.output}} (Score: {{step1.lead_score}})' }, ['ts']),
    ] },

  { name: 'HubSpot Deal Stage → Paths → Slack + Email + Sheets', category: 'CRM & Sales',
    description: 'Route HubSpot deal updates to different Slack channels based on stage and log all changes to Google Sheets.',
    tags: ['HubSpot', 'Slack', 'Google Sheets', 'deal-tracking'], trigger_type: 'Event', plan: 'Professional', premium: ['hubspot'], accounts: ['HubSpot', 'Slack', 'Google Sheets', 'Gmail'],
    steps: [
      T('hubspot', 'HubSpot', 'Deal Stage Changed', 'Triggers when a deal moves stages', {}, ['deal_id', 'deal_name', 'stage', 'amount', 'owner']),
      A(2, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs deal stage change', { spreadsheet: 'Deal Pipeline', row: { deal: '{{step1.deal_name}}', stage: '{{step1.stage}}', amount: '{{step1.amount}}' } }, ['row_id']),
      P(3, ['Won', 'Lost', 'Progressing']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Celebrates closed-won deals', { channel: '#wins', message: 'Deal won: {{step1.deal_name}} — ${{step1.amount}}' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Sends follow-up for lost deals', { to: '{{step1.owner}}', subject: 'Deal lost: {{step1.deal_name}}', body: 'Please review the deal and update CRM notes.' }, ['message_id']),
    ] },

  { name: 'Pipedrive New Deal → Enrich + Slack + Google Sheets', category: 'CRM & Sales',
    description: 'When a new Pipedrive deal is created, run a code enrichment step, format the output, and log to Sheets with Slack notification.',
    tags: ['Pipedrive', 'Slack', 'Google Sheets', 'enrichment'], trigger_type: 'Event', plan: 'Professional', premium: [], accounts: ['Pipedrive', 'Slack', 'Google Sheets'],
    steps: [
      T('pipedrive', 'Pipedrive', 'New Deal', 'Triggers when a new deal is added to Pipedrive', {}, ['id', 'title', 'value', 'person_name', 'org_name']),
      C(2, 'Enrich deal data — extract domain from email and calculate deal tier'),
      FM(3, 'Capitalize', '{{step1.org_name}}'),
      A(4, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs enriched deal data', { deal: '{{step1.title}}', company: '{{step3.output}}', value: '{{step1.value}}', tier: '{{step2.output}}' }, ['row_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Notifies sales team', { channel: '#pipeline', message: 'New deal: {{step1.title}} — {{step3.output}} (${{step1.value}})' }, ['ts']),
    ] },

  { name: 'Facebook Lead Ad → CRM + SMS + Email Drip', category: 'CRM & Sales',
    description: 'Capture Facebook lead ads, create CRM contacts, send immediate SMS confirmation, and start an email drip sequence.',
    tags: ['Facebook', 'HubSpot', 'Twilio', 'lead-capture'], trigger_type: 'Event', plan: 'Professional', premium: ['hubspot'], accounts: ['Facebook Lead Ads', 'HubSpot', 'Twilio', 'Mailchimp'],
    steps: [
      T('facebook-lead-ads', 'Facebook Lead Ads', 'New Lead', 'Triggers when a new lead is captured', {}, ['email', 'full_name', 'phone_number', 'ad_name']),
      FM(2, 'Split Text', '{{step1.full_name}}'),
      A(3, 'hubspot', 'HubSpot', 'Create Contact', 'Creates CRM contact with lead source', { email: '{{step1.email}}', firstname: '{{step2.output}}', phone: '{{step1.phone_number}}', lead_source: 'Facebook: {{step1.ad_name}}' }, ['contact_id']),
      A(4, 'twilio', 'Twilio', 'Send SMS', 'Sends immediate confirmation SMS', { to: '{{step1.phone_number}}', body: 'Thanks {{step2.output}}! We received your inquiry and will be in touch shortly.' }, ['sid']),
      A(5, 'mailchimp', 'Mailchimp', 'Add Subscriber to Tag', 'Starts email drip campaign', { email: '{{step1.email}}', tags: ['fb-lead', '{{step1.ad_name}}'] }, ['id']),
    ] },

  { name: 'Typeform Survey → Lead Score Code → CRM Route', category: 'CRM & Sales',
    description: 'Score Typeform survey responses using custom code logic, then route high-value leads to Salesforce and notify the team.',
    tags: ['Typeform', 'Salesforce', 'Slack', 'lead-scoring'], trigger_type: 'Webhook', plan: 'Professional', premium: ['salesforce'], accounts: ['Typeform', 'Salesforce', 'Slack'],
    steps: [
      T('typeform', 'Typeform', 'New Entry', 'Triggers when a new survey response is submitted', {}, ['email', 'name', 'company_size', 'budget', 'timeline']),
      C(2, 'Calculate lead score based on company_size, budget, and timeline answers'),
      F(3, 'Lead Score >= 50'),
      A(4, 'salesforce', 'Salesforce', 'Create Lead', 'Creates Salesforce lead with score', { email: '{{step1.email}}', name: '{{step1.name}}', lead_score: '{{step2.output}}', company_size: '{{step1.company_size}}' }, ['id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Notifies sales team of hot lead', { channel: '#hot-leads', message: 'Hot lead (score {{step2.output}}): {{step1.name}} — Budget: {{step1.budget}}' }, ['ts']),
    ] },

  { name: 'Calendly Booking → Pipedrive Deal + Google Calendar + Email', category: 'CRM & Sales',
    description: 'When a demo is booked via Calendly, create a deal in Pipedrive, add to Google Calendar with notes, and send prep email.',
    tags: ['Calendly', 'Pipedrive', 'Google Calendar', 'scheduling'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Calendly', 'Pipedrive', 'Google Calendar', 'Gmail'],
    steps: [
      T('calendly', 'Calendly', 'Invitee Created', 'Triggers when a meeting is booked', {}, ['invitee_name', 'invitee_email', 'event_type', 'start_time', 'questions_and_answers']),
      A(2, 'pipedrive', 'Pipedrive', 'Create Deal', 'Creates deal for the demo', { title: 'Demo: {{step1.invitee_name}}', person_name: '{{step1.invitee_name}}', stage: 'Demo Scheduled' }, ['deal_id']),
      A(3, 'google-calendar', 'Google Calendar', 'Create Detailed Event', 'Adds calendar event with CRM link', { summary: 'Demo: {{step1.invitee_name}}', start: '{{step1.start_time}}', description: 'Pipedrive: {{step2.deal_id}}' }, ['event_id']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends meeting prep email to rep', { to: 'sales@company.com', subject: 'Demo booked: {{step1.invitee_name}}', body: 'Prep for demo with {{step1.invitee_name}} at {{step1.start_time}}.\nAnswers: {{step1.questions_and_answers}}' }, ['message_id']),
    ] },

  { name: 'Google Forms → Formatter → HubSpot + Slack + Sheets Log', category: 'CRM & Sales',
    description: 'Process contact form submissions through text formatting, create HubSpot contacts, notify sales, and log submissions.',
    tags: ['Google Forms', 'HubSpot', 'Slack', 'lead-capture'], trigger_type: 'Webhook', plan: 'Professional', premium: ['hubspot'], accounts: ['Google Forms', 'HubSpot', 'Slack', 'Google Sheets'],
    steps: [
      T('google-forms', 'Google Forms', 'New Form Response', 'Triggers when a new form is submitted', {}, ['email', 'name', 'company', 'phone', 'message']),
      FM(2, 'Capitalize', '{{step1.company}}'),
      A(3, 'hubspot', 'HubSpot', 'Create Contact', 'Creates HubSpot contact', { email: '{{step1.email}}', firstname: '{{step1.name}}', company: '{{step2.output}}' }, ['contact_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts sales', { channel: '#inbound-leads', message: 'New inquiry from {{step1.name}} at {{step2.output}}: {{step1.message}}' }, ['ts']),
      A(5, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs submission', { name: '{{step1.name}}', email: '{{step1.email}}', company: '{{step2.output}}', date: '{{zap_meta_human_now}}' }, ['row_id']),
    ] },

  { name: 'Webhook Lead → Dedupe Storage → Salesforce + Slack', category: 'CRM & Sales',
    description: 'Receive leads via webhook, check for duplicates using Zapier Storage, then create in Salesforce and notify if new.',
    tags: ['Webhook', 'Salesforce', 'Slack', 'deduplication'], trigger_type: 'Webhook', plan: 'Professional', premium: ['salesforce'], accounts: ['Salesforce', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives inbound lead data via webhook', {}, ['email', 'name', 'company', 'source']),
      ST(2, 'Check if lead email already exists in storage'),
      F(3, 'Storage value does not exist (new lead)'),
      A(4, 'salesforce', 'Salesforce', 'Create Lead', 'Creates new Salesforce lead', { email: '{{step1.email}}', name: '{{step1.name}}', company: '{{step1.company}}', source: '{{step1.source}}' }, ['id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Notifies team of new lead', { channel: '#leads', message: 'New unique lead: {{step1.name}} ({{step1.company}}) from {{step1.source}}' }, ['ts']),
    ] },

  { name: 'Jotform → Loop Line Items → Airtable + HubSpot', category: 'CRM & Sales',
    description: 'Process multi-product Jotform submissions by looping through line items, creating Airtable records per product, and updating HubSpot.',
    tags: ['Jotform', 'Airtable', 'HubSpot', 'multi-product'], trigger_type: 'Webhook', plan: 'Professional', premium: ['hubspot'], accounts: ['Jotform', 'Airtable', 'HubSpot'],
    steps: [
      T('jotform', 'Jotform', 'New Submission', 'Triggers when a new form submission is received', {}, ['email', 'name', 'products', 'total']),
      L(2, 'Loop through each product line item in the order'),
      A(3, 'airtable', 'Airtable', 'Create Record', 'Creates a record per product line', { table: 'Orders', fields: { customer: '{{step1.name}}', product: '{{step2.item}}', email: '{{step1.email}}' } }, ['record_id']),
      A(4, 'hubspot', 'HubSpot', 'Create Deal', 'Creates a HubSpot deal for the order', { dealname: 'Order: {{step1.name}}', amount: '{{step1.total}}', pipeline: 'Sales' }, ['deal_id']),
    ] },

  { name: 'Intercom New Conversation → CRM Lookup → Priority Slack', category: 'CRM & Sales',
    description: 'When a new Intercom conversation starts, look up the contact in CRM, score priority via code, and route to appropriate Slack channel.',
    tags: ['Intercom', 'Salesforce', 'Slack', 'priority-routing'], trigger_type: 'Event', plan: 'Professional', premium: ['salesforce'], accounts: ['Intercom', 'Salesforce', 'Slack'],
    steps: [
      T('intercom', 'Intercom', 'New Conversation', 'Triggers when a new conversation starts', {}, ['contact_email', 'contact_name', 'body', 'source']),
      A(2, 'salesforce', 'Salesforce', 'Find Record', 'Looks up existing Salesforce contact', { object: 'Contact', email: '{{step1.contact_email}}' }, ['id', 'account_tier', 'owner']),
      C(3, 'Determine priority based on account tier and conversation content'),
      P(4, ['VIP', 'Standard', 'New']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Routes to priority-appropriate channel', { channel: '#{{step3.output}}-support', message: 'Intercom from {{step1.contact_name}}: {{step1.body}}' }, ['ts']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // Marketing (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Mailchimp Subscriber → Segment Paths → Drip Campaigns', category: 'Marketing',
    description: 'Route new Mailchimp subscribers into different drip campaign paths based on their signup source and interests.',
    tags: ['Mailchimp', 'Gmail', 'Google Sheets', 'email-drip'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Mailchimp', 'Gmail', 'Google Sheets'],
    steps: [
      T('mailchimp', 'Mailchimp', 'New Subscriber', 'Triggers when someone subscribes to a list', {}, ['email', 'first_name', 'source', 'interests']),
      P(2, ['B2B Path', 'B2C Path', 'Newsletter Only']),
      A(3, 'mailchimp', 'Mailchimp', 'Add Subscriber to Tag', 'Tags subscriber for B2B drip', { email: '{{step1.email}}', tags: ['b2b-drip-start'] }, ['id']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends personalized B2C welcome', { to: '{{step1.email}}', subject: 'Welcome {{step1.first_name}}!', body: 'Thanks for joining!' }, ['message_id']),
      A(5, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs all new subscribers', { email: '{{step1.email}}', path: '{{step2.output}}', date: '{{zap_meta_human_now}}' }, ['row_id']),
    ] },

  { name: 'Blog Post Published → Social Media Blast + Email', category: 'Marketing',
    description: 'When a new blog post is published via webhook, format the title, and distribute across social channels and email newsletter.',
    tags: ['Webhook', 'Slack', 'Mailchimp', 'content-distribution'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Slack', 'Mailchimp'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives new blog post notification', {}, ['title', 'url', 'excerpt', 'author', 'featured_image']),
      FM(2, 'Truncate', '{{step1.excerpt}}'),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Announces to marketing channel', { channel: '#content', message: 'New blog post by {{step1.author}}: {{step1.title}}\n{{step1.url}}' }, ['ts']),
      A(4, 'mailchimp', 'Mailchimp', 'Create Campaign', 'Creates email campaign for the post', { subject: 'New: {{step1.title}}', preview_text: '{{step2.output}}' }, ['campaign_id']),
    ] },

  { name: 'Google Sheets Lead List → Loop → SendGrid Email Sequence', category: 'Marketing',
    description: 'Read leads from a Google Sheet, loop through each row, and send personalized emails via SendGrid with formatted content.',
    tags: ['Google Sheets', 'SendGrid', 'email-outreach'], trigger_type: 'Schedule', plan: 'Starter', premium: [], accounts: ['Google Sheets', 'SendGrid'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Day', 'Runs daily to process new leads', { time: '09:00' }, ['scheduled_time']),
      A(2, 'google-sheets', 'Google Sheets', 'Get Many Spreadsheet Rows', 'Fetches unsent lead rows', { spreadsheet: 'Lead List', worksheet: 'Sheet1', filter: 'status = new' }, ['rows']),
      L(3, 'Loop through each lead row from the spreadsheet'),
      FM(4, 'Capitalize', '{{step3.item.name}}'),
      A(5, 'sendgrid', 'SendGrid', 'Send Email', 'Sends personalized outreach email', { to: '{{step3.item.email}}', subject: 'Hi {{step4.output}}, quick question', template_id: 'outreach-v1' }, ['message_id']),
    ] },

  { name: 'Stripe Payment → Customer Tag + Thank You + Slack', category: 'Marketing',
    description: 'When a Stripe payment succeeds, tag the customer in Mailchimp, send a personalized thank-you email, and notify the team.',
    tags: ['Stripe', 'Mailchimp', 'Gmail', 'Slack', 'customer-lifecycle'], trigger_type: 'Event', plan: 'Professional', premium: ['stripe'], accounts: ['Stripe', 'Mailchimp', 'Gmail', 'Slack'],
    steps: [
      T('stripe', 'Stripe', 'New Payment', 'Triggers when a payment is completed', {}, ['customer_email', 'customer_name', 'amount', 'product', 'currency']),
      FM(2, 'Currency', '{{step1.amount}}'),
      A(3, 'mailchimp', 'Mailchimp', 'Add Subscriber to Tag', 'Tags customer as buyer', { email: '{{step1.customer_email}}', tags: ['customer', '{{step1.product}}'] }, ['id']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends personalized thank-you', { to: '{{step1.customer_email}}', subject: 'Thank you for your purchase!', body: 'Hi {{step1.customer_name}}, your payment of {{step2.output}} was received.' }, ['message_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Notifies revenue channel', { channel: '#revenue', message: 'Payment received: {{step1.customer_name}} — {{step2.output}} for {{step1.product}}' }, ['ts']),
    ] },

  { name: 'HubSpot Contact → OpenAI Personalization → Email', category: 'Marketing',
    description: 'When a HubSpot contact reaches a lifecycle stage, use OpenAI to generate personalized email copy and send via Gmail.',
    tags: ['HubSpot', 'OpenAI', 'Gmail', 'ai-personalization'], trigger_type: 'Event', plan: 'Professional', premium: ['hubspot', 'openai'], accounts: ['HubSpot', 'OpenAI', 'Gmail'],
    steps: [
      T('hubspot', 'HubSpot', 'Contact Property Changed', 'Triggers when lifecycle stage changes to MQL', { property: 'lifecyclestage', value: 'marketingqualifiedlead' }, ['email', 'firstname', 'company', 'industry']),
      A(2, 'openai', 'OpenAI', 'Send Prompt', 'Generates personalized email copy based on contact info', { prompt: 'Write a short, personalized marketing email for {{step1.firstname}} at {{step1.company}} in the {{step1.industry}} industry.', model: 'gpt-4' }, ['text']),
      FM(3, 'Replace', '{{step2.text}}'),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends AI-generated personalized email', { to: '{{step1.email}}', subject: 'Quick insight for {{step1.company}}', body: '{{step3.output}}' }, ['message_id']),
    ] },

  { name: 'Weekly Digest → Sheets Metrics → Formatted Email Blast', category: 'Marketing',
    description: 'Compile weekly marketing metrics from Google Sheets, format into a digest, and distribute via email and Slack.',
    tags: ['Google Sheets', 'Gmail', 'Slack', 'reporting'], trigger_type: 'Schedule', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Gmail', 'Slack'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Week', 'Runs every Monday at 8am', { time: '08:00', day: 'Monday' }, ['scheduled_time']),
      A(2, 'google-sheets', 'Google Sheets', 'Get Many Spreadsheet Rows', 'Fetches this week marketing metrics', { spreadsheet: 'Marketing KPIs' }, ['rows']),
      DG(3, 'Compile all metrics into a weekly digest summary'),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends weekly marketing digest', { to: 'marketing-team@company.com', subject: 'Marketing Weekly Digest', body: '{{step3.digest}}' }, ['message_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Posts digest to marketing channel', { channel: '#marketing', message: 'Weekly Marketing Digest:\n{{step3.digest}}' }, ['ts']),
    ] },

  { name: 'Airtable Campaign Tracker → Status Paths → Notifications', category: 'Marketing',
    description: 'Monitor Airtable campaign records for status changes and route notifications based on campaign phase.',
    tags: ['Airtable', 'Slack', 'Gmail', 'campaign-management'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Airtable', 'Slack', 'Gmail'],
    steps: [
      T('airtable', 'Airtable', 'New or Updated Record', 'Triggers when a campaign record changes', { table: 'Campaigns' }, ['campaign_name', 'status', 'owner', 'budget', 'start_date']),
      F(2, 'Status field has changed'),
      P(3, ['Draft Review', 'Live', 'Completed', 'Paused']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies campaign status change', { channel: '#campaigns', message: 'Campaign "{{step1.campaign_name}}" moved to {{step1.status}}' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Notifies campaign owner', { to: '{{step1.owner}}', subject: 'Campaign Update: {{step1.campaign_name}}', body: 'Your campaign is now in {{step1.status}} status.' }, ['message_id']),
    ] },

  { name: 'Notion Content Calendar → Delay → Publish Reminder + Slack', category: 'Marketing',
    description: 'Monitor Notion content calendar entries, set a delay until publish date, then send reminders to content creators.',
    tags: ['Notion', 'Slack', 'Gmail', 'content-calendar'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Notion', 'Slack', 'Gmail'],
    steps: [
      T('notion', 'Notion', 'Updated Database Item', 'Triggers when content is marked ready for publish', { filter: { status: 'Ready' } }, ['title', 'publish_date', 'author', 'channel']),
      D(2, 'Until 1 day before publish_date'),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Sends publish reminder', { channel: '#content', message: 'Reminder: "{{step1.title}}" by {{step1.author}} publishes tomorrow on {{step1.channel}}' }, ['ts']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Emails the author directly', { to: '{{step1.author}}', subject: 'Publish tomorrow: {{step1.title}}', body: 'Your content "{{step1.title}}" is scheduled for {{step1.publish_date}}. Please do a final review.' }, ['message_id']),
    ] },

  { name: 'ClickUp Task → OpenAI Brief → Google Docs + Slack', category: 'Marketing',
    description: 'When a content task is created in ClickUp, use OpenAI to generate a creative brief, save to Google Docs, and notify the team.',
    tags: ['ClickUp', 'OpenAI', 'Google Docs', 'Slack', 'ai-content'], trigger_type: 'Event', plan: 'Professional', premium: ['openai'], accounts: ['ClickUp', 'OpenAI', 'Google Docs', 'Slack'],
    steps: [
      T('clickup', 'ClickUp', 'New Task', 'Triggers when a content task is created', { list: 'Content Requests' }, ['task_name', 'description', 'assignee', 'due_date']),
      A(2, 'openai', 'OpenAI', 'Send Prompt', 'Generates a creative brief from the task description', { prompt: 'Write a marketing creative brief for: {{step1.task_name}}. Details: {{step1.description}}', model: 'gpt-4' }, ['text']),
      A(3, 'google-docs', 'Google Docs', 'Create Document from Text', 'Creates brief in Google Docs', { title: 'Brief: {{step1.task_name}}', body: '{{step2.text}}', folder: 'Content Briefs' }, ['doc_url']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies team with brief link', { channel: '#content-team', message: 'New brief generated for "{{step1.task_name}}":\n{{step3.doc_url}}' }, ['ts']),
    ] },

  { name: 'Webhook UTM Tracker → Code Parse → Sheets + Slack Alert', category: 'Marketing',
    description: 'Capture UTM-tagged inbound traffic via webhook, parse UTM parameters with code, log to Sheets, and alert on high-value sources.',
    tags: ['Webhook', 'Google Sheets', 'Slack', 'utm-tracking'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives page visit data with UTM params', {}, ['url', 'utm_source', 'utm_medium', 'utm_campaign', 'email']),
      C(2, 'Parse and validate UTM parameters, calculate attribution score'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs UTM data', { source: '{{step1.utm_source}}', medium: '{{step1.utm_medium}}', campaign: '{{step1.utm_campaign}}', score: '{{step2.output}}' }, ['row_id']),
      F(4, 'Attribution Score >= 80'),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Alerts on high-value traffic source', { channel: '#marketing-alerts', message: 'High-value visit: {{step1.utm_source}}/{{step1.utm_campaign}} (Score: {{step2.output}})' }, ['ts']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // Operations (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Asana Task Created → Formatter → Slack + Google Calendar', category: 'Operations',
    description: 'When a new Asana task is created, format the title, notify the team in Slack, and block time on Google Calendar.',
    tags: ['Asana', 'Slack', 'Google Calendar', 'project-management'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Asana', 'Slack', 'Google Calendar'],
    steps: [
      T('asana', 'Asana', 'New Task', 'Triggers when a task is created in a project', { project: 'Main Project' }, ['task_name', 'assignee', 'due_date', 'notes', 'project_name']),
      FM(2, 'Capitalize', '{{step1.task_name}}'),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Notifies project channel', { channel: '#project-updates', message: 'New task: {{step2.output}} assigned to {{step1.assignee}} (Due: {{step1.due_date}})' }, ['ts']),
      A(4, 'google-calendar', 'Google Calendar', 'Create Detailed Event', 'Blocks time for the task', { summary: '{{step2.output}}', start: '{{step1.due_date}}', description: '{{step1.notes}}' }, ['event_id']),
    ] },

  { name: 'Trello Card Moved → Paths → Slack + Email + Sheets', category: 'Operations',
    description: 'Route Trello card movements through different notification paths based on the destination list.',
    tags: ['Trello', 'Slack', 'Gmail', 'Google Sheets', 'workflow-routing'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Trello', 'Slack', 'Gmail', 'Google Sheets'],
    steps: [
      T('trello', 'Trello', 'Card Moved to List', 'Triggers when a Trello card is moved', {}, ['card_name', 'list_name', 'member', 'board_name', 'due_date']),
      P(2, ['Done', 'In Review', 'Blocked']),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Posts completion announcement', { channel: '#wins', message: 'Completed: {{step1.card_name}} by {{step1.member}}' }, ['ts']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends review request', { to: 'reviewer@company.com', subject: 'Review needed: {{step1.card_name}}', body: 'Please review this item.' }, ['message_id']),
      A(5, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs card movement', { card: '{{step1.card_name}}', list: '{{step1.list_name}}', date: '{{zap_meta_human_now}}' }, ['row_id']),
    ] },

  { name: 'ClickUp Status Change → Filter → Notion + Slack', category: 'Operations',
    description: 'When a ClickUp task status changes to done, filter for high-priority tasks, update Notion database, and celebrate in Slack.',
    tags: ['ClickUp', 'Notion', 'Slack', 'task-tracking'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['ClickUp', 'Notion', 'Slack'],
    steps: [
      T('clickup', 'ClickUp', 'Task Status Changed', 'Triggers when a task status changes', {}, ['task_name', 'status', 'priority', 'assignee', 'time_spent']),
      F(2, 'Status equals Complete AND Priority is High or Urgent'),
      A(3, 'notion', 'Notion', 'Update Database Item', 'Updates delivery tracker in Notion', { page_id: '{{step1.task_name}}', properties: { status: 'Complete', time_spent: '{{step1.time_spent}}' } }, ['page_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Celebrates high-priority completion', { channel: '#team-wins', message: '{{step1.assignee}} completed high-priority task: {{step1.task_name}} in {{step1.time_spent}}' }, ['ts']),
    ] },

  { name: 'Google Drive New File → Code Classify → Airtable + Slack', category: 'Operations',
    description: 'When files are uploaded to Google Drive, use code to classify the file type, organize in Airtable, and notify relevant teams.',
    tags: ['Google Drive', 'Airtable', 'Slack', 'file-management'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Google Drive', 'Airtable', 'Slack'],
    steps: [
      T('google-drive', 'Google Drive', 'New File in Folder', 'Triggers when a new file is uploaded', { folder: 'Incoming Documents' }, ['file_name', 'mime_type', 'owner', 'file_url', 'file_size']),
      C(2, 'Classify document type based on filename pattern and MIME type'),
      A(3, 'airtable', 'Airtable', 'Create Record', 'Catalogs document in Airtable', { table: 'Documents', fields: { name: '{{step1.file_name}}', type: '{{step2.output}}', url: '{{step1.file_url}}', owner: '{{step1.owner}}' } }, ['record_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies team of new document', { channel: '#documents', message: 'New {{step2.output}}: {{step1.file_name}} uploaded by {{step1.owner}}' }, ['ts']),
    ] },

  { name: 'Monday.com Item → Google Sheets + Calendar + Slack', category: 'Operations',
    description: 'Sync new Monday.com items to Google Sheets for reporting, create calendar events for deadlines, and notify via Slack.',
    tags: ['Monday.com', 'Google Sheets', 'Google Calendar', 'Slack', 'sync'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Monday.com', 'Google Sheets', 'Google Calendar', 'Slack'],
    steps: [
      T('monday', 'Monday.com', 'New Item', 'Triggers when a new item is created on a board', {}, ['item_name', 'column_values', 'group', 'board_name', 'assignee']),
      FM(2, 'Default Value', '{{step1.column_values.date}}'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs item for reporting', { board: '{{step1.board_name}}', item: '{{step1.item_name}}', group: '{{step1.group}}', assignee: '{{step1.assignee}}' }, ['row_id']),
      A(4, 'google-calendar', 'Google Calendar', 'Create Detailed Event', 'Creates deadline event', { summary: 'Due: {{step1.item_name}}', start: '{{step2.output}}' }, ['event_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Announces new item', { channel: '#project-board', message: 'New item on {{step1.board_name}}: {{step1.item_name}} → {{step1.assignee}}' }, ['ts']),
    ] },

  { name: 'Slack Command → Google Sheets Lookup → Reply', category: 'Operations',
    description: 'Build an internal Slack bot that looks up project status in Google Sheets and replies with formatted results.',
    tags: ['Slack', 'Google Sheets', 'internal-tools'], trigger_type: 'Event', plan: 'Free', premium: [], accounts: ['Slack', 'Google Sheets'],
    steps: [
      T('slack', 'Slack', 'New Pushed Message', 'Triggers on messages starting with /status', { trigger_word: '/status' }, ['text', 'user_name', 'channel']),
      FM(2, 'Extract Pattern', '{{step1.text}}'),
      A(3, 'google-sheets', 'Google Sheets', 'Lookup Spreadsheet Row', 'Searches for project by name', { lookup_column: 'Project', lookup_value: '{{step2.output}}' }, ['status', 'owner', 'due_date', 'progress']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Replies with status info', { channel: '{{step1.channel}}', message: 'Project: {{step2.output}}\nStatus: {{step3.status}}\nOwner: {{step3.owner}}\nDue: {{step3.due_date}}\nProgress: {{step3.progress}}%' }, ['ts']),
    ] },

  { name: 'Notion Meeting Notes → Formatter → Asana Tasks + Email', category: 'Operations',
    description: 'When meeting notes are added to Notion, extract action items with formatter, create Asana tasks, and email attendees.',
    tags: ['Notion', 'Asana', 'Gmail', 'meeting-automation'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Notion', 'Asana', 'Gmail'],
    steps: [
      T('notion', 'Notion', 'New Database Item', 'Triggers when meeting notes are created', { database: 'Meeting Notes' }, ['title', 'action_items', 'attendees', 'date', 'summary']),
      FM(2, 'Split Text', '{{step1.action_items}}'),
      L(3, 'Loop through each extracted action item'),
      A(4, 'asana', 'Asana', 'Create Task', 'Creates task per action item', { name: '{{step3.item}}', project: 'Action Items', notes: 'From meeting: {{step1.title}}' }, ['task_id']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Sends meeting recap', { to: '{{step1.attendees}}', subject: 'Action items from: {{step1.title}}', body: '{{step1.summary}}\n\nAction Items:\n{{step1.action_items}}' }, ['message_id']),
    ] },

  { name: 'Schedule Daily → Airtable Review → Overdue Filter → Slack', category: 'Operations',
    description: 'Run a daily check on Airtable for overdue tasks, filter only overdue items, and send a morning Slack reminder.',
    tags: ['Airtable', 'Slack', 'overdue-tracking'], trigger_type: 'Schedule', plan: 'Starter', premium: [], accounts: ['Airtable', 'Slack'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Day', 'Runs every morning to check overdue items', { time: '08:30' }, ['scheduled_time']),
      A(2, 'airtable', 'Airtable', 'Find Records', 'Searches for overdue tasks', { table: 'Tasks', formula: 'AND({Due Date} < TODAY(), {Status} != "Done")' }, ['records']),
      F(3, 'Record count > 0'),
      C(4, 'Format overdue tasks into a summary list with assignee and days overdue'),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Posts overdue summary', { channel: '#project-ops', message: 'Overdue Tasks Report:\n{{step4.output}}' }, ['ts']),
    ] },

  { name: 'Jira Issue Status → Formatter → Linear + Discord', category: 'Operations',
    description: 'Sync Jira issue status changes to Linear for cross-team visibility, format updates, and notify in Discord.',
    tags: ['Jira', 'Linear', 'Discord', 'cross-platform-sync'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Jira', 'Linear', 'Discord'],
    steps: [
      T('jira', 'Jira Software Cloud', 'Issue Updated', 'Triggers when an issue status changes', {}, ['issue_key', 'summary', 'status', 'assignee', 'priority']),
      FM(2, 'Lookup Table', '{{step1.status}}'),
      A(3, 'linear', 'Linear', 'Update Issue', 'Updates corresponding Linear issue', { identifier: '{{step1.issue_key}}', state: '{{step2.output}}' }, ['issue_id']),
      A(4, 'discord', 'Discord', 'Send Channel Message', 'Posts update to Discord', { channel: '#dev-sync', message: '[{{step1.issue_key}}] {{step1.summary}} → {{step1.status}} ({{step1.assignee}})' }, ['message_id']),
    ] },

  { name: 'Google Forms Approval → Delay → Paths → Email + Sheets', category: 'Operations',
    description: 'Process approval requests from Google Forms, add a review delay, then route based on approval decision.',
    tags: ['Google Forms', 'Gmail', 'Google Sheets', 'approval-workflow'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Google Forms', 'Gmail', 'Google Sheets'],
    steps: [
      T('google-forms', 'Google Forms', 'New Form Response', 'Triggers when an approval request is submitted', {}, ['requestor', 'email', 'request_type', 'description', 'amount']),
      D(2, '2 hours'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends approval request to manager', { to: 'manager@company.com', subject: 'Approval Needed: {{step1.request_type}}', body: 'From: {{step1.requestor}}\nAmount: {{step1.amount}}\nDescription: {{step1.description}}' }, ['message_id']),
      A(4, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs the request', { requestor: '{{step1.requestor}}', type: '{{step1.request_type}}', amount: '{{step1.amount}}', status: 'Pending' }, ['row_id']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // Finance (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Stripe Invoice Paid → Formatter → Sheets + Slack + Email', category: 'Finance',
    description: 'When a Stripe invoice is paid, format the currency, log to Sheets, notify finance in Slack, and email the customer a receipt.',
    tags: ['Stripe', 'Google Sheets', 'Slack', 'Gmail', 'invoicing'], trigger_type: 'Event', plan: 'Professional', premium: ['stripe'], accounts: ['Stripe', 'Google Sheets', 'Slack', 'Gmail'],
    steps: [
      T('stripe', 'Stripe', 'New Invoice Payment', 'Triggers when an invoice is paid', {}, ['customer_email', 'customer_name', 'amount_paid', 'invoice_number', 'currency']),
      FM(2, 'Currency', '{{step1.amount_paid}}'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs payment', { invoice: '{{step1.invoice_number}}', customer: '{{step1.customer_name}}', amount: '{{step2.output}}', date: '{{zap_meta_human_now}}' }, ['row_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies finance team', { channel: '#finance', message: 'Invoice paid: {{step1.invoice_number}} — {{step1.customer_name}} — {{step2.output}}' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Sends payment confirmation', { to: '{{step1.customer_email}}', subject: 'Payment received: {{step1.invoice_number}}', body: 'Thank you {{step1.customer_name}}, your payment of {{step2.output}} has been received.' }, ['message_id']),
    ] },

  { name: 'Stripe Subscription → Paths → Renewal/Cancel/Upgrade', category: 'Finance',
    description: 'Route Stripe subscription events through conditional paths for renewals, cancellations, and upgrades.',
    tags: ['Stripe', 'Slack', 'Gmail', 'subscription-management'], trigger_type: 'Event', plan: 'Professional', premium: ['stripe'], accounts: ['Stripe', 'Slack', 'Gmail', 'Google Sheets'],
    steps: [
      T('stripe', 'Stripe', 'Customer Subscription Updated', 'Triggers when a subscription changes', {}, ['customer_email', 'customer_name', 'plan', 'status', 'amount']),
      P(2, ['Renewed', 'Cancelled', 'Upgraded']),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Posts renewal to finance', { channel: '#subscriptions', message: 'Renewed: {{step1.customer_name}} — {{step1.plan}}' }, ['ts']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends cancellation follow-up', { to: '{{step1.customer_email}}', subject: 'We\'re sorry to see you go', body: 'Hi {{step1.customer_name}}, we noticed your subscription was cancelled. Can we help?' }, ['message_id']),
      A(5, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs subscription event', { customer: '{{step1.customer_name}}', event: '{{step1.status}}', plan: '{{step1.plan}}', amount: '{{step1.amount}}' }, ['row_id']),
    ] },

  { name: 'Google Sheets Expense → Code Calculate → Approval Email', category: 'Finance',
    description: 'When expense rows are added to Sheets, use code to calculate tax and totals, then route for approval based on amount.',
    tags: ['Google Sheets', 'Gmail', 'Slack', 'expense-management'], trigger_type: 'Event', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Gmail', 'Slack'],
    steps: [
      T('google-sheets', 'Google Sheets', 'New Spreadsheet Row', 'Triggers when a new expense is logged', {}, ['employee', 'amount', 'category', 'description', 'receipt_url']),
      C(2, 'Calculate tax (8.25%), total with tax, and determine approval tier'),
      P(3, ['Auto-Approve', 'Manager Approval', 'VP Approval']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends approval request to appropriate approver', { to: '{{step2.output.approver}}', subject: 'Expense Approval: ${{step1.amount}} from {{step1.employee}}', body: 'Category: {{step1.category}}\nAmount: ${{step1.amount}}\nWith tax: ${{step2.output.total}}\nDescription: {{step1.description}}' }, ['message_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Notifies finance channel', { channel: '#expenses', message: 'Expense submitted: {{step1.employee}} — ${{step2.output.total}} ({{step1.category}})' }, ['ts']),
    ] },

  { name: 'Webhook Payment → Filter Threshold → Sheets + Alert', category: 'Finance',
    description: 'Receive payment webhooks, filter for large transactions above threshold, log all payments, and alert on high-value ones.',
    tags: ['Webhook', 'Google Sheets', 'Slack', 'payment-monitoring'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives payment notification webhook', {}, ['transaction_id', 'amount', 'currency', 'customer', 'method']),
      A(2, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs all transactions', { id: '{{step1.transaction_id}}', amount: '{{step1.amount}}', customer: '{{step1.customer}}', method: '{{step1.method}}', date: '{{zap_meta_human_now}}' }, ['row_id']),
      F(3, 'Amount >= 10000'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts on large transactions', { channel: '#finance-alerts', message: 'Large payment: ${{step1.amount}} from {{step1.customer}} ({{step1.method}})' }, ['ts']),
    ] },

  { name: 'QuickBooks Invoice → Formatter → Airtable + Slack', category: 'Finance',
    description: 'When a QuickBooks invoice is created, format amounts, track in Airtable AR table, and notify the finance team.',
    tags: ['QuickBooks', 'Airtable', 'Slack', 'accounts-receivable'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['QuickBooks', 'Airtable', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives QuickBooks invoice webhook', {}, ['invoice_number', 'customer_name', 'amount', 'due_date', 'line_items']),
      FM(2, 'Currency', '{{step1.amount}}'),
      A(3, 'airtable', 'Airtable', 'Create Record', 'Adds invoice to AR tracker', { table: 'Accounts Receivable', fields: { invoice: '{{step1.invoice_number}}', customer: '{{step1.customer_name}}', amount: '{{step2.output}}', due: '{{step1.due_date}}', status: 'Pending' } }, ['record_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts invoice notification', { channel: '#finance', message: 'New invoice #{{step1.invoice_number}}: {{step1.customer_name}} — {{step2.output}} (Due: {{step1.due_date}})' }, ['ts']),
    ] },

  { name: 'Stripe Failed Payment → Retry Delay → Email + Slack', category: 'Finance',
    description: 'When a Stripe payment fails, wait before sending a polite retry email to the customer and alerting the finance team.',
    tags: ['Stripe', 'Gmail', 'Slack', 'dunning'], trigger_type: 'Event', plan: 'Professional', premium: ['stripe'], accounts: ['Stripe', 'Gmail', 'Slack'],
    steps: [
      T('stripe', 'Stripe', 'Payment Failed', 'Triggers when a payment attempt fails', {}, ['customer_email', 'customer_name', 'amount', 'failure_reason', 'invoice_id']),
      D(2, '4 hours'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends polite payment retry email', { to: '{{step1.customer_email}}', subject: 'Action needed: Update payment method', body: 'Hi {{step1.customer_name}}, we were unable to process your payment of ${{step1.amount}}. Please update your payment method.' }, ['message_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts finance team', { channel: '#billing', message: 'Payment failed: {{step1.customer_name}} — ${{step1.amount}} ({{step1.failure_reason}})' }, ['ts']),
    ] },

  { name: 'Monthly Revenue → Sheets → Code Metrics → Slack Report', category: 'Finance',
    description: 'On the 1st of each month, pull revenue data from Sheets, calculate MoM growth and metrics via code, and post to Slack.',
    tags: ['Google Sheets', 'Slack', 'revenue-reporting'], trigger_type: 'Schedule', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Slack'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Month', 'Runs on the 1st of each month', { day: '1', time: '09:00' }, ['scheduled_time']),
      A(2, 'google-sheets', 'Google Sheets', 'Get Many Spreadsheet Rows', 'Pulls revenue data for the month', { spreadsheet: 'Revenue Tracker' }, ['rows']),
      C(3, 'Calculate total revenue, MoM growth rate, top customers, and average deal size'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts monthly revenue report', { channel: '#finance', message: 'Monthly Revenue Report:\n{{step3.output}}' }, ['ts']),
    ] },

  { name: 'Airtable Invoice Loop → SendGrid Reminders', category: 'Finance',
    description: 'Scan Airtable for overdue invoices, loop through each one, and send personalized payment reminder emails via SendGrid.',
    tags: ['Airtable', 'SendGrid', 'collections'], trigger_type: 'Schedule', plan: 'Starter', premium: [], accounts: ['Airtable', 'SendGrid'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Week', 'Runs weekly to check overdue invoices', { day: 'Monday', time: '10:00' }, ['scheduled_time']),
      A(2, 'airtable', 'Airtable', 'Find Records', 'Finds invoices past due date', { table: 'Invoices', formula: 'AND({Due Date} < TODAY(), {Status} = "Pending")' }, ['records']),
      L(3, 'Loop through each overdue invoice record'),
      A(4, 'sendgrid', 'SendGrid', 'Send Email', 'Sends payment reminder for each invoice', { to: '{{step3.item.email}}', subject: 'Payment reminder: Invoice #{{step3.item.invoice_number}}', template_id: 'payment-reminder' }, ['message_id']),
    ] },

  { name: 'Shopify Order → Tax Code → Sheets + Accounting Webhook', category: 'Finance',
    description: 'When a Shopify order is placed, calculate tax classification via code, log to Sheets, and push to accounting system.',
    tags: ['Shopify', 'Google Sheets', 'accounting'], trigger_type: 'Event', plan: 'Professional', premium: ['shopify'], accounts: ['Shopify', 'Google Sheets'],
    steps: [
      T('shopify', 'Shopify', 'New Order', 'Triggers when a new order is placed', {}, ['order_number', 'customer_email', 'total_price', 'line_items', 'shipping_address']),
      C(2, 'Determine tax jurisdiction and calculate sales tax based on shipping address'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs order with tax details', { order: '{{step1.order_number}}', total: '{{step1.total_price}}', tax: '{{step2.output.tax}}', jurisdiction: '{{step2.output.jurisdiction}}' }, ['row_id']),
      A(4, 'webhook', 'Webhooks by Zapier', 'POST', 'Pushes to accounting system', { url: 'https://accounting.api/orders', data: { order_id: '{{step1.order_number}}', total: '{{step1.total_price}}', tax: '{{step2.output}}' } }, ['status']),
    ] },

  { name: 'Stripe Refund → Storage Check → Sheets + Email + Slack', category: 'Finance',
    description: 'Track Stripe refunds, check refund history in Storage, log to Sheets, email customer confirmation, and alert if repeat refunder.',
    tags: ['Stripe', 'Google Sheets', 'Gmail', 'Slack', 'refund-tracking'], trigger_type: 'Event', plan: 'Professional', premium: ['stripe'], accounts: ['Stripe', 'Google Sheets', 'Gmail', 'Slack'],
    steps: [
      T('stripe', 'Stripe', 'New Refund', 'Triggers when a refund is processed', {}, ['customer_email', 'customer_name', 'amount', 'reason', 'charge_id']),
      ST(2, 'Increment refund counter for this customer email'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs refund', { customer: '{{step1.customer_name}}', amount: '{{step1.amount}}', reason: '{{step1.reason}}', refund_count: '{{step2.value}}' }, ['row_id']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Confirms refund to customer', { to: '{{step1.customer_email}}', subject: 'Refund processed: ${{step1.amount}}', body: 'Hi {{step1.customer_name}}, your refund of ${{step1.amount}} has been processed.' }, ['message_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Alerts on refund', { channel: '#finance', message: 'Refund: {{step1.customer_name}} — ${{step1.amount}} (Reason: {{step1.reason}}, Total refunds: {{step2.value}})' }, ['ts']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // Customer Support (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Zendesk Ticket → Priority Filter → Slack + Assign', category: 'Customer Support',
    description: 'Route new Zendesk tickets through a priority filter, assign to appropriate agents, and notify the team in Slack.',
    tags: ['Zendesk', 'Slack', 'ticket-routing'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Zendesk', 'Slack'],
    steps: [
      T('zendesk', 'Zendesk', 'New Ticket', 'Triggers when a new support ticket is created', {}, ['ticket_id', 'subject', 'description', 'requester_email', 'priority']),
      F(2, 'Priority is Urgent or High'),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Alerts on high-priority tickets', { channel: '#urgent-support', message: 'URGENT ticket #{{step1.ticket_id}}: {{step1.subject}} from {{step1.requester_email}}' }, ['ts']),
      A(4, 'zendesk', 'Zendesk', 'Update Ticket', 'Auto-assigns to senior agent', { ticket_id: '{{step1.ticket_id}}', assignee: 'senior-agent@company.com', tags: ['auto-routed', 'high-priority'] }, ['ticket_id']),
    ] },

  { name: 'Intercom → OpenAI Classify → Paths → Route Team', category: 'Customer Support',
    description: 'Use OpenAI to classify Intercom conversations by intent, then route to the correct support team via conditional paths.',
    tags: ['Intercom', 'OpenAI', 'Slack', 'ai-classification'], trigger_type: 'Event', plan: 'Professional', premium: ['openai'], accounts: ['Intercom', 'OpenAI', 'Slack'],
    steps: [
      T('intercom', 'Intercom', 'New Conversation', 'Triggers when a new conversation starts', {}, ['contact_email', 'body', 'source', 'contact_name']),
      A(2, 'openai', 'OpenAI', 'Send Prompt', 'Classifies support intent', { prompt: 'Classify this support message into one category: billing, technical, account, general. Message: {{step1.body}}', model: 'gpt-4' }, ['text']),
      P(3, ['Billing', 'Technical', 'Account', 'General']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Routes to classified team channel', { channel: '#support-{{step2.text}}', message: 'From {{step1.contact_name}}: {{step1.body}}' }, ['ts']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Logs all classifications', { channel: '#support-log', message: 'Classified as {{step2.text}}: {{step1.contact_name}} — {{step1.body}}' }, ['ts']),
    ] },

  { name: 'Freshdesk Ticket → CSAT Delay → Survey Email', category: 'Customer Support',
    description: 'After a Freshdesk ticket is resolved, wait 24 hours then send a CSAT survey email to collect feedback.',
    tags: ['Freshdesk', 'Gmail', 'csat-survey'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Freshdesk', 'Gmail'],
    steps: [
      T('freshdesk', 'Freshdesk', 'Ticket Status Changed', 'Triggers when ticket status changes to Resolved', { status: 'Resolved' }, ['ticket_id', 'subject', 'requester_email', 'requester_name', 'agent_name']),
      D(2, '24 hours'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends CSAT survey', { to: '{{step1.requester_email}}', subject: 'How did we do? Ticket #{{step1.ticket_id}}', body: 'Hi {{step1.requester_name}}, your ticket "{{step1.subject}}" was resolved by {{step1.agent_name}}. Please rate your experience: [1-5 survey link]' }, ['message_id']),
    ] },

  { name: 'Typeform CSAT → Code Score → Paths → Slack + CRM', category: 'Customer Support',
    description: 'Process CSAT survey responses, calculate NPS via code, and route promoters vs detractors to different follow-up actions.',
    tags: ['Typeform', 'Slack', 'HubSpot', 'nps-tracking'], trigger_type: 'Webhook', plan: 'Professional', premium: ['hubspot'], accounts: ['Typeform', 'Slack', 'HubSpot'],
    steps: [
      T('typeform', 'Typeform', 'New Entry', 'Triggers when a CSAT survey is submitted', {}, ['email', 'name', 'score', 'feedback', 'ticket_id']),
      C(2, 'Categorize score: 9-10=promoter, 7-8=passive, 0-6=detractor'),
      P(3, ['Promoter', 'Passive', 'Detractor']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Celebrates promoters or alerts on detractors', { channel: '#customer-feedback', message: '{{step2.output}}: {{step1.name}} scored {{step1.score}}/10 — "{{step1.feedback}}"' }, ['ts']),
      A(5, 'hubspot', 'HubSpot', 'Update Contact', 'Updates NPS score in CRM', { email: '{{step1.email}}', nps_category: '{{step2.output}}', last_nps_score: '{{step1.score}}' }, ['contact_id']),
    ] },

  { name: 'Gmail Support → OpenAI Draft → Slack Review', category: 'Customer Support',
    description: 'When a support email arrives, use OpenAI to draft a response, then post to Slack for agent review before sending.',
    tags: ['Gmail', 'OpenAI', 'Slack', 'ai-response-draft'], trigger_type: 'Email', plan: 'Professional', premium: ['openai'], accounts: ['Gmail', 'OpenAI', 'Slack'],
    steps: [
      T('gmail', 'Gmail', 'New Email', 'Triggers on new emails to support inbox', { label: 'support-inbox' }, ['from_email', 'from_name', 'subject', 'body_plain', 'message_id']),
      A(2, 'openai', 'OpenAI', 'Send Prompt', 'Drafts a support response', { prompt: 'Draft a helpful, empathetic support reply to: Subject: {{step1.subject}}\nBody: {{step1.body_plain}}', model: 'gpt-4' }, ['text']),
      FM(3, 'Truncate', '{{step1.body_plain}}'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts draft for review', { channel: '#support-drafts', message: 'From: {{step1.from_name}}\nSubject: {{step1.subject}}\nOriginal: {{step3.output}}\n---\nDraft reply:\n{{step2.text}}' }, ['ts']),
    ] },

  { name: 'Zendesk Escalation → Formatter → Jira + Slack + Email', category: 'Customer Support',
    description: 'When a Zendesk ticket is escalated, format details, create a Jira issue for engineering, and notify all stakeholders.',
    tags: ['Zendesk', 'Jira', 'Slack', 'Gmail', 'escalation'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Zendesk', 'Jira', 'Slack', 'Gmail'],
    steps: [
      T('zendesk', 'Zendesk', 'Ticket Tag Added', 'Triggers when escalation tag is added', { tag: 'escalated' }, ['ticket_id', 'subject', 'description', 'requester_email', 'priority']),
      FM(2, 'Truncate', '{{step1.description}}'),
      A(3, 'jira', 'Jira Software Cloud', 'Create Issue', 'Creates engineering bug ticket', { summary: '[Escalation] {{step1.subject}}', description: '{{step2.output}}\n\nZendesk #{{step1.ticket_id}}', issuetype: 'Bug', priority: '{{step1.priority}}' }, ['issue_key']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts engineering', { channel: '#escalations', message: 'Support escalation: {{step1.subject}} → Jira {{step3.issue_key}}' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Notifies customer of escalation', { to: '{{step1.requester_email}}', subject: 'Re: {{step1.subject}} — Escalated to engineering', body: 'We have escalated your issue to our engineering team for priority resolution.' }, ['message_id']),
    ] },

  { name: 'Slack Support Channel → Digest → Weekly Email Report', category: 'Customer Support',
    description: 'Collect all Slack support messages into a weekly digest and email a summary report to the support manager.',
    tags: ['Slack', 'Gmail', 'support-reporting'], trigger_type: 'Event', plan: 'Free', premium: [], accounts: ['Slack', 'Gmail'],
    steps: [
      T('slack', 'Slack', 'New Message Posted to Channel', 'Monitors #support for all messages', { channel: '#support' }, ['text', 'user_name', 'timestamp']),
      DG(2, 'Collect support messages for weekly email digest'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends weekly support digest', { to: 'support-manager@company.com', subject: 'Weekly Support Digest', body: '{{step2.digest}}' }, ['message_id']),
    ] },

  { name: 'Webhook Ticket → Code SLA → Filter Breach → Slack Alert', category: 'Customer Support',
    description: 'Monitor ticket webhooks, calculate SLA status via code, filter for breaches, and alert the team immediately.',
    tags: ['Webhook', 'Slack', 'sla-monitoring'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives ticket update webhooks', {}, ['ticket_id', 'created_at', 'priority', 'status', 'last_response_at']),
      C(2, 'Calculate SLA remaining time based on priority and created_at timestamp'),
      F(3, 'SLA remaining <= 0 (breach detected)'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts on SLA breach', { channel: '#sla-alerts', message: 'SLA BREACH: Ticket #{{step1.ticket_id}} ({{step1.priority}}) — Response overdue by {{step2.output}} minutes' }, ['ts']),
    ] },

  { name: 'Intercom Closed → Sheets Log + Airtable CSAT Tracker', category: 'Customer Support',
    description: 'When an Intercom conversation is closed, log resolution details to Sheets and track in Airtable for CSAT analysis.',
    tags: ['Intercom', 'Google Sheets', 'Airtable', 'resolution-tracking'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Intercom', 'Google Sheets', 'Airtable'],
    steps: [
      T('intercom', 'Intercom', 'Conversation Closed', 'Triggers when a conversation is closed', {}, ['conversation_id', 'contact_email', 'contact_name', 'assignee', 'duration', 'rating']),
      A(2, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs conversation data', { id: '{{step1.conversation_id}}', customer: '{{step1.contact_name}}', agent: '{{step1.assignee}}', duration: '{{step1.duration}}', rating: '{{step1.rating}}' }, ['row_id']),
      A(3, 'airtable', 'Airtable', 'Create Record', 'Adds to CSAT tracker', { table: 'CSAT Tracker', fields: { conversation: '{{step1.conversation_id}}', customer: '{{step1.contact_name}}', rating: '{{step1.rating}}', agent: '{{step1.assignee}}' } }, ['record_id']),
    ] },

  { name: 'Freshdesk → Loop Watchers → Email + Slack Summary', category: 'Customer Support',
    description: 'When a Freshdesk ticket is updated, loop through all watchers to send individual email updates, then post a Slack summary.',
    tags: ['Freshdesk', 'Gmail', 'Slack', 'watcher-notifications'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Freshdesk', 'Gmail', 'Slack'],
    steps: [
      T('freshdesk', 'Freshdesk', 'Ticket Updated', 'Triggers when a ticket is updated', {}, ['ticket_id', 'subject', 'status', 'watchers', 'latest_comment']),
      L(2, 'Loop through each watcher email in the watchers list'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends update to each watcher', { to: '{{step2.item}}', subject: 'Update: Ticket #{{step1.ticket_id}} — {{step1.subject}}', body: 'Status: {{step1.status}}\nLatest: {{step1.latest_comment}}' }, ['message_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts ticket update summary', { channel: '#support', message: 'Ticket #{{step1.ticket_id}} updated: {{step1.subject}} → {{step1.status}}' }, ['ts']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // HR & People (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Google Forms Application → Formatter → Airtable + Email', category: 'HR & People',
    description: 'Process job applications from Google Forms, format applicant names, track in Airtable ATS, and send confirmation email.',
    tags: ['Google Forms', 'Airtable', 'Gmail', 'recruiting'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Google Forms', 'Airtable', 'Gmail'],
    steps: [
      T('google-forms', 'Google Forms', 'New Form Response', 'Triggers when a job application is submitted', {}, ['name', 'email', 'phone', 'resume_url', 'position', 'experience']),
      FM(2, 'Capitalize', '{{step1.name}}'),
      A(3, 'airtable', 'Airtable', 'Create Record', 'Adds applicant to ATS', { table: 'Applicants', fields: { name: '{{step2.output}}', email: '{{step1.email}}', position: '{{step1.position}}', experience: '{{step1.experience}}', status: 'New', resume: '{{step1.resume_url}}' } }, ['record_id']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends application confirmation', { to: '{{step1.email}}', subject: 'Application received: {{step1.position}}', body: 'Hi {{step2.output}}, we received your application for {{step1.position}}. We will review and get back to you within 5 business days.' }, ['message_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Notifies hiring team', { channel: '#hiring', message: 'New applicant for {{step1.position}}: {{step2.output}} ({{step1.experience}} years exp)' }, ['ts']),
    ] },

  { name: 'Calendly Interview → Google Calendar + Slack + Email Prep', category: 'HR & People',
    description: 'When a candidate books an interview via Calendly, create a detailed calendar event, notify the interview panel, and send prep materials.',
    tags: ['Calendly', 'Google Calendar', 'Slack', 'Gmail', 'interviewing'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Calendly', 'Google Calendar', 'Slack', 'Gmail'],
    steps: [
      T('calendly', 'Calendly', 'Invitee Created', 'Triggers when an interview is scheduled', {}, ['invitee_name', 'invitee_email', 'event_type', 'start_time', 'questions_and_answers']),
      A(2, 'google-calendar', 'Google Calendar', 'Create Detailed Event', 'Creates interview calendar block', { summary: 'Interview: {{step1.invitee_name}}', start: '{{step1.start_time}}', attendees: 'hiring-panel@company.com' }, ['event_id']),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Notifies interview panel', { channel: '#interviews', message: 'Interview scheduled: {{step1.invitee_name}} for {{step1.event_type}} at {{step1.start_time}}' }, ['ts']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends prep materials to interviewer', { to: 'hiring-panel@company.com', subject: 'Interview Prep: {{step1.invitee_name}}', body: 'Interview with {{step1.invitee_name}} at {{step1.start_time}}.\nResponses: {{step1.questions_and_answers}}' }, ['message_id']),
    ] },

  { name: 'Airtable Offer → Code Salary → Google Docs + Email', category: 'HR & People',
    description: 'When a candidate is moved to offer stage in Airtable, calculate compensation via code, generate offer letter, and email.',
    tags: ['Airtable', 'Google Docs', 'Gmail', 'offer-management'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Airtable', 'Google Docs', 'Gmail'],
    steps: [
      T('airtable', 'Airtable', 'New or Updated Record', 'Triggers when status changes to Offer', { table: 'Applicants', filter: { status: 'Offer' } }, ['name', 'email', 'position', 'level', 'location']),
      C(2, 'Calculate salary range, equity, and bonus based on position level and location'),
      A(3, 'google-docs', 'Google Docs', 'Create Document from Template', 'Generates offer letter from template', { template: 'Offer Letter Template', name: '{{step1.name}}', position: '{{step1.position}}', salary: '{{step2.output.salary}}' }, ['doc_url']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends offer details to hiring manager for review', { to: 'hiring-manager@company.com', subject: 'Offer ready for review: {{step1.name}} — {{step1.position}}', body: 'Offer letter: {{step3.doc_url}}\nSalary: {{step2.output.salary}}\nEquity: {{step2.output.equity}}' }, ['message_id']),
    ] },

  { name: 'Google Sheets Onboarding → Loop Tasks → Asana + Email', category: 'HR & People',
    description: 'Read onboarding checklist from Sheets, loop through each task, create Asana tasks, and send welcome email to new hire.',
    tags: ['Google Sheets', 'Asana', 'Gmail', 'onboarding'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Google Sheets', 'Asana', 'Gmail'],
    steps: [
      T('google-sheets', 'Google Sheets', 'New Spreadsheet Row', 'Triggers when a new hire is added to onboarding sheet', {}, ['name', 'email', 'start_date', 'department', 'manager', 'tasks']),
      L(2, 'Loop through each onboarding task for this department'),
      A(3, 'asana', 'Asana', 'Create Task', 'Creates onboarding task', { name: '{{step2.item.task}}', project: 'Onboarding', assignee: '{{step2.item.owner}}', due_on: '{{step2.item.due_date}}', notes: 'New hire: {{step1.name}}' }, ['task_id']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends welcome email', { to: '{{step1.email}}', subject: 'Welcome to the team, {{step1.name}}!', body: 'Hi {{step1.name}}, welcome! Your start date is {{step1.start_date}}. Your manager {{step1.manager}} will guide your onboarding.' }, ['message_id']),
    ] },

  { name: 'Slack PTO Request → Filter → Google Calendar + Sheets', category: 'HR & People',
    description: 'Capture PTO requests from Slack, filter for valid format, block Google Calendar, and log to PTO tracking sheet.',
    tags: ['Slack', 'Google Calendar', 'Google Sheets', 'pto-tracking'], trigger_type: 'Event', plan: 'Free', premium: [], accounts: ['Slack', 'Google Calendar', 'Google Sheets'],
    steps: [
      T('slack', 'Slack', 'New Message Posted to Channel', 'Monitors #pto-requests channel', { channel: '#pto-requests' }, ['text', 'user_name', 'user_email', 'timestamp']),
      F(2, 'Message contains date range pattern'),
      A(3, 'google-calendar', 'Google Calendar', 'Create Detailed Event', 'Blocks PTO on team calendar', { summary: 'PTO: {{step1.user_name}}', allDay: true, calendar: 'Team PTO' }, ['event_id']),
      A(4, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs PTO request', { employee: '{{step1.user_name}}', request: '{{step1.text}}', date_submitted: '{{zap_meta_human_now}}', status: 'Pending' }, ['row_id']),
    ] },

  { name: 'Typeform Exit Survey → Code Analyze → Sheets + Slack', category: 'HR & People',
    description: 'Process employee exit survey responses, analyze sentiment via code, log insights, and alert HR on concerning patterns.',
    tags: ['Typeform', 'Google Sheets', 'Slack', 'exit-survey'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Typeform', 'Google Sheets', 'Slack'],
    steps: [
      T('typeform', 'Typeform', 'New Entry', 'Triggers when an exit survey is submitted', {}, ['employee_name', 'department', 'tenure', 'reason', 'satisfaction_score', 'feedback']),
      C(2, 'Analyze sentiment of feedback text and flag concerning keywords'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs exit survey data', { employee: '{{step1.employee_name}}', department: '{{step1.department}}', score: '{{step1.satisfaction_score}}', sentiment: '{{step2.output.sentiment}}', reason: '{{step1.reason}}' }, ['row_id']),
      F(4, 'Satisfaction Score <= 3 OR sentiment is Negative'),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Alerts HR of concerning exit feedback', { channel: '#hr-alerts', message: 'Exit survey concern: {{step1.employee_name}} ({{step1.department}}) — Score: {{step1.satisfaction_score}}/10, Sentiment: {{step2.output.sentiment}}' }, ['ts']),
    ] },

  { name: 'Schedule → Airtable Review Cycle → Email Reminders', category: 'HR & People',
    description: 'Run scheduled performance review reminders by checking Airtable for upcoming reviews and sending email nudges to managers.',
    tags: ['Airtable', 'Gmail', 'performance-reviews'], trigger_type: 'Schedule', plan: 'Starter', premium: [], accounts: ['Airtable', 'Gmail'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Week', 'Runs weekly to check upcoming reviews', { day: 'Monday', time: '09:00' }, ['scheduled_time']),
      A(2, 'airtable', 'Airtable', 'Find Records', 'Finds reviews due this week', { table: 'Performance Reviews', formula: 'AND({Due Date} <= DATEADD(TODAY(), 7, "days"), {Status} = "Pending")' }, ['records']),
      L(3, 'Loop through each pending review'),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends review reminder to manager', { to: '{{step3.item.manager_email}}', subject: 'Performance review due: {{step3.item.employee_name}}', body: 'Your performance review for {{step3.item.employee_name}} is due by {{step3.item.due_date}}. Please complete it in the HR portal.' }, ['message_id']),
    ] },

  { name: 'Webhook Payroll → Formatter → Sheets + Slack + Email', category: 'HR & People',
    description: 'Process payroll webhook data, format currency amounts, log to Sheets, notify finance in Slack, and email pay stubs.',
    tags: ['Webhook', 'Google Sheets', 'Slack', 'Gmail', 'payroll'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Slack', 'Gmail'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives payroll processing webhook', {}, ['employee_name', 'employee_email', 'gross_pay', 'net_pay', 'deductions', 'pay_period']),
      FM(2, 'Currency', '{{step1.net_pay}}'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs payroll record', { employee: '{{step1.employee_name}}', gross: '{{step1.gross_pay}}', net: '{{step2.output}}', deductions: '{{step1.deductions}}', period: '{{step1.pay_period}}' }, ['row_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies finance of processed payroll', { channel: '#payroll', message: 'Payroll processed: {{step1.employee_name}} — {{step2.output}} ({{step1.pay_period}})' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Emails pay stub notification', { to: '{{step1.employee_email}}', subject: 'Pay stub available: {{step1.pay_period}}', body: 'Hi {{step1.employee_name}}, your pay stub for {{step1.pay_period}} is now available. Net pay: {{step2.output}}' }, ['message_id']),
    ] },

  { name: 'Google Forms Referral → Code Bonus Calc → Airtable + Slack', category: 'HR & People',
    description: 'Track employee referrals from Google Forms, calculate referral bonus tier via code, log in Airtable, and celebrate in Slack.',
    tags: ['Google Forms', 'Airtable', 'Slack', 'employee-referrals'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Google Forms', 'Airtable', 'Slack'],
    steps: [
      T('google-forms', 'Google Forms', 'New Form Response', 'Triggers when an employee referral is submitted', {}, ['referrer_name', 'referrer_email', 'candidate_name', 'candidate_email', 'position', 'relationship']),
      C(2, 'Determine referral bonus tier based on position level and department'),
      A(3, 'airtable', 'Airtable', 'Create Record', 'Logs referral in tracking table', { table: 'Referrals', fields: { referrer: '{{step1.referrer_name}}', candidate: '{{step1.candidate_name}}', position: '{{step1.position}}', bonus_tier: '{{step2.output}}', status: 'Submitted' } }, ['record_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Celebrates referral', { channel: '#team', message: '{{step1.referrer_name}} referred {{step1.candidate_name}} for {{step1.position}}! Bonus tier: {{step2.output}}' }, ['ts']),
    ] },

  { name: 'Notion Employee Directory → Paths → Welcome Kit', category: 'HR & People',
    description: 'When new employees are added to Notion directory, route through department paths for customized welcome kit and notifications.',
    tags: ['Notion', 'Gmail', 'Slack', 'Google Drive', 'onboarding'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Notion', 'Gmail', 'Slack', 'Google Drive'],
    steps: [
      T('notion', 'Notion', 'New Database Item', 'Triggers when a new employee is added', { database: 'Employee Directory' }, ['name', 'email', 'department', 'role', 'start_date', 'manager']),
      P(2, ['Engineering', 'Sales', 'Marketing', 'Operations']),
      A(3, 'google-drive', 'Google Drive', 'Copy File', 'Copies department-specific welcome doc', { file_id: '{{dept_welcome_template}}', name: 'Welcome Kit — {{step1.name}}' }, ['file_url']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends personalized welcome email', { to: '{{step1.email}}', subject: 'Welcome to {{step1.department}}, {{step1.name}}!', body: 'Your welcome kit: {{step3.file_url}}\nManager: {{step1.manager}}\nStart date: {{step1.start_date}}' }, ['message_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Announces new hire', { channel: '#general', message: 'Welcome {{step1.name}} to the {{step1.department}} team as {{step1.role}}! Starting {{step1.start_date}}' }, ['ts']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // DevOps (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'GitHub Issue → Filter Labels → Jira + Slack Priority', category: 'DevOps',
    description: 'Route GitHub issues through label filters to create properly prioritized Jira tickets and alert the right Slack channels.',
    tags: ['GitHub', 'Jira', 'Slack', 'issue-triage'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['GitHub', 'Jira', 'Slack'],
    steps: [
      T('github', 'GitHub', 'New Issue', 'Triggers when a new issue is created', {}, ['title', 'body', 'labels', 'user_login', 'html_url', 'number']),
      F(2, 'Labels contain "bug" or "critical"'),
      A(3, 'jira', 'Jira Software Cloud', 'Create Issue', 'Creates prioritized Jira ticket', { summary: '[GH-{{step1.number}}] {{step1.title}}', description: '{{step1.body}}\n\n{{step1.html_url}}', issuetype: 'Bug', priority: 'High' }, ['issue_key']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts dev team', { channel: '#bugs', message: 'Bug filed: {{step1.title}} by {{step1.user_login}} → {{step3.issue_key}}\n{{step1.html_url}}' }, ['ts']),
    ] },

  { name: 'GitHub PR Merged → Code Changelog → Slack + Notion', category: 'DevOps',
    description: 'When PRs merge to main, generate a changelog entry via code, announce in Slack, and update Notion release notes.',
    tags: ['GitHub', 'Slack', 'Notion', 'changelog'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['GitHub', 'Slack', 'Notion'],
    steps: [
      T('github', 'GitHub', 'New Pull Request', 'Triggers when a PR is closed/merged', { action: 'closed' }, ['title', 'body', 'user_login', 'merged', 'html_url', 'base_ref']),
      F(2, 'Merged is true AND base_ref is main'),
      C(3, 'Parse PR title and body to generate structured changelog entry with category tags'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Announces merge', { channel: '#deployments', message: 'Merged: {{step1.title}} by {{step1.user_login}}\n{{step3.output}}' }, ['ts']),
      A(5, 'notion', 'Notion', 'Create Database Item', 'Adds changelog entry', { database: 'Changelog', title: '{{step1.title}}', properties: { author: '{{step1.user_login}}', category: '{{step3.output.category}}', date: '{{zap_meta_human_now}}' } }, ['page_id']),
    ] },

  { name: 'Webhook Alert → Paths → PagerDuty + Slack + Email', category: 'DevOps',
    description: 'Route monitoring alerts through severity paths — critical goes to PagerDuty, warnings to Slack, info to email digest.',
    tags: ['Webhook', 'Slack', 'Gmail', 'incident-management'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Slack', 'Gmail'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives monitoring alert webhook', {}, ['service', 'severity', 'message', 'metric', 'value', 'threshold']),
      P(2, ['Critical', 'Warning', 'Info']),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Posts critical alert to incidents channel', { channel: '#incidents', message: 'CRITICAL: {{step1.service}} — {{step1.message}} ({{step1.metric}}: {{step1.value}} > {{step1.threshold}})' }, ['ts']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts warning to monitoring channel', { channel: '#monitoring', message: 'Warning: {{step1.service}} — {{step1.message}}' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Emails info-level alerts', { to: 'devops@company.com', subject: 'Info: {{step1.service}} alert', body: '{{step1.message}}\nMetric: {{step1.metric}} = {{step1.value}}' }, ['message_id']),
    ] },

  { name: 'GitHub Actions Failed → Formatter → Slack + Jira Bug', category: 'DevOps',
    description: 'When a GitHub Actions workflow fails, format the error details, post to Slack with context, and create a Jira bug ticket.',
    tags: ['GitHub', 'Slack', 'Jira', 'ci-cd'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['GitHub', 'Slack', 'Jira'],
    steps: [
      T('github', 'GitHub', 'New Repository Event', 'Triggers on workflow_run completed with failure', { event: 'workflow_run', conclusion: 'failure' }, ['workflow_name', 'head_branch', 'actor', 'html_url', 'repository']),
      FM(2, 'Truncate', '{{step1.workflow_name}}'),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Alerts CI/CD channel', { channel: '#ci-cd', message: 'Build FAILED: {{step2.output}} on {{step1.head_branch}} by {{step1.actor}}\n{{step1.html_url}}' }, ['ts']),
      A(4, 'jira', 'Jira Software Cloud', 'Create Issue', 'Creates build failure ticket', { summary: 'Build failure: {{step2.output}} ({{step1.head_branch}})', description: 'CI failed for {{step1.repository}}\nBranch: {{step1.head_branch}}\nActor: {{step1.actor}}\n{{step1.html_url}}', issuetype: 'Bug' }, ['issue_key']),
    ] },

  { name: 'Linear Issue → Code Sprint Calc → Slack + Sheets', category: 'DevOps',
    description: 'When Linear issues are completed, calculate sprint velocity via code, update Sheets tracker, and post to Slack.',
    tags: ['Linear', 'Google Sheets', 'Slack', 'sprint-tracking'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Linear', 'Google Sheets', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives Linear issue completion webhook', {}, ['issue_id', 'title', 'assignee', 'estimate', 'cycle', 'completed_at']),
      C(2, 'Calculate sprint velocity points and running total for current cycle'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs completion to sprint tracker', { issue: '{{step1.title}}', assignee: '{{step1.assignee}}', points: '{{step1.estimate}}', velocity: '{{step2.output}}', date: '{{step1.completed_at}}' }, ['row_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts sprint update', { channel: '#sprint', message: 'Completed: {{step1.title}} ({{step1.estimate}} pts) by {{step1.assignee}} — Sprint velocity: {{step2.output}}' }, ['ts']),
    ] },

  { name: 'Schedule Daily → GitHub Stats Code → Slack Report', category: 'DevOps',
    description: 'Run a daily scheduled report that compiles GitHub activity stats via code and posts a development activity summary.',
    tags: ['GitHub', 'Slack', 'dev-reporting'], trigger_type: 'Schedule', plan: 'Free', premium: [], accounts: ['Slack'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Day', 'Runs daily at 9am for dev report', { time: '09:00' }, ['scheduled_time']),
      A(2, 'webhook', 'Webhooks by Zapier', 'GET', 'Fetches GitHub API stats', { url: 'https://api.github.com/repos/org/repo/stats/contributors' }, ['data']),
      C(3, 'Parse GitHub stats into daily activity summary — commits, PRs, issues'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts daily dev report', { channel: '#engineering', message: 'Daily Dev Report:\n{{step3.output}}' }, ['ts']),
    ] },

  { name: 'Webhook Deploy → Storage Version → Slack + Email', category: 'DevOps',
    description: 'Track deployments via webhook, store version info in Zapier Storage, announce in Slack, and email release notes.',
    tags: ['Webhook', 'Slack', 'Gmail', 'deployment-tracking'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Slack', 'Gmail'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives deployment completion webhook', {}, ['version', 'environment', 'deployer', 'changelog', 'status']),
      ST(2, 'Store latest deployed version per environment'),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Announces deployment', { channel: '#deployments', message: 'Deployed v{{step1.version}} to {{step1.environment}} by {{step1.deployer}}\n{{step1.changelog}}' }, ['ts']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Emails release notes to stakeholders', { to: 'team@company.com', subject: 'Deployed v{{step1.version}} to {{step1.environment}}', body: 'Changelog:\n{{step1.changelog}}\n\nDeployed by: {{step1.deployer}}' }, ['message_id']),
    ] },

  { name: 'GitHub Release → Loop Assets → Google Drive + Slack', category: 'DevOps',
    description: 'When a GitHub release is published, loop through release assets, upload to Google Drive, and announce with download links.',
    tags: ['GitHub', 'Google Drive', 'Slack', 'release-management'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['GitHub', 'Google Drive', 'Slack'],
    steps: [
      T('github', 'GitHub', 'New Release', 'Triggers when a new release is published', {}, ['tag_name', 'name', 'body', 'assets', 'html_url']),
      L(2, 'Loop through each release asset file'),
      A(3, 'google-drive', 'Google Drive', 'Upload File', 'Uploads each asset to releases folder', { file: '{{step2.item.browser_download_url}}', name: '{{step2.item.name}}', folder: 'Releases/{{step1.tag_name}}' }, ['file_url']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Announces release', { channel: '#releases', message: 'Released {{step1.tag_name}}: {{step1.name}}\n{{step1.body}}\nAssets: {{step1.html_url}}' }, ['ts']),
    ] },

  { name: 'Webhook Error Log → Filter Rate → Digest → Slack', category: 'DevOps',
    description: 'Receive error log webhooks, filter out noise, collect into a digest, and post aggregated error summary to Slack.',
    tags: ['Webhook', 'Slack', 'error-monitoring'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives error log events', {}, ['error_type', 'message', 'stack_trace', 'service', 'timestamp', 'count']),
      F(2, 'Error count >= 5 (filter noise)'),
      DG(3, 'Collect error entries for hourly Slack digest'),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts error digest', { channel: '#error-digest', message: 'Error Digest:\n{{step3.digest}}' }, ['ts']),
    ] },

  { name: 'Jira Sprint Complete → Code Metrics → Notion + Slack', category: 'DevOps',
    description: 'When a Jira sprint is completed, calculate sprint metrics via code, create a Notion retrospective page, and post summary.',
    tags: ['Jira', 'Notion', 'Slack', 'sprint-retrospective'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Jira', 'Notion', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives Jira sprint completion webhook', {}, ['sprint_name', 'total_issues', 'completed', 'incomplete', 'story_points', 'team']),
      C(2, 'Calculate sprint metrics — completion rate, velocity, carryover ratio'),
      A(3, 'notion', 'Notion', 'Create Database Item', 'Creates sprint retrospective page', { database: 'Sprint Retros', title: '{{step1.sprint_name}} Retro', properties: { completion_rate: '{{step2.output.completion_rate}}', velocity: '{{step2.output.velocity}}', team: '{{step1.team}}' } }, ['page_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts sprint summary', { channel: '#engineering', message: 'Sprint "{{step1.sprint_name}}" complete:\nDone: {{step1.completed}}/{{step1.total_issues}}\nVelocity: {{step2.output.velocity}} pts\nCompletion: {{step2.output.completion_rate}}%' }, ['ts']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // Content & Creative (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Notion Content → OpenAI SEO → Google Docs + Slack', category: 'Content & Creative',
    description: 'When Notion content is ready for review, use OpenAI to generate SEO metadata, create a Google Doc brief, and notify the team.',
    tags: ['Notion', 'OpenAI', 'Google Docs', 'Slack', 'seo'], trigger_type: 'Event', plan: 'Professional', premium: ['openai'], accounts: ['Notion', 'OpenAI', 'Google Docs', 'Slack'],
    steps: [
      T('notion', 'Notion', 'Updated Database Item', 'Triggers when content status changes to Review', { filter: { status: 'Ready for Review' } }, ['title', 'body', 'author', 'category', 'target_keywords']),
      A(2, 'openai', 'OpenAI', 'Send Prompt', 'Generates SEO title, meta description, and slug', { prompt: 'Generate SEO metadata for: {{step1.title}}. Keywords: {{step1.target_keywords}}. Return JSON with title, meta_description, slug, focus_keyword.', model: 'gpt-4' }, ['text']),
      A(3, 'google-docs', 'Google Docs', 'Create Document from Text', 'Creates content review doc', { title: 'Content Review: {{step1.title}}', body: 'SEO Metadata:\n{{step2.text}}\n\nContent:\n{{step1.body}}' }, ['doc_url']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies content team', { channel: '#content-review', message: 'Content ready for review: "{{step1.title}}" by {{step1.author}}\nDoc: {{step3.doc_url}}' }, ['ts']),
    ] },

  { name: 'Airtable Asset Upload → Formatter → Google Drive + Slack', category: 'Content & Creative',
    description: 'When creative assets are logged in Airtable, format file names, organize in Google Drive folders, and notify the creative team.',
    tags: ['Airtable', 'Google Drive', 'Slack', 'asset-management'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Airtable', 'Google Drive', 'Slack'],
    steps: [
      T('airtable', 'Airtable', 'New Record', 'Triggers when a new asset is logged', { table: 'Creative Assets' }, ['asset_name', 'asset_url', 'type', 'campaign', 'version', 'creator']),
      FM(2, 'Replace', '{{step1.asset_name}}'),
      A(3, 'google-drive', 'Google Drive', 'Upload File', 'Uploads to organized campaign folder', { file: '{{step1.asset_url}}', name: '{{step2.output}}_v{{step1.version}}', folder: 'Campaigns/{{step1.campaign}}' }, ['file_url']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Announces new asset', { channel: '#creative', message: 'New {{step1.type}} asset: {{step2.output}} v{{step1.version}} for {{step1.campaign}} by {{step1.creator}}\n{{step3.file_url}}' }, ['ts']),
    ] },

  { name: 'Webhook CMS Publish → Paths → Social + Email + Slack', category: 'Content & Creative',
    description: 'When content is published via CMS webhook, route through content-type paths for targeted social, email, and Slack distribution.',
    tags: ['Webhook', 'Slack', 'Mailchimp', 'content-distribution'], trigger_type: 'Webhook', plan: 'Starter', premium: [], accounts: ['Slack', 'Mailchimp'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives CMS publish event', {}, ['title', 'url', 'type', 'excerpt', 'author', 'featured_image']),
      P(2, ['Blog Post', 'Case Study', 'Product Update']),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Posts to content channel', { channel: '#content-published', message: 'Published {{step1.type}}: "{{step1.title}}" by {{step1.author}}\n{{step1.url}}' }, ['ts']),
      A(4, 'mailchimp', 'Mailchimp', 'Create Campaign', 'Creates targeted email campaign', { subject: 'New: {{step1.title}}', preview_text: '{{step1.excerpt}}', segment: '{{step1.type}}-subscribers' }, ['campaign_id']),
    ] },

  { name: 'ClickUp Content Task → Delay → Reminder + Slack', category: 'Content & Creative',
    description: 'When a content task deadline approaches, set a delay until 2 days before due date, then send reminders via email and Slack.',
    tags: ['ClickUp', 'Gmail', 'Slack', 'deadline-reminders'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['ClickUp', 'Gmail', 'Slack'],
    steps: [
      T('clickup', 'ClickUp', 'New Task', 'Triggers when a content task is created', { list: 'Content Pipeline' }, ['task_name', 'assignee_email', 'assignee_name', 'due_date', 'description']),
      D(2, 'Until 2 days before due_date'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends deadline reminder', { to: '{{step1.assignee_email}}', subject: 'Deadline approaching: {{step1.task_name}}', body: 'Hi {{step1.assignee_name}}, your content piece "{{step1.task_name}}" is due on {{step1.due_date}}. Please ensure it is ready for review.' }, ['message_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts reminder to content channel', { channel: '#content-deadlines', message: 'Deadline in 2 days: "{{step1.task_name}}" — {{step1.assignee_name}}' }, ['ts']),
    ] },

  { name: 'Google Sheets Editorial → Loop → Trello + Slack', category: 'Content & Creative',
    description: 'Read editorial calendar from Sheets, loop through upcoming articles, create Trello cards for each, and notify the editorial team.',
    tags: ['Google Sheets', 'Trello', 'Slack', 'editorial-calendar'], trigger_type: 'Schedule', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Trello', 'Slack'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Week', 'Runs Monday to prep weekly content', { day: 'Monday', time: '08:00' }, ['scheduled_time']),
      A(2, 'google-sheets', 'Google Sheets', 'Get Many Spreadsheet Rows', 'Gets this week articles from editorial calendar', { spreadsheet: 'Editorial Calendar', filter: 'week = this_week' }, ['rows']),
      L(3, 'Loop through each article for the week'),
      A(4, 'trello', 'Trello', 'Create Card', 'Creates Trello card per article', { name: '{{step3.item.title}}', list: 'This Week', desc: 'Author: {{step3.item.author}}\nDeadline: {{step3.item.deadline}}\nTopic: {{step3.item.topic}}' }, ['card_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Posts weekly content plan', { channel: '#editorial', message: 'This week content lineup ready! {{step2.rows.length}} articles queued in Trello.' }, ['ts']),
    ] },

  { name: 'Typeform Creative Brief → OpenAI Expand → Notion + Email', category: 'Content & Creative',
    description: 'Process creative brief submissions from Typeform, use OpenAI to expand into a full brief, save to Notion, and email the team.',
    tags: ['Typeform', 'OpenAI', 'Notion', 'Gmail', 'creative-briefs'], trigger_type: 'Webhook', plan: 'Professional', premium: ['openai'], accounts: ['Typeform', 'OpenAI', 'Notion', 'Gmail'],
    steps: [
      T('typeform', 'Typeform', 'New Entry', 'Triggers when a creative brief form is submitted', {}, ['project_name', 'objective', 'audience', 'tone', 'deliverables', 'deadline', 'requester_email']),
      A(2, 'openai', 'OpenAI', 'Send Prompt', 'Expands brief into detailed creative document', { prompt: 'Expand this into a detailed creative brief:\nProject: {{step1.project_name}}\nObjective: {{step1.objective}}\nAudience: {{step1.audience}}\nTone: {{step1.tone}}\nDeliverables: {{step1.deliverables}}', model: 'gpt-4' }, ['text']),
      A(3, 'notion', 'Notion', 'Create Database Item', 'Saves expanded brief to Notion', { database: 'Creative Briefs', title: '{{step1.project_name}}', properties: { deadline: '{{step1.deadline}}', requester: '{{step1.requester_email}}' }, content: '{{step2.text}}' }, ['page_url']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends brief to creative team', { to: 'creative-team@company.com', subject: 'New Creative Brief: {{step1.project_name}}', body: 'A new creative brief has been generated:\n{{step3.page_url}}\n\nDeadline: {{step1.deadline}}' }, ['message_id']),
    ] },

  { name: 'Google Drive Upload → Filter Images → Code Resize → Airtable', category: 'Content & Creative',
    description: 'When files are uploaded to Drive, filter for images only, process metadata via code, and catalog in Airtable asset library.',
    tags: ['Google Drive', 'Airtable', 'image-management'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['Google Drive', 'Airtable'],
    steps: [
      T('google-drive', 'Google Drive', 'New File in Folder', 'Triggers when a file is uploaded to creative assets', { folder: 'Creative Assets' }, ['file_name', 'mime_type', 'file_url', 'owner', 'file_size']),
      F(2, 'MIME type starts with image/'),
      C(3, 'Extract image dimensions and generate thumbnail URL from file metadata'),
      A(4, 'airtable', 'Airtable', 'Create Record', 'Catalogs image in asset library', { table: 'Image Library', fields: { name: '{{step1.file_name}}', url: '{{step1.file_url}}', dimensions: '{{step3.output.dimensions}}', size: '{{step1.file_size}}', uploaded_by: '{{step1.owner}}' } }, ['record_id']),
    ] },

  { name: 'Slack Content Idea → Formatter → Notion + Airtable', category: 'Content & Creative',
    description: 'Capture content ideas from a Slack channel, format the text, and save to both Notion idea backlog and Airtable content pipeline.',
    tags: ['Slack', 'Notion', 'Airtable', 'idea-capture'], trigger_type: 'Event', plan: 'Free', premium: [], accounts: ['Slack', 'Notion', 'Airtable'],
    steps: [
      T('slack', 'Slack', 'New Message Posted to Channel', 'Monitors #content-ideas for new ideas', { channel: '#content-ideas' }, ['text', 'user_name', 'timestamp']),
      FM(2, 'Capitalize', '{{step1.text}}'),
      A(3, 'notion', 'Notion', 'Create Database Item', 'Adds to idea backlog', { database: 'Content Ideas', title: '{{step2.output}}', properties: { submitter: '{{step1.user_name}}', status: 'New', date: '{{zap_meta_human_now}}' } }, ['page_id']),
      A(4, 'airtable', 'Airtable', 'Create Record', 'Adds to content pipeline', { table: 'Content Pipeline', fields: { idea: '{{step2.output}}', submitter: '{{step1.user_name}}', status: 'Backlog' } }, ['record_id']),
    ] },

  { name: 'Webhook Video Published → Code Metadata → Sheets + Discord', category: 'Content & Creative',
    description: 'When a video is published via webhook, extract metadata via code, log to tracking sheet, and announce on Discord.',
    tags: ['Webhook', 'Google Sheets', 'Discord', 'video-management'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Google Sheets', 'Discord'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives video publish notification', {}, ['video_title', 'video_url', 'duration', 'thumbnail', 'channel', 'description']),
      C(2, 'Extract video metadata — parse duration, generate embed code, format description'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs video to content tracker', { title: '{{step1.video_title}}', url: '{{step1.video_url}}', duration: '{{step2.output.duration_formatted}}', published: '{{zap_meta_human_now}}' }, ['row_id']),
      A(4, 'discord', 'Discord', 'Send Channel Message', 'Announces video on Discord', { channel: '#new-videos', message: 'New video: {{step1.video_title}} ({{step2.output.duration_formatted}})\n{{step1.video_url}}' }, ['message_id']),
    ] },

  { name: 'Schedule Monthly → Airtable Content Audit → Email Report', category: 'Content & Creative',
    description: 'Run a monthly content audit by checking Airtable for stale content, compile a report via code, and email to the content lead.',
    tags: ['Airtable', 'Gmail', 'content-audit'], trigger_type: 'Schedule', plan: 'Starter', premium: [], accounts: ['Airtable', 'Gmail'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Month', 'Runs on 1st of each month for content audit', { day: '1', time: '10:00' }, ['scheduled_time']),
      A(2, 'airtable', 'Airtable', 'Find Records', 'Finds content not updated in 90 days', { table: 'Published Content', formula: 'DATETIME_DIFF(TODAY(), {Last Updated}, "days") > 90' }, ['records']),
      C(3, 'Generate content audit report — total stale, by category, recommended actions'),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends monthly content audit', { to: 'content-lead@company.com', subject: 'Monthly Content Audit Report', body: '{{step3.output}}' }, ['message_id']),
    ] },

  // ═══════════════════════════════════════════════════════════════════════════
  // E-commerce (10)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'Shopify New Order → Formatter → Sheets + Slack + Email', category: 'E-commerce',
    description: 'Process new Shopify orders with currency formatting, log to fulfillment sheet, notify operations, and confirm to customer.',
    tags: ['Shopify', 'Google Sheets', 'Slack', 'Gmail', 'order-processing'], trigger_type: 'Event', plan: 'Professional', premium: ['shopify'], accounts: ['Shopify', 'Google Sheets', 'Slack', 'Gmail'],
    steps: [
      T('shopify', 'Shopify', 'New Order', 'Triggers when a new order is placed', {}, ['order_number', 'customer_email', 'customer_name', 'total_price', 'line_items', 'shipping_address']),
      FM(2, 'Currency', '{{step1.total_price}}'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs order to fulfillment sheet', { order: '{{step1.order_number}}', customer: '{{step1.customer_name}}', total: '{{step2.output}}', items: '{{step1.line_items}}', address: '{{step1.shipping_address}}' }, ['row_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Notifies operations', { channel: '#orders', message: 'New order #{{step1.order_number}}: {{step1.customer_name}} — {{step2.output}}' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Sends order confirmation', { to: '{{step1.customer_email}}', subject: 'Order confirmed: #{{step1.order_number}}', body: 'Hi {{step1.customer_name}}, your order of {{step2.output}} has been confirmed.' }, ['message_id']),
    ] },

  { name: 'Shopify Abandoned Cart → Delay → Email Recovery', category: 'E-commerce',
    description: 'When a Shopify checkout is abandoned, wait 4 hours then send a personalized recovery email with the cart contents.',
    tags: ['Shopify', 'Gmail', 'abandoned-cart'], trigger_type: 'Event', plan: 'Professional', premium: ['shopify'], accounts: ['Shopify', 'Gmail'],
    steps: [
      T('shopify', 'Shopify', 'New Abandoned Cart', 'Triggers when a checkout is abandoned', {}, ['customer_email', 'customer_name', 'cart_items', 'total_price', 'abandoned_url']),
      D(2, '4 hours'),
      FM(3, 'Currency', '{{step1.total_price}}'),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Sends cart recovery email', { to: '{{step1.customer_email}}', subject: 'You left something in your cart!', body: 'Hi {{step1.customer_name}}, you left items worth {{step3.output}} in your cart. Complete your purchase: {{step1.abandoned_url}}' }, ['message_id']),
    ] },

  { name: 'Stripe Payment → Shopify Fulfillment → Slack + Email', category: 'E-commerce',
    description: 'When Stripe confirms payment, trigger Shopify fulfillment, post to operations Slack, and email shipping notification.',
    tags: ['Stripe', 'Shopify', 'Slack', 'Gmail', 'fulfillment'], trigger_type: 'Event', plan: 'Professional', premium: ['stripe', 'shopify'], accounts: ['Stripe', 'Shopify', 'Slack', 'Gmail'],
    steps: [
      T('stripe', 'Stripe', 'New Payment', 'Triggers when payment is confirmed', {}, ['customer_email', 'customer_name', 'amount', 'metadata_order_id']),
      A(2, 'shopify', 'Shopify', 'Create Fulfillment', 'Initiates fulfillment for the order', { order_id: '{{step1.metadata_order_id}}', notify_customer: true }, ['fulfillment_id', 'tracking_number']),
      A(3, 'slack', 'Slack', 'Send Channel Message', 'Notifies fulfillment team', { channel: '#fulfillment', message: 'Paid + Fulfilling: Order {{step1.metadata_order_id}} for {{step1.customer_name}}' }, ['ts']),
      A(4, 'gmail', 'Gmail', 'Send Email', 'Emails shipping details', { to: '{{step1.customer_email}}', subject: 'Your order is on its way!', body: 'Hi {{step1.customer_name}}, your order has been shipped. Tracking: {{step2.tracking_number}}' }, ['message_id']),
    ] },

  { name: 'WooCommerce Order → Code Inventory → Paths → Restock Alert', category: 'E-commerce',
    description: 'Process WooCommerce orders, check inventory levels via code, and route through paths for normal fulfillment vs restock alerts.',
    tags: ['WooCommerce', 'Slack', 'Google Sheets', 'inventory'], trigger_type: 'Event', plan: 'Starter', premium: [], accounts: ['WooCommerce', 'Slack', 'Google Sheets'],
    steps: [
      T('woocommerce', 'WooCommerce', 'New Order', 'Triggers when a new order is placed', {}, ['order_number', 'line_items', 'total', 'customer_email', 'billing_name']),
      C(2, 'Check inventory levels for each line item and flag items below reorder threshold'),
      P(3, ['Normal Stock', 'Low Stock Alert']),
      A(4, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs order', { order: '{{step1.order_number}}', customer: '{{step1.billing_name}}', total: '{{step1.total}}', inventory_status: '{{step2.output.status}}' }, ['row_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Alerts on low stock', { channel: '#inventory-alerts', message: 'LOW STOCK ALERT: {{step2.output.low_items}} items need reordering after order #{{step1.order_number}}' }, ['ts']),
    ] },

  { name: 'Shopify Review → Filter Stars → Paths → Slack + Email', category: 'E-commerce',
    description: 'Process product reviews, filter by star rating, then route positive reviews to marketing and negative ones to support.',
    tags: ['Shopify', 'Slack', 'Gmail', 'review-management'], trigger_type: 'Webhook', plan: 'Professional', premium: ['shopify'], accounts: ['Shopify', 'Slack', 'Gmail'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives Shopify product review webhook', {}, ['customer_name', 'customer_email', 'product_name', 'rating', 'review_text']),
      F(2, 'Rating is not null'),
      P(3, ['5-Star', '3-4 Star', '1-2 Star']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Posts 5-star reviews to marketing', { channel: '#reviews', message: '5-star review for {{step1.product_name}} by {{step1.customer_name}}: "{{step1.review_text}}"' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Reaches out on negative reviews', { to: '{{step1.customer_email}}', subject: 'We want to make it right', body: 'Hi {{step1.customer_name}}, we noticed your review of {{step1.product_name}}. We would love to help resolve any issues.' }, ['message_id']),
    ] },

  { name: 'Shopify Refund → Formatter → Sheets + Slack + Email', category: 'E-commerce',
    description: 'Process Shopify refunds with formatted amounts, track in a refund sheet, alert finance, and confirm to the customer.',
    tags: ['Shopify', 'Google Sheets', 'Slack', 'Gmail', 'refund-processing'], trigger_type: 'Event', plan: 'Professional', premium: ['shopify'], accounts: ['Shopify', 'Google Sheets', 'Slack', 'Gmail'],
    steps: [
      T('shopify', 'Shopify', 'New Refund', 'Triggers when a refund is processed', {}, ['order_number', 'customer_email', 'customer_name', 'refund_amount', 'reason']),
      FM(2, 'Currency', '{{step1.refund_amount}}'),
      A(3, 'google-sheets', 'Google Sheets', 'Create Spreadsheet Row', 'Logs refund', { order: '{{step1.order_number}}', customer: '{{step1.customer_name}}', amount: '{{step2.output}}', reason: '{{step1.reason}}', date: '{{zap_meta_human_now}}' }, ['row_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Alerts finance of refund', { channel: '#refunds', message: 'Refund processed: #{{step1.order_number}} — {{step2.output}} ({{step1.reason}})' }, ['ts']),
      A(5, 'gmail', 'Gmail', 'Send Email', 'Confirms refund to customer', { to: '{{step1.customer_email}}', subject: 'Refund processed: Order #{{step1.order_number}}', body: 'Hi {{step1.customer_name}}, your refund of {{step2.output}} has been processed and will appear in 5-10 business days.' }, ['message_id']),
    ] },

  { name: 'Shopify Inventory → Loop Products → Airtable + Slack', category: 'E-commerce',
    description: 'Schedule weekly inventory sync from Shopify, loop through products, update Airtable inventory tracker, and post summary.',
    tags: ['Shopify', 'Airtable', 'Slack', 'inventory-sync'], trigger_type: 'Schedule', plan: 'Professional', premium: ['shopify'], accounts: ['Shopify', 'Airtable', 'Slack'],
    steps: [
      T('schedule', 'Schedule by Zapier', 'Every Week', 'Runs weekly inventory sync', { day: 'Sunday', time: '06:00' }, ['scheduled_time']),
      A(2, 'shopify', 'Shopify', 'Find Product', 'Gets all active products with inventory', { status: 'active' }, ['products']),
      L(3, 'Loop through each product to update inventory records'),
      A(4, 'airtable', 'Airtable', 'Update Record', 'Updates product inventory in Airtable', { table: 'Inventory', fields: { product: '{{step3.item.title}}', quantity: '{{step3.item.inventory_quantity}}', last_synced: '{{zap_meta_human_now}}' } }, ['record_id']),
      A(5, 'slack', 'Slack', 'Send Channel Message', 'Posts inventory sync summary', { channel: '#inventory', message: 'Weekly inventory sync complete. Products updated in Airtable.' }, ['ts']),
    ] },

  { name: 'Google Sheets Price Update → Code Margin → Shopify + Slack', category: 'E-commerce',
    description: 'When prices are updated in a Google Sheet, calculate margins via code, update Shopify product prices, and notify the team.',
    tags: ['Google Sheets', 'Shopify', 'Slack', 'pricing'], trigger_type: 'Event', plan: 'Professional', premium: ['shopify'], accounts: ['Google Sheets', 'Shopify', 'Slack'],
    steps: [
      T('google-sheets', 'Google Sheets', 'New or Updated Spreadsheet Row', 'Triggers when a price row is updated', {}, ['product_id', 'product_name', 'cost', 'new_price', 'old_price']),
      C(2, 'Calculate margin percentage, compare with old price, flag if margin below 20%'),
      A(3, 'shopify', 'Shopify', 'Update Product', 'Updates product price in Shopify', { product_id: '{{step1.product_id}}', variants: [{ price: '{{step1.new_price}}' }] }, ['product_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Announces price change', { channel: '#pricing', message: 'Price updated: {{step1.product_name}} ${{step1.old_price}} → ${{step1.new_price}} (Margin: {{step2.output.margin}}%)' }, ['ts']),
    ] },

  { name: 'Webhook Shipping Update → Storage Track → Email + Slack', category: 'E-commerce',
    description: 'Track shipping updates via webhook, store latest status in Zapier Storage, email customer updates, and notify operations.',
    tags: ['Webhook', 'Gmail', 'Slack', 'shipping-tracking'], trigger_type: 'Webhook', plan: 'Free', premium: [], accounts: ['Gmail', 'Slack'],
    steps: [
      T('webhook', 'Webhooks by Zapier', 'Catch Hook', 'Receives shipping carrier webhook', {}, ['tracking_number', 'status', 'location', 'estimated_delivery', 'customer_email', 'order_id']),
      ST(2, 'Store latest shipping status for this tracking number'),
      A(3, 'gmail', 'Gmail', 'Send Email', 'Sends shipping update to customer', { to: '{{step1.customer_email}}', subject: 'Shipping update: Order #{{step1.order_id}}', body: 'Your order is {{step1.status}} at {{step1.location}}. Estimated delivery: {{step1.estimated_delivery}}' }, ['message_id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Logs shipping update', { channel: '#shipping', message: 'Order #{{step1.order_id}}: {{step1.status}} at {{step1.location}} (ETA: {{step1.estimated_delivery}})' }, ['ts']),
    ] },

  { name: 'Shopify New Customer → HubSpot + Mailchimp + Slack', category: 'E-commerce',
    description: 'When a new Shopify customer is created, sync to HubSpot CRM, add to Mailchimp customer list, and celebrate in Slack.',
    tags: ['Shopify', 'HubSpot', 'Mailchimp', 'Slack', 'customer-sync'], trigger_type: 'Event', plan: 'Professional', premium: ['shopify', 'hubspot'], accounts: ['Shopify', 'HubSpot', 'Mailchimp', 'Slack'],
    steps: [
      T('shopify', 'Shopify', 'New Customer', 'Triggers when a new customer account is created', {}, ['email', 'first_name', 'last_name', 'phone', 'total_spent', 'orders_count']),
      A(2, 'hubspot', 'HubSpot', 'Create Contact', 'Syncs customer to CRM', { email: '{{step1.email}}', firstname: '{{step1.first_name}}', lastname: '{{step1.last_name}}', phone: '{{step1.phone}}', source: 'Shopify' }, ['contact_id']),
      A(3, 'mailchimp', 'Mailchimp', 'Add/Update Subscriber', 'Adds to customer email list', { email: '{{step1.email}}', first_name: '{{step1.first_name}}', tags: ['shopify-customer'] }, ['id']),
      A(4, 'slack', 'Slack', 'Send Channel Message', 'Welcomes new customer', { channel: '#customers', message: 'New customer: {{step1.first_name}} {{step1.last_name}} ({{step1.email}})' }, ['ts']),
    ] },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ManageAI — Zapier Template Seeder (Rich Format)');
  console.log(`  Templates to seed: ${TEMPLATES.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Clear existing Zapier seed records
  const { error: delErr, count: delCount } = await supabase
    .from('templates')
    .delete({ count: 'exact' })
    .eq('source', SOURCE);
  if (delErr) {
    console.warn(`Warning — could not clear existing records: ${delErr.message}`);
  } else {
    console.log(`Cleared ${delCount ?? 0} existing Zapier seed records`);
  }

  // Build DB rows
  const rows = TEMPLATES.map((t) => ({
    name: t.name,
    platform: 'zapier' as const,
    category: t.category,
    description: t.description,
    node_count: t.steps.length,
    tags: t.tags,
    complexity: t.steps.length <= 3 ? 'Beginner' : t.steps.length <= 7 ? 'Intermediate' : 'Advanced',
    trigger_type: t.trigger_type,
    json_template: {
      name: t.name,
      description: t.description,
      steps: t.steps,
      estimated_task_usage: `${t.steps.length} tasks per run`,
      required_zapier_plan: t.plan,
      premium_apps_used: t.premium,
      required_accounts: t.accounts,
      setup_time_estimate: `${t.steps.length * 3}-${t.steps.length * 5} minutes`,
      transfer_instructions: 'Create a new Zap in your Zapier account. Follow the step-by-step setup instructions for each step.',
    },
    source: SOURCE,
    source_repo: 'seed:manageai/zapier-templates',
    source_filename: `zapier/${t.category}/${t.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`,
  }));

  // Insert in batches
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('templates').insert(batch);
    if (error) {
      errors++;
      console.error(`Batch error: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  // Final count
  const { count: total } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'zapier');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Zapier templates inserted: ${inserted}/${rows.length}`);
  console.log(`  Batch errors: ${errors}`);
  console.log(`  Total Zapier in DB: ${total ?? 0}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Category breakdown
  const cats: Record<string, number> = {};
  for (const r of rows) cats[r.category] = (cats[r.category] ?? 0) + 1;
  console.log('Category breakdown:');
  for (const [cat, count] of Object.entries(cats)) {
    console.log(`  ${cat.padEnd(25)} ${count}`);
  }

  // Verify step type distribution
  const stepTypes: Record<string, number> = {};
  for (const t of TEMPLATES) {
    for (const s of t.steps) {
      const key = s.app === 'filter' ? 'Filter' : s.app === 'formatter' ? 'Formatter' : s.app === 'paths' ? 'Paths' : s.app === 'code' ? 'Code' : s.app === 'delay' ? 'Delay' : s.app === 'looping' ? 'Looping' : s.app === 'digest' ? 'Digest' : s.app === 'storage' ? 'Storage' : 'App';
      stepTypes[key] = (stepTypes[key] ?? 0) + 1;
    }
  }
  console.log('\nStep type distribution:');
  for (const [type, count] of Object.entries(stepTypes)) {
    console.log(`  ${type.padEnd(15)} ${count}`);
  }
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(1); });
