#!/usr/bin/env tsx
/**
 * Seed Zapier (platform: "zapier") templates into Supabase `templates` table.
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
  type: 'trigger' | 'filter' | 'action' | 'path';
  app: string;
  event: string;
  params?: Record<string, unknown>;
};

type SeedTemplate = {
  name: string;
  category: string;
  description: string;
  tags: string[];
  trigger_type: string;
  steps: ZapStep[];
};

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES: SeedTemplate[] = [

  // ── Sales & CRM ─────────────────────────────────────────────────────────────
  {
    name: 'New Salesforce Lead → Slack Notification + Gmail',
    category: 'Sales & CRM',
    description: 'Instantly notify your sales team in Slack when a new Salesforce lead is created and send the lead an automated welcome email.',
    tags: ['Salesforce', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Salesforce', event: 'New Lead', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sales', message: 'New lead: {{lead_name}} from {{company}} — {{email}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Welcome! Someone from our team will be in touch', body: 'Hi {{first_name}}, thanks for your interest!' } },
    ],
  },
  {
    name: 'HubSpot Deal Stage Changed → Slack + Google Sheets',
    category: 'Sales & CRM',
    description: 'Track every HubSpot deal stage change in real time by logging to Google Sheets and alerting your sales team in Slack.',
    tags: ['HubSpot', 'Slack', 'Google Sheets'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'HubSpot', event: 'Deal Stage Changed', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { spreadsheet: 'CRM Pipeline', deal: '{{deal_name}}', stage: '{{new_stage}}', value: '{{deal_amount}}', date: '{{now}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sales', message: '📊 Deal moved: {{deal_name}} → {{new_stage}} (${{deal_amount}})' } },
    ],
  },
  {
    name: 'Pipedrive New Deal → Email + HubSpot Contact',
    category: 'Sales & CRM',
    description: 'When a new deal is created in Pipedrive, create a HubSpot contact for the associated person and send a personalized sales intro email.',
    tags: ['Pipedrive', 'HubSpot', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Pipedrive', event: 'New Deal', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Create Contact', params: { email: '{{person_email}}', firstname: '{{person_first_name}}', company: '{{org_name}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{person_email}}', subject: 'Following up on {{deal_title}}', body: 'Hi {{person_first_name}}, I wanted to follow up regarding {{deal_title}}.' } },
    ],
  },
  {
    name: 'Typeform Lead → Pipedrive Deal + Welcome Email',
    category: 'Sales & CRM',
    description: 'Convert Typeform lead generation form submissions into Pipedrive deals automatically and send an immediate welcome email to each prospect.',
    tags: ['Typeform', 'Pipedrive', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Typeform', event: 'New Entry', params: {} },
      { type: 'action', app: 'Pipedrive', event: 'Create Person', params: { name: '{{name_answer}}', email: '{{email_answer}}', phone: '{{phone_answer}}' } },
      { type: 'action', app: 'Pipedrive', event: 'Create Deal', params: { title: '{{company_answer}} - Inbound Lead', person_id: '{{person_id}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email_answer}}', subject: 'Thank you for reaching out!', body: 'Hi {{name_answer}}, we received your inquiry and will be in touch within 24 hours.' } },
    ],
  },
  {
    name: 'Calendly Booking → HubSpot + Slack Alert',
    category: 'Sales & CRM',
    description: 'Every Calendly meeting booking creates a HubSpot contact and deal, and notifies the sales team in Slack for pre-meeting preparation.',
    tags: ['Calendly', 'HubSpot', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Calendly', event: 'Invitee Created', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Create Contact', params: { email: '{{invitee_email}}', firstname: '{{invitee_first_name}}', lastname: '{{invitee_last_name}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sales', message: '📅 Sales call booked: {{invitee_name}} on {{start_time}} for {{event_type}}' } },
    ],
  },
  {
    name: 'Facebook Lead Ad → Salesforce Lead + Email',
    category: 'Sales & CRM',
    description: 'Capture Facebook Lead Ad submissions instantly and push them to Salesforce as new leads while triggering an automated email sequence.',
    tags: ['Facebook', 'Salesforce', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Facebook Lead Ads', event: 'New Lead', params: {} },
      { type: 'action', app: 'Salesforce', event: 'Create Lead', params: { FirstName: '{{full_name_first}}', LastName: '{{full_name_last}}', Email: '{{email}}', Company: '{{company_name}}', LeadSource: 'Facebook' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Thanks for connecting with us!', body: 'Hi {{full_name_first}}, we appreciate your interest. Our team will reach out shortly.' } },
    ],
  },
  {
    name: 'Won Deal → Google Sheets Log + Celebration Slack',
    category: 'Sales & CRM',
    description: 'Log every closed-won deal to a Google Sheets revenue tracker and fire a celebration message to the sales Slack channel.',
    tags: ['HubSpot', 'Google Sheets', 'Slack'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'HubSpot', event: 'Deal Stage Changed', params: { stage: 'closedwon' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { deal: '{{deal_name}}', amount: '{{amount}}', close_date: '{{close_date}}', owner: '{{owner_name}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sales-wins', message: '🎉 DEAL CLOSED! {{deal_name}} — ${{amount}} by {{owner_name}}!' } },
    ],
  },
  {
    name: 'Stripe Payment → HubSpot Deal Won + Receipt',
    category: 'Sales & CRM',
    description: 'When Stripe processes a successful payment, mark the HubSpot deal as won and send the customer a professional payment receipt via email.',
    tags: ['Stripe', 'HubSpot', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Stripe', event: 'New Payment', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Update Deal', params: { dealstage: 'closedwon', amount: '{{amount}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{customer_email}}', subject: 'Payment Confirmed — ${{amount_formatted}}', body: 'Thank you for your payment. Your receipt ID is {{charge_id}}.' } },
    ],
  },
  {
    name: 'Jotform Lead → CRM + Slack + Google Sheets',
    category: 'Sales & CRM',
    description: 'Capture Jotform inquiry submissions and simultaneously add to CRM, log to Google Sheets, and alert the sales team in Slack.',
    tags: ['HubSpot', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Jotform', event: 'New Submission', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Create Contact', params: { email: '{{email}}', firstname: '{{name}}', company: '{{company}}' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { name: '{{name}}', email: '{{email}}', company: '{{company}}', source: 'Jotform', date: '{{now}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sales', message: 'New lead via Jotform: {{name}} from {{company}} ({{email}})' } },
    ],
  },
  {
    name: 'LinkedIn Lead Form → HubSpot + Gmail Sequence',
    category: 'Sales & CRM',
    description: 'Sync LinkedIn Lead Gen Form responses to HubSpot CRM and trigger a personalized email outreach sequence to new prospects.',
    tags: ['HubSpot', 'Gmail', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'LinkedIn Lead Gen Forms', event: 'New Lead Gen Form Response', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Create Contact', params: { email: '{{email}}', firstname: '{{first_name}}', lastname: '{{last_name}}', jobtitle: '{{job_title}}', company: '{{company_name}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Great connecting on LinkedIn, {{first_name}}!', body: 'Hi {{first_name}}, I saw your LinkedIn profile and wanted to reach out about how we could help {{company_name}}.' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sales', message: 'LinkedIn lead: {{first_name}} {{last_name}}, {{job_title}} at {{company_name}}' } },
    ],
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    name: 'New WordPress Post → Buffer + Mailchimp Campaign',
    category: 'Marketing',
    description: 'Automatically share new WordPress blog posts to social media via Buffer and trigger a Mailchimp email campaign to your subscriber list.',
    tags: ['Buffer', 'Mailchimp'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'WordPress', event: 'New Post', params: {} },
      { type: 'action', app: 'Buffer', event: 'Add to Buffer', params: { profile_ids: '{{social_profiles}}', text: '{{post_title}} - Read more: {{post_url}}' } },
      { type: 'action', app: 'Mailchimp', event: 'Send Campaign', params: { list_id: '{{list_id}}', subject: '{{post_title}}', content: '{{post_excerpt}}' } },
    ],
  },
  {
    name: 'Webinar Registrant → Mailchimp + Google Sheets + Slack',
    category: 'Marketing',
    description: 'Process webinar registrations from any form by adding attendees to Mailchimp, logging to Google Sheets, and notifying marketing in Slack.',
    tags: ['Mailchimp', 'Google Sheets', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Mailchimp', event: 'Add/Update Subscriber', params: { email_address: '{{email}}', merge_fields: { FNAME: '{{first_name}}', LNAME: '{{last_name}}' }, tags: ['webinar-registrant'] } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { name: '{{first_name}} {{last_name}}', email: '{{email}}', company: '{{company}}', registered_at: '{{now}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#marketing', message: '🎙 New webinar signup: {{first_name}} {{last_name}} ({{email}}) — {{company}}' } },
    ],
  },
  {
    name: 'YouTube New Video → Twitter + LinkedIn + Facebook',
    category: 'Marketing',
    description: 'Cross-post every new YouTube video to Twitter, LinkedIn, and your Facebook Page automatically to maximize content distribution with zero effort.',
    tags: ['Twitter/X', 'LinkedIn', 'Facebook'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'YouTube', event: 'New Video in Channel', params: {} },
      { type: 'action', app: 'Twitter', event: 'Create Tweet', params: { status: '🎬 New video: {{video_title}}\n\n{{video_url}} #YouTube' } },
      { type: 'action', app: 'LinkedIn', event: 'Create Company Update', params: { comment: 'Check out our latest video: {{video_title}}\n\n{{video_url}}' } },
      { type: 'action', app: 'Facebook Pages', event: 'Create Page Post', params: { message: '{{video_title}}\n\nWatch now: {{video_url}}' } },
    ],
  },
  {
    name: 'RSS Feed → Twitter + Slack Content Alert',
    category: 'Marketing',
    description: 'Monitor an RSS feed for new articles and automatically tweet the content while alerting your content team in Slack.',
    tags: ['Twitter/X', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'RSS by Zapier', event: 'New Item in Feed', params: {} },
      { type: 'action', app: 'Twitter', event: 'Create Tweet', params: { status: '{{entry_title}} - {{entry_url}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#content', message: '📰 New article published: {{entry_title}}\n{{entry_url}}' } },
    ],
  },
  {
    name: 'Mailchimp Unsubscribe → CRM Update + Slack Alert',
    category: 'Marketing',
    description: 'When someone unsubscribes from Mailchimp, update their CRM record and alert your team in Slack so you can investigate churn signals.',
    tags: ['Mailchimp', 'HubSpot', 'Slack'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Mailchimp', event: 'New Unsubscriber', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Update Contact Property', params: { email: '{{email_address}}', marketable: false, unsubscribe_reason: '{{reason}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#marketing', message: '📧 Unsubscribe: {{email_address}} — Reason: {{reason}}' } },
    ],
  },
  {
    name: 'Google Analytics Goal → Slack Milestone Alert',
    category: 'Marketing',
    description: 'Get instant Slack notifications when important Google Analytics goals are achieved, keeping your team informed of marketing milestones.',
    tags: ['Slack', 'Google Sheets'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Google Analytics', event: 'New Goal', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#marketing', message: '🎯 Goal completed: {{goal_name}} — {{completions}} completions ({{conversion_rate}}% conversion)' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { goal: '{{goal_name}}', completions: '{{completions}}', date: '{{date}}' } },
    ],
  },
  {
    name: 'New Product Launch → Email + Social + CRM',
    category: 'Marketing',
    description: 'Coordinate a full product launch announcement by triggering Mailchimp campaigns, social posts, and CRM list updates simultaneously.',
    tags: ['Mailchimp', 'Twitter/X', 'HubSpot'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Mailchimp', event: 'Send Campaign', params: { list_id: '{{all_subscribers}}', subject: '{{product_name}} is here!', content: '{{launch_email_content}}' } },
      { type: 'action', app: 'Twitter', event: 'Create Tweet', params: { status: '🚀 {{product_name}} is now live! {{product_url}}' } },
      { type: 'action', app: 'HubSpot', event: 'Add Contact to List', params: { list_id: '{{product_interest_list}}' } },
    ],
  },
  {
    name: 'Airtable Campaign → Social Posts Schedule',
    category: 'Marketing',
    description: 'Read planned social media campaigns from Airtable and schedule posts across multiple platforms via Buffer.',
    tags: ['Buffer'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Airtable', event: 'New Record', params: { table: 'Content Calendar', view: 'Ready to Post' } },
      { type: 'action', app: 'Buffer', event: 'Add to Buffer', params: { profile_ids: '{{platform_profiles}}', text: '{{post_content}}', scheduled_at: '{{scheduled_time}}' } },
      { type: 'action', app: 'Airtable', event: 'Update Record', params: { status: 'Scheduled' } },
    ],
  },
  {
    name: 'Hotjar Heatmap Alert → Slack + Notion Note',
    category: 'Marketing',
    description: 'When Hotjar detects significant user behavior changes on key pages, alert your marketing team in Slack and log insights to Notion.',
    tags: ['Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#marketing-insights', message: '🔥 Hotjar alert: {{page_url}} has a {{alert_type}} signal. Sessions: {{sessions_count}}' } },
      { type: 'action', app: 'Notion', event: 'Create Database Item', params: { database: 'Marketing Insights', title: '{{alert_type}}: {{page_url}}', notes: '{{insight_details}}' } },
    ],
  },
  {
    name: 'Podcast New Episode → Mailchimp + Social Share',
    category: 'Marketing',
    description: 'Automatically promote new podcast episodes to your email list and social media channels as soon as they publish.',
    tags: ['Mailchimp', 'Twitter/X'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'RSS by Zapier', event: 'New Item in Feed', params: {} },
      { type: 'action', app: 'Mailchimp', event: 'Send Campaign', params: { subject: 'New Episode: {{entry_title}}', content: '{{entry_summary}}\n\nListen now: {{entry_url}}' } },
      { type: 'action', app: 'Twitter', event: 'Create Tweet', params: { status: '🎙️ New podcast episode: {{entry_title}}\n\nListen: {{entry_url}}' } },
    ],
  },

  // ── E-Commerce ────────────────────────────────────────────────────────────
  {
    name: 'Shopify New Order → Gmail Receipt + Slack',
    category: 'E-Commerce',
    description: 'Send branded order confirmation emails to customers and notify your fulfillment team in Slack the moment each Shopify order comes in.',
    tags: ['Shopify', 'Gmail', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Shopify', event: 'New Order', params: {} },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{customer_email}}', subject: 'Order Confirmed #{{order_number}}', body: 'Hi {{customer_first_name}}, your order #{{order_number}} is confirmed and being processed.' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#orders', message: '🛒 New order #{{order_number}} — ${{total_price}} from {{customer_name}}' } },
    ],
  },
  {
    name: 'WooCommerce Order → QuickBooks + Google Sheets',
    category: 'E-Commerce',
    description: 'Automatically sync WooCommerce orders to QuickBooks for accounting and log them to Google Sheets for sales analytics.',
    tags: ['Google Sheets'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'WooCommerce', event: 'New Order', params: {} },
      { type: 'action', app: 'QuickBooks Online', event: 'Create Sales Receipt', params: { customer: '{{billing_email}}', amount: '{{order_total}}', description: '{{line_items}}' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { order_id: '{{order_id}}', customer: '{{billing_name}}', total: '{{order_total}}', date: '{{date_created}}' } },
    ],
  },
  {
    name: 'Abandoned Cart → Email Sequence + Discount Code',
    category: 'E-Commerce',
    description: 'Recover lost revenue by sending a personalized abandoned cart email with a unique discount code generated automatically.',
    tags: ['Shopify', 'Mailchimp', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Shopify', event: 'Abandoned Cart', params: {} },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'cart_email is not empty' } },
      { type: 'action', app: 'Shopify', event: 'Create Discount Code', params: { code: 'COMEBACK{{random_5}}', value: '10', value_type: 'percentage', usage_limit: 1 } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{cart_email}}', subject: 'You left something behind — 10% off inside!', body: 'Hi there! You left items in your cart. Use {{discount_code}} for 10% off. Shop now: {{checkout_url}}' } },
    ],
  },
  {
    name: 'Shopify Refund → Accounting + Customer Email',
    category: 'E-Commerce',
    description: 'Process Shopify refunds by creating a QuickBooks credit memo and sending the customer a professional refund confirmation.',
    tags: ['Shopify', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Shopify', event: 'New Refund', params: {} },
      { type: 'action', app: 'QuickBooks Online', event: 'Create Credit Memo', params: { customer: '{{customer_email}}', amount: '{{refund_amount}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{customer_email}}', subject: 'Refund Processed — Order #{{order_number}}', body: 'Your refund of ${{refund_amount}} has been processed. It will appear in 3-5 business days.' } },
    ],
  },
  {
    name: 'New Product Review → Slack Alert + Spreadsheet Log',
    category: 'E-Commerce',
    description: 'Monitor product reviews and instantly alert your team in Slack for any negative reviews while logging all reviews to a Google Sheets tracker.',
    tags: ['Shopify', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { product: '{{product_name}}', rating: '{{rating}}', review: '{{review_body}}', author: '{{author}}', date: '{{now}}' } },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'rating is less than 3' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#reviews', message: '⚠️ Low review: {{product_name}} received {{rating}}/5 — "{{review_body}}"' } },
    ],
  },
  {
    name: 'Stripe Subscription → Onboarding Email + CRM',
    category: 'E-Commerce',
    description: 'When a Stripe subscription is created, trigger a welcome onboarding email sequence and create a customer record in HubSpot.',
    tags: ['Stripe', 'HubSpot', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Stripe', event: 'New Customer', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Create Contact', params: { email: '{{customer_email}}', lifecyclestage: 'customer' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{customer_email}}', subject: 'Welcome! Let us help you get started', body: 'Hi {{customer_name}}, welcome! Here is how to get the most out of your subscription.' } },
    ],
  },
  {
    name: 'Etsy New Order → Google Sheets + Email Confirmation',
    category: 'E-Commerce',
    description: 'Track Etsy orders automatically in Google Sheets and send custom order confirmation emails to buyers.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Etsy', event: 'New Order', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { order_id: '{{order_id}}', buyer: '{{buyer_name}}', item: '{{item_title}}', total: '{{total_price}}', date: '{{now}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{buyer_email}}', subject: 'Your Etsy order is confirmed!', body: 'Hi {{buyer_name}}, thank you for your order! We will ship {{item_title}} within 2-3 business days.' } },
    ],
  },
  {
    name: 'PayPal Payment → Invoice PDF + Google Sheets',
    category: 'E-Commerce',
    description: 'Process PayPal payments by logging transaction details to Google Sheets and sending a PDF invoice to the customer automatically.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'PayPal', event: 'Successful Sale', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { transaction_id: '{{transaction_id}}', payer: '{{payer_email}}', amount: '{{amount}}', date: '{{payment_date}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{payer_email}}', subject: 'Payment Receipt — ${{amount}}', body: 'Payment confirmed. Transaction ID: {{transaction_id}}. Amount: ${{amount}}.' } },
    ],
  },
  {
    name: 'Low Inventory Alert → Slack + Supplier Email',
    category: 'E-Commerce',
    description: 'Monitor inventory levels and automatically alert your team in Slack and email your supplier when stock falls below the reorder threshold.',
    tags: ['Shopify', 'Slack', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Shopify', event: 'New Event (Instant)', params: {} },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'inventory_quantity < 10' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#inventory', message: '⚠️ Low stock: {{product_title}} only has {{inventory_quantity}} units left. SKU: {{sku}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'supplier@vendor.com', subject: 'Reorder Request: {{product_title}}', body: 'Please reorder SKU {{sku}} — {{product_title}}. Current stock: {{inventory_quantity}}' } },
    ],
  },
  {
    name: 'Shopify Customer → Loyalty Program Mailchimp Tag',
    category: 'E-Commerce',
    description: 'Automatically add Shopify customers to Mailchimp loyalty segments based on their purchase count, enabling targeted loyalty campaigns.',
    tags: ['Shopify', 'Mailchimp'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Shopify', event: 'New Customer', params: {} },
      { type: 'action', app: 'Mailchimp', event: 'Add/Update Subscriber', params: { email_address: '{{email}}', merge_fields: { FNAME: '{{first_name}}', LNAME: '{{last_name}}' }, tags: ['new-customer', 'loyalty-tier-1'] } },
    ],
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    name: 'QuickBooks Invoice → Client Email + Google Sheets',
    category: 'Finance',
    description: 'When a QuickBooks invoice is created, automatically send it to the client via email and log the invoice to a Google Sheets accounts receivable tracker.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'QuickBooks Online', event: 'New Invoice', params: {} },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{customer_email}}', subject: 'Invoice #{{invoice_number}} — ${{total_amount}}', body: 'Please find your invoice #{{invoice_number}} for ${{total_amount}} attached. Payment due: {{due_date}}.' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { invoice: '{{invoice_number}}', client: '{{customer_name}}', amount: '{{total_amount}}', due_date: '{{due_date}}', status: 'Sent' } },
    ],
  },
  {
    name: 'Expense Receipt → Google Sheets + Slack Summary',
    category: 'Finance',
    description: 'Submit expenses via email or form and automatically categorize and log them to Google Sheets with a Slack summary for the finance team.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Email',
    steps: [
      { type: 'trigger', app: 'Gmail', event: 'New Email Matching Search', params: { search: 'label:expense-receipts' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { from: '{{from_email}}', subject: '{{subject}}', amount: '{{parsed_amount}}', date: '{{date}}', category: 'Uncategorized' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#finance', message: '💰 Expense logged: {{subject}} from {{from_name}} — ${{parsed_amount}}' } },
    ],
  },
  {
    name: 'Stripe MRR Report → Google Sheets Dashboard',
    category: 'Finance',
    description: 'Pull Stripe subscription data weekly and populate a Google Sheets financial dashboard tracking MRR, new subscriptions, and churn.',
    tags: ['Stripe', 'Google Sheets', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Week', params: {} },
      { type: 'action', app: 'Stripe', event: 'Find Subscription', params: { status: 'active' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { week: '{{now}}', mrr: '{{calculated_mrr}}', active_subs: '{{subscription_count}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#finance', message: '📈 Weekly MRR Update: ${{mrr}} across {{subscription_count}} active subscriptions' } },
    ],
  },
  {
    name: 'Overdue Invoice → Email Reminder + Slack Flag',
    category: 'Finance',
    description: 'Detect overdue invoices in QuickBooks and automatically send a payment reminder email to the client while flagging the finance team in Slack.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Day', params: {} },
      { type: 'action', app: 'QuickBooks Online', event: 'Find Invoice', params: { status: 'Overdue' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{customer_email}}', subject: 'Payment Reminder — Invoice #{{invoice_number}}', body: 'This is a friendly reminder that invoice #{{invoice_number}} for ${{balance}} was due on {{due_date}}.' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#finance', message: '⏰ Overdue invoice reminder sent: #{{invoice_number}} — ${{balance}} (due {{due_date}}) to {{customer_name}}' } },
    ],
  },
  {
    name: 'Xero Invoice Paid → Slack + CRM Update',
    category: 'Finance',
    description: 'When a Xero invoice is paid, notify the finance team in Slack and update the customer lifecycle stage in HubSpot CRM.',
    tags: ['HubSpot', 'Slack'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Xero', event: 'New Payment', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#finance', message: '💰 Invoice paid: #{{invoice_number}} — ${{amount_paid}} from {{contact_name}}' } },
      { type: 'action', app: 'HubSpot', event: 'Update Contact Property', params: { email: '{{contact_email}}', lifecyclestage: 'customer' } },
    ],
  },
  {
    name: 'New Bank Transaction → Categorize + Google Sheets',
    category: 'Finance',
    description: 'Automatically categorize new bank transactions using keywords and log them to a Google Sheets budget tracker for real-time financial monitoring.',
    tags: ['Google Sheets', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Lookup Spreadsheet Row', params: { search_column: 'Keyword', search_value: '{{merchant_name}}' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { date: '{{transaction_date}}', merchant: '{{merchant_name}}', amount: '{{amount}}', category: '{{category}}' } },
    ],
  },
  {
    name: 'FreshBooks Invoice → DocuSign + Client Email',
    category: 'Finance',
    description: 'When a FreshBooks invoice is created, send a DocuSign signature request to the client along with a payment instructions email.',
    tags: ['Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'FreshBooks', event: 'New Invoice', params: {} },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{client_email}}', subject: 'Invoice #{{invoice_number}} Ready for Review', body: 'Hi {{client_name}}, invoice #{{invoice_number}} for ${{total}} is ready. Please review and pay by {{due_date}}.' } },
    ],
  },
  {
    name: 'Harvest Timesheet → Invoice + QuickBooks',
    category: 'Finance',
    description: 'Convert weekly approved Harvest timesheets into QuickBooks invoices automatically at the end of each billing cycle.',
    tags: ['Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Harvest', event: 'New Time Entry', params: {} },
      { type: 'action', app: 'QuickBooks Online', event: 'Create Invoice', params: { customer: '{{client_name}}', description: '{{task_name}}: {{notes}}', amount: '{{hours_calculated}}' } },
    ],
  },
  {
    name: 'Budget Threshold Alert → Slack + Email CFO',
    category: 'Finance',
    description: 'Monitor department budgets in Google Sheets and automatically alert the CFO and department head via Slack and email when spend exceeds thresholds.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Week', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Lookup Spreadsheet Row', params: {} },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'spend > budget * 0.9' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#finance', message: '🚨 Budget alert: {{department}} is at {{pct}}% of budget (${{spent}} / ${{budget}})' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'cfo@company.com', subject: 'Budget Alert: {{department}} at {{pct}}%', body: '{{department}} has spent ${{spent}} of ${{budget}} budget ({{pct}}%). Please review.' } },
    ],
  },
  {
    name: 'Crypto Price Alert → Slack + Email Notification',
    category: 'Finance',
    description: 'Monitor cryptocurrency prices and automatically alert your team via Slack and email when assets hit predefined price targets.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Hour', params: {} },
      { type: 'action', app: 'Webhooks by Zapier', event: 'GET', params: { url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd' } },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'price < target_low OR price > target_high' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#finance', message: '📊 Price alert: BTC is ${{btc_price}} — Target range: ${{target_low}}-${{target_high}}' } },
    ],
  },

  // ── HR & Recruiting ────────────────────────────────────────────────────────
  {
    name: 'Job Application → ATS Google Sheet + Slack + Email Ack',
    category: 'HR & Recruiting',
    description: 'Capture job applications from any source, add them to your applicant tracking spreadsheet, notify recruiters in Slack, and send an acknowledgment email.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { name: '{{name}}', email: '{{email}}', position: '{{position}}', source: '{{source}}', date: '{{now}}', status: 'Applied' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#recruiting', message: '📋 New application: {{name}} for {{position}} via {{source}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Application Received — {{position}}', body: 'Hi {{name}}, thank you for applying! We will review your application and be in touch.' } },
    ],
  },
  {
    name: 'BambooHR New Employee → Slack Welcome + IT Setup',
    category: 'HR & Recruiting',
    description: 'When a new employee is added to BambooHR, post a team welcome in Slack and send IT an automated setup request email.',
    tags: ['BambooHR', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'BambooHR', event: 'New Employee', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#general', message: '👋 Welcome {{preferred_name}} {{last_name}} who joins us as {{job_title}} on {{hire_date}}!' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'it@company.com', subject: 'New Employee Setup: {{preferred_name}} {{last_name}}', body: 'Please set up accounts for {{preferred_name}} {{last_name}} starting {{hire_date}}.\n\nRole: {{job_title}}\nDepartment: {{department}}\nEmail: {{work_email}}' } },
    ],
  },
  {
    name: 'Calendly Interview → ATS Update + Confirmation Email',
    category: 'HR & Recruiting',
    description: 'When a candidate schedules an interview via Calendly, update their status in the ATS and send a detailed confirmation email with prep materials.',
    tags: ['Calendly', 'Google Sheets', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Calendly', event: 'Invitee Created', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Update Spreadsheet Row', params: { lookup: '{{invitee_email}}', status: 'Interview Scheduled', interview_date: '{{start_time}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{invitee_email}}', subject: 'Interview Confirmed — {{event_type_name}}', body: 'Hi {{invitee_name}}, your interview is confirmed for {{start_time}}. Here are some tips to prepare...' } },
    ],
  },
  {
    name: 'PTO Request → Manager Approval + Calendar',
    category: 'HR & Recruiting',
    description: 'Receive PTO requests via form and automatically send approval emails to managers with a one-click approve link and create a pending calendar event.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{manager_email}}', subject: 'PTO Request: {{employee_name}}', body: '{{employee_name}} has requested PTO from {{start_date}} to {{end_date}} ({{days}} days).\n\nApprove: {{approve_url}}\nDeny: {{deny_url}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#hr', message: '🏖️ PTO request: {{employee_name}} — {{start_date}} to {{end_date}} (manager notified)' } },
    ],
  },
  {
    name: 'Employee Birthday → Slack Celebration + Gift Card',
    category: 'HR & Recruiting',
    description: 'Automatically celebrate employee birthdays by posting a Slack message to the team and sending a birthday gift card via email.',
    tags: ['BambooHR', 'Slack', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Day', params: {} },
      { type: 'action', app: 'BambooHR', event: 'Find Employee', params: { birthday: '{{today}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#general', message: '🎂 Happy Birthday to {{preferred_name}} {{last_name}}! Please join us in celebrating their special day!' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{work_email}}', subject: '🎉 Happy Birthday from the Team!', body: 'Hi {{preferred_name}}, wishing you a wonderful birthday! Enjoy your gift card as a small token of appreciation.' } },
    ],
  },
  {
    name: 'Resume Submitted → ATS + Recruiter Slack Alert',
    category: 'HR & Recruiting',
    description: 'Parse resume submissions from email or form and add candidates to your Google Sheets ATS while alerting recruiters for immediate review.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Email',
    steps: [
      { type: 'trigger', app: 'Gmail', event: 'New Email Matching Search', params: { search: 'label:resumes' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { sender: '{{from_email}}', subject: '{{subject}}', received: '{{date}}', status: 'New' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#recruiting', message: '📄 New resume from {{from_email}}: {{subject}}' } },
    ],
  },
  {
    name: 'Offer Accepted → Onboarding Checklist + Welcome',
    category: 'HR & Recruiting',
    description: 'When a job offer is accepted, trigger the complete onboarding workflow including a Trello checklist, welcome email, and Slack announcement.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Trello', event: 'Create Card', params: { list: 'Onboarding', name: 'Onboard: {{name}} — {{start_date}}', desc: 'Role: {{job_title}}\nEquipment: laptop + peripherals\nAccess: GSuite, Slack, GitHub' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Welcome to the Team!', body: 'Hi {{name}}, your offer has been accepted and we are thrilled to have you join as {{job_title}} on {{start_date}}!' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#general', message: '🎉 Great news! {{name}} will be joining us as {{job_title}} on {{start_date}}!' } },
    ],
  },
  {
    name: 'Performance Review Due → BambooHR + Manager Email',
    category: 'HR & Recruiting',
    description: 'Send automated performance review reminders to managers 30 days before scheduled reviews with instructions and the review form link.',
    tags: ['BambooHR', 'Gmail', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Day', params: {} },
      { type: 'action', app: 'BambooHR', event: 'Find Employee', params: { next_review_date: '{{date_30_days_out}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{manager_email}}', subject: 'Performance Review Due in 30 Days: {{name}}', body: 'A performance review for {{name}} is due on {{next_review_date}}. Please complete the review form: {{review_form_url}}' } },
    ],
  },
  {
    name: 'Employee Offboarding → IT Alert + Access Revoke Checklist',
    category: 'HR & Recruiting',
    description: 'Automate the offboarding process by creating an IT checklist in Trello and alerting all relevant departments when an employee is terminated.',
    tags: ['BambooHR', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'BambooHR', event: 'Employee Changed Status', params: { status: 'Terminated' } },
      { type: 'action', app: 'Trello', event: 'Create Card', params: { list: 'Offboarding', name: 'Offboard: {{name}}', desc: 'Revoke: GSuite, Slack, GitHub, CRM, AWS\nLast day: {{termination_date}}\nReturn: laptop, badge, equipment' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#it-support', message: '🔒 Offboarding: {{name}} — please revoke all system access by {{termination_date}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'it@company.com,hr@company.com', subject: 'Offboarding: {{name}} — {{termination_date}}', body: 'Please process the offboarding for {{name}} by {{termination_date}}. Checklist created in Trello.' } },
    ],
  },
  {
    name: 'Weekly HR Metrics → Google Sheets + Slack Digest',
    category: 'HR & Recruiting',
    description: 'Compile weekly HR metrics including headcount, open roles, and time-to-hire from BambooHR and deliver a digest to HR leadership.',
    tags: ['BambooHR', 'Google Sheets', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Week', params: {} },
      { type: 'action', app: 'BambooHR', event: 'Get a List of Employees', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { week: '{{now}}', headcount: '{{employee_count}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#hr', message: '📊 Weekly HR Update: {{employee_count}} employees total, {{new_hires}} new hires this week, {{open_roles}} open roles' } },
    ],
  },

  // ── Customer Support ───────────────────────────────────────────────────────
  {
    name: 'New Zendesk Ticket → Slack Alert + Gmail Auto-Reply',
    category: 'Customer Support',
    description: 'When a new Zendesk ticket is created, send an immediate Slack notification to the support team and auto-reply to the customer with a ticket number.',
    tags: ['Zendesk', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Zendesk', event: 'New Ticket', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#support', message: '🎫 New ticket #{{ticket_id}}: "{{subject}}" from {{requester_email}} (Priority: {{priority}})' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{requester_email}}', subject: 'Re: {{subject}} [Ticket #{{ticket_id}}]', body: 'Thank you for contacting support. Your ticket #{{ticket_id}} has been created. We respond within 24 hours.' } },
    ],
  },
  {
    name: 'Freshdesk Ticket → Slack + HubSpot CRM Note',
    category: 'Customer Support',
    description: 'Mirror new Freshdesk support tickets to Slack for visibility and create HubSpot CRM notes to maintain a complete customer communication history.',
    tags: ['Slack', 'HubSpot'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Freshdesk', event: 'New Ticket', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#support', message: '🎫 Freshdesk ticket #{{ticket_id}}: "{{subject}}" — Status: {{status}}, Priority: {{priority}}' } },
      { type: 'action', app: 'HubSpot', event: 'Create Note', params: { body: 'Support ticket #{{ticket_id}}: {{subject}}\n\nStatus: {{status}}\nPriority: {{priority}}\n\n{{description}}' } },
    ],
  },
  {
    name: 'Intercom Conversation → Zendesk Ticket',
    category: 'Customer Support',
    description: 'Escalate Intercom conversations to Zendesk tickets seamlessly so complex issues get proper tracking and SLA management.',
    tags: ['Zendesk'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Intercom', event: 'New Conversation', params: {} },
      { type: 'action', app: 'Zendesk', event: 'Create Ticket', params: { subject: 'Intercom: {{subject}}', description: '{{body}}', requester_email: '{{user_email}}' } },
    ],
  },
  {
    name: 'Urgent Ticket → PagerDuty + Slack + Email Escalation',
    category: 'Customer Support',
    description: 'When a Zendesk ticket is marked urgent, trigger a PagerDuty incident and escalate through multiple channels to ensure a 5-minute response.',
    tags: ['Zendesk', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Zendesk', event: 'Updated Ticket', params: { priority: 'urgent' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#support-urgent', message: '🚨 URGENT TICKET #{{ticket_id}}: "{{subject}}" — Immediate response required!' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'support-lead@company.com', subject: '[URGENT] Ticket #{{ticket_id}} Needs Immediate Attention', body: 'Urgent ticket #{{ticket_id}} has been created and requires immediate response within 5 minutes.\n\nSubject: {{subject}}\nRequester: {{requester_email}}' } },
    ],
  },
  {
    name: 'CSAT Score Received → Spreadsheet + Slack Alert',
    category: 'Customer Support',
    description: 'Log all CSAT survey scores to Google Sheets and alert the support manager in Slack when a low score (below 3) is received.',
    tags: ['Google Sheets', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { ticket_id: '{{ticket_id}}', score: '{{rating}}', comment: '{{comment}}', agent: '{{agent_name}}', date: '{{now}}' } },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'rating < 3' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#support-quality', message: '⚠️ Low CSAT: Ticket #{{ticket_id}} scored {{rating}}/5 — "{{comment}}" (Agent: {{agent_name}})' } },
    ],
  },
  {
    name: 'Ticket Resolved → CSAT Email + Notion Log',
    category: 'Customer Support',
    description: 'Send CSAT survey emails when Zendesk tickets are resolved and log all resolutions to a Notion support database for quality tracking.',
    tags: ['Zendesk', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Zendesk', event: 'Updated Ticket', params: { status: 'solved' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{requester_email}}', subject: 'Your ticket has been resolved — How did we do?', body: 'Hi {{requester_name}}, your ticket #{{ticket_id}} has been resolved. Please rate your experience: {{survey_link}}' } },
      { type: 'action', app: 'Notion', event: 'Create Database Item', params: { database: 'Support Resolutions', title: 'Ticket #{{ticket_id}}: {{subject}}', resolved_by: '{{assignee_name}}', resolution_time: '{{hours_to_resolve}}' } },
    ],
  },
  {
    name: 'Churn Risk Signal → CS Team Slack + Email Outreach',
    category: 'Customer Support',
    description: 'Detect churn risk signals and trigger immediate customer success outreach with a personalized check-in email and Slack alert.',
    tags: ['HubSpot', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#customer-success', message: '⚠️ Churn risk: {{company}} ({{email}}) — Risk score: {{score}}/10. Signal: {{signal_type}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Checking in — How can we help?', body: 'Hi {{first_name}}, I wanted to personally reach out to see how things are going. Can we schedule a quick call?' } },
      { type: 'action', app: 'HubSpot', event: 'Update Contact Property', params: { email: '{{email}}', churn_risk: '{{score}}' } },
    ],
  },
  {
    name: 'Support Email → Zendesk + Auto-Acknowledgment',
    category: 'Customer Support',
    description: 'Convert support emails into Zendesk tickets automatically and send a branded acknowledgment email with ticket number and SLA promise.',
    tags: ['Gmail', 'Zendesk'],
    trigger_type: 'Email',
    steps: [
      { type: 'trigger', app: 'Gmail', event: 'New Email Matching Search', params: { search: 'to:support@company.com' } },
      { type: 'action', app: 'Zendesk', event: 'Create Ticket', params: { subject: '{{subject}}', description: '{{body_plain}}', requester_email: '{{from_email}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{from_email}}', subject: 'Re: {{subject}} [Ticket #{{ticket_id}}]', body: 'Thank you for contacting support. Ticket #{{ticket_id}} has been created. You can expect a response within 24 hours.' } },
    ],
  },
  {
    name: 'SLA Breach Alert → Escalation Email + Slack',
    category: 'Customer Support',
    description: 'Monitor Zendesk for SLA breaches and trigger immediate escalation to support managers via email and Slack to protect customer satisfaction.',
    tags: ['Zendesk', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#support-escalations', message: '🔴 SLA Breach: Ticket #{{ticket_id}} "{{subject}}" from {{customer_email}} has breached {{sla_type}} SLA by {{minutes_overdue}} minutes' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'support-manager@company.com', subject: 'SLA Breach: Ticket #{{ticket_id}}', body: 'SLA breach detected. Ticket #{{ticket_id}} requires immediate attention.\n\nCustomer: {{customer_email}}\nSubject: {{subject}}\nOverdue by: {{minutes_overdue}} minutes' } },
    ],
  },
  {
    name: 'NPS Response → Segment + CRM + Slack',
    category: 'Customer Support',
    description: 'Process NPS survey responses to update customer segments in Mailchimp, flag detractors in HubSpot, and notify the team in Slack.',
    tags: ['Mailchimp', 'HubSpot', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'HubSpot', event: 'Update Contact Property', params: { email: '{{email}}', nps_score: '{{score}}', nps_category: '{{category}}' } },
      { type: 'action', app: 'Mailchimp', event: 'Add Subscriber to Tag', params: { email_address: '{{email}}', tags: ['{{category}}'] } },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'score < 7' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#customer-success', message: '😟 NPS Detractor: {{email}} scored {{score}}/10 — "{{comment}}"' } },
    ],
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    name: 'Slack Message → Trello Card + Email',
    category: 'Communication',
    description: 'Convert Slack messages that contain specific keywords into Trello action items and send an email summary to the project owner.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Slack', event: 'New Pushed Message', params: {} },
      { type: 'action', app: 'Trello', event: 'Create Card', params: { name: '{{message_text}}', list: 'To Do', desc: 'From Slack: @{{user_name}} in #{{channel_name}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'team@company.com', subject: 'Action item from Slack: {{message_text}}', body: 'A new Trello card was created from a Slack message:\n\n{{message_text}}\n\nFrom: {{user_name}} in #{{channel_name}}' } },
    ],
  },
  {
    name: 'Gmail → Slack Notification + Trello Card',
    category: 'Communication',
    description: 'Forward important emails from Gmail to Slack and optionally create a Trello card for emails that require follow-up action.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Email',
    steps: [
      { type: 'trigger', app: 'Gmail', event: 'New Email Matching Search', params: { search: 'label:action-required is:unread' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#inbox', message: '📧 Action required from {{from_name}}: "{{subject}}"\n\n{{body_plain_truncated}}' } },
      { type: 'action', app: 'Trello', event: 'Create Card', params: { name: 'Email: {{subject}}', list: 'Inbox', desc: 'From: {{from_email}}\n\n{{body_plain}}' } },
    ],
  },
  {
    name: 'Typeform Response → Slack Alert + Email Confirmation',
    category: 'Communication',
    description: 'Route Typeform form submissions to the right Slack channels and send personalized confirmation emails based on the response content.',
    tags: ['Typeform', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Typeform', event: 'New Entry', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#form-submissions', message: '📝 Form submission from {{email_answer}}:\n{{formatted_responses}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email_answer}}', subject: 'Thanks for your submission!', body: 'Hi {{name_answer}}, we received your submission and will be in touch soon.' } },
    ],
  },
  {
    name: 'Zoom Meeting Ended → Slack Summary + Meeting Notes',
    category: 'Communication',
    description: 'After every Zoom meeting, automatically post a recap to Slack with attendee count and duration, and create meeting notes in Google Docs.',
    tags: ['Zoom', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Zoom', event: 'Meeting Ended', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#meetings', message: '📹 Meeting ended: {{topic}}\nDuration: {{duration}} min\nParticipants: {{participant_count}}\nHost: {{host_email}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{attendee_emails}}', subject: 'Meeting Notes: {{topic}}', body: 'Thanks for joining {{topic}}. Meeting notes are being prepared and will be shared shortly.' } },
    ],
  },
  {
    name: 'Calendly Booking → Multi-channel Notification',
    category: 'Communication',
    description: 'Notify the host and all relevant team members across Slack, email, and Microsoft Teams when a Calendly booking is confirmed.',
    tags: ['Calendly', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Calendly', event: 'Invitee Created', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#scheduling', message: '📅 New booking: {{invitee_name}} — {{event_type_name}} on {{start_time}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{invitee_email}}', subject: 'Meeting Confirmed: {{event_type_name}}', body: 'Hi {{invitee_name}}, your {{event_type_name}} is confirmed for {{start_time}}.' } },
    ],
  },
  {
    name: 'WhatsApp Message → Slack Mirror + Log',
    category: 'Communication',
    description: 'Mirror WhatsApp Business messages to Slack for team visibility and log all conversations to Google Sheets for compliance and tracking.',
    tags: ['WhatsApp', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#whatsapp', message: '💬 WhatsApp from {{phone}}: "{{message}}"' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { phone: '{{phone}}', message: '{{message}}', timestamp: '{{timestamp}}', direction: 'inbound' } },
    ],
  },
  {
    name: 'Twilio SMS → Slack + CRM Note',
    category: 'Communication',
    description: 'When your Twilio number receives an SMS, forward it to Slack for team visibility and log it as a CRM contact note.',
    tags: ['SMS', 'Slack', 'HubSpot'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#sms-inbox', message: '📱 SMS from {{from}}: "{{body}}"' } },
      { type: 'action', app: 'HubSpot', event: 'Create Note', params: { body: 'SMS received from {{from}}: {{body}}' } },
    ],
  },
  {
    name: 'Microsoft Teams → Email Digest + Trello Tasks',
    category: 'Communication',
    description: 'Capture Microsoft Teams messages with specific keywords and convert them into email digests for stakeholders and Trello action cards.',
    tags: ['Microsoft Teams', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Microsoft Teams', event: 'New Channel Message', params: {} },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'message_text contains "ACTION:"' } },
      { type: 'action', app: 'Trello', event: 'Create Card', params: { name: '{{message_text}}', list: 'Teams Actions', desc: 'From: {{sender_name}} in {{channel_name}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'project-manager@company.com', subject: 'Action item from Teams: {{channel_name}}', body: '{{message_text}}\n\nFrom: {{sender_name}}' } },
    ],
  },
  {
    name: 'Weekly Newsletter → Slack + Email + LinkedIn',
    category: 'Communication',
    description: 'Broadcast your weekly company newsletter to Slack channels, email subscribers, and LinkedIn simultaneously from a single trigger.',
    tags: ['Slack', 'Gmail', 'LinkedIn'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Week', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Lookup Spreadsheet Row', params: { search_column: 'Week', search_value: '{{this_week}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#general', message: '📰 Weekly Update: {{headline}}\n\n{{summary}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{subscriber_list}}', subject: 'This Week: {{headline}}', body: '{{newsletter_content}}' } },
      { type: 'action', app: 'LinkedIn', event: 'Create Company Update', params: { comment: '{{linkedin_version}}' } },
    ],
  },
  {
    name: 'Discord Message → Slack Notification',
    category: 'Communication',
    description: 'Bridge Discord and Slack by mirroring important Discord messages to your Slack workspace for teams that span both platforms.',
    tags: ['Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#discord-mirror', message: '💬 Discord [#{{channel}}] {{username}}: {{message}}' } },
    ],
  },

  // ── Development ───────────────────────────────────────────────────────────
  {
    name: 'GitHub Issue → Jira + Slack Notification',
    category: 'Development',
    description: 'Sync new GitHub issues to Jira as tasks and notify the dev team in Slack so nothing falls through the planning cracks.',
    tags: ['GitHub', 'Jira', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'GitHub', event: 'New Issue', params: {} },
      { type: 'action', app: 'Jira Software Cloud', event: 'Create Issue', params: { summary: '{{title}}', description: '{{body}}\n\nGitHub: {{html_url}}', issuetype: 'Bug' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#dev-issues', message: '🐛 New GitHub issue: "{{title}}" → Jira {{jira_key}}\n{{html_url}}' } },
    ],
  },
  {
    name: 'Jira Issue Created → Slack + GitHub Issue',
    category: 'Development',
    description: 'When a Jira issue is created in a dev project, create a corresponding GitHub issue for tracking and notify the team in Slack.',
    tags: ['Jira', 'GitHub', 'Slack'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Jira Software Cloud', event: 'New Issue', params: {} },
      { type: 'action', app: 'GitHub', event: 'Create Issue', params: { title: '[Jira {{issue_key}}] {{summary}}', body: '{{description}}\n\nJira: {{issue_url}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#dev-team', message: '📋 New Jira issue: {{issue_key}} "{{summary}}" → GitHub #{{github_number}}' } },
    ],
  },
  {
    name: 'Sentry Error → Jira Bug + Slack Alert',
    category: 'Development',
    description: 'When Sentry detects an unhandled exception, automatically create a Jira bug ticket and post an incident alert to the dev team Slack channel.',
    tags: ['Jira', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Jira Software Cloud', event: 'Create Issue', params: { summary: '[Sentry] {{culprit}}: {{title}}', description: '{{url}}\n\nFirst seen: {{firstSeen}}\nOccurrences: {{count}}\nUsers affected: {{userCount}}', issuetype: 'Bug', priority: 'High' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#incidents', message: '🔴 Sentry error: {{title}}\nCulprit: {{culprit}}\nOccurrences: {{count}}\nJira: {{jira_key}}' } },
    ],
  },
  {
    name: 'GitHub PR Merged → Slack Announce + Changelog',
    category: 'Development',
    description: 'When PRs are merged to main, announce the change in Slack and update the Google Sheets changelog for release management.',
    tags: ['GitHub', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'GitHub', event: 'New Pull Request (Instant)', params: { action: 'closed' } },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'merged is True' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#deployments', message: '✅ PR merged: "{{title}}" by {{user_login}} into {{base}}\n{{html_url}}' } },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { date: '{{merged_at}}', repo: '{{repo_name}}', pr: '{{title}}', author: '{{user_login}}', url: '{{html_url}}' } },
    ],
  },
  {
    name: 'Failed GitHub Actions → Developer Email + Slack',
    category: 'Development',
    description: 'Alert developers immediately when their GitHub Actions workflow fails so broken builds get fixed before they block teammates.',
    tags: ['GitHub', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'GitHub', event: 'New Workflow Run (Instant)', params: { conclusion: 'failure' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#ci-cd', message: '❌ Build failed: {{workflow_name}} on {{repo_name}}\nBranch: {{head_branch}}\nActor: {{actor}}\n{{html_url}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{actor}}@company.com', subject: '❌ Build Failed: {{workflow_name}}', body: 'Your workflow {{workflow_name}} failed on {{repo_name}}. Please investigate: {{html_url}}' } },
    ],
  },
  {
    name: 'New GitHub Release → Announce + Docs + Email',
    category: 'Development',
    description: 'When a GitHub release is published, automatically announce it in Slack, create release notes in Notion, and email the changelog to subscribers.',
    tags: ['GitHub', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'GitHub', event: 'New Release', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#releases', message: '🚀 Released {{tag_name}}: {{name}}\n\n{{body}}\n\n{{html_url}}' } },
      { type: 'action', app: 'Notion', event: 'Create Database Item', params: { database: 'Release Notes', title: '{{name}} ({{tag_name}})', body: '{{body}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{engineering_team}}', subject: 'Release {{tag_name}}: {{name}}', body: '{{body}}' } },
    ],
  },
  {
    name: 'Uptime Down Alert → PagerDuty + Slack + Email',
    category: 'Development',
    description: 'Trigger a full incident response when monitoring detects service downtime: PagerDuty alert, Slack incident channel, and executive notification.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'status equals down' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#incidents', message: '🔴 SERVICE DOWN: {{service_name}}\nURL: {{url}}\nStarted: {{started_at}}\nError: {{error_message}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'cto@company.com,oncall@company.com', subject: '[OUTAGE] {{service_name}} is Down', body: 'Service {{service_name}} ({{url}}) went down at {{started_at}}.\n\nError: {{error_message}}\n\nInvestigation in progress.' } },
    ],
  },
  {
    name: 'Linear Issue → GitHub Issue + Slack Notify',
    category: 'Development',
    description: 'Keep Linear and GitHub in sync by automatically creating GitHub issues from Linear tasks and notifying the development team.',
    tags: ['GitHub', 'Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'GitHub', event: 'Create Issue', params: { title: '[Linear] {{title}}', body: '{{description}}\n\nLinear URL: {{url}}', labels: ['linear-sync'] } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#dev-team', message: '🔄 Linear → GitHub: "{{title}}" synced as #{{github_number}}' } },
    ],
  },
  {
    name: 'AWS CloudWatch Alarm → Slack + Email Escalation',
    category: 'Development',
    description: 'Forward AWS CloudWatch alarms to Slack for infrastructure monitoring and escalate critical alarms to the on-call engineer via email.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#infrastructure', message: '☁️ CloudWatch: {{alarm_name}} is {{new_state}}\nMetric: {{metric_name}} = {{metric_value}}\nReason: {{state_reason}}\nRegion: {{region}}' } },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'new_state equals ALARM' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: 'oncall@company.com', subject: '[CRITICAL] CloudWatch: {{alarm_name}}', body: 'AWS CloudWatch alarm triggered:\n\nAlarm: {{alarm_name}}\nState: {{new_state}}\nReason: {{state_reason}}\nTime: {{state_change_time}}' } },
    ],
  },
  {
    name: 'Daily Standup Form → Slack + Notion Sprint Board',
    category: 'Development',
    description: 'Collect daily standup updates via Google Forms and post them to Slack and Notion to keep distributed teams aligned without meetings.',
    tags: ['Slack'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Google Forms', event: 'New Response in Spreadsheet', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#standup', message: '📢 Standup from {{name}}:\n✅ Yesterday: {{yesterday}}\n🎯 Today: {{today}}\n🚧 Blockers: {{blockers}}' } },
      { type: 'action', app: 'Notion', event: 'Create Database Item', params: { database: 'Standups', title: '{{name}} — {{date}}', yesterday: '{{yesterday}}', today: '{{today}}', blockers: '{{blockers}}' } },
    ],
  },

  // ── General Automation ─────────────────────────────────────────────────────
  {
    name: 'Google Form → Sheets + Slack + Email',
    category: 'General Automation',
    description: 'Process Google Form submissions by logging to Sheets, alerting Slack, and sending a personalized acknowledgment email — all automatically.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Google Forms', event: 'New Response in Spreadsheet', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { name: '{{name}}', email: '{{email}}', message: '{{message}}', date: '{{now}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#submissions', message: '📝 New form submission from {{name}} ({{email}}): {{message}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{email}}', subject: 'Thanks for reaching out, {{name}}!', body: 'Hi {{name}}, we received your message and will respond within 1-2 business days.' } },
    ],
  },
  {
    name: 'Scheduled Report → Google Sheets + Email Digest',
    category: 'General Automation',
    description: 'Pull data from Google Sheets on a schedule and deliver a formatted email report digest to stakeholders automatically.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Week', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Lookup Spreadsheet Row', params: {} },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{stakeholder_list}}', subject: 'Weekly Report — {{formatted_date}}', body: '{{report_content}}' } },
    ],
  },
  {
    name: 'RSS Feed → Airtable + Slack + Twitter',
    category: 'General Automation',
    description: 'Monitor RSS feeds and automatically archive new items in Airtable, share to Slack, and tweet the headline for maximum content distribution.',
    tags: ['Slack', 'Twitter/X'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'RSS by Zapier', event: 'New Item in Feed', params: {} },
      { type: 'action', app: 'Airtable', event: 'Create Record', params: { table: 'Content Archive', title: '{{entry_title}}', url: '{{entry_url}}', published: '{{entry_date}}', summary: '{{entry_summary}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#content', message: '📰 New: {{entry_title}}\n{{entry_url}}' } },
      { type: 'action', app: 'Twitter', event: 'Create Tweet', params: { status: '{{entry_title}} {{entry_url}}' } },
    ],
  },
  {
    name: 'Airtable New Record → Slack Alert + Email',
    category: 'General Automation',
    description: 'Monitor Airtable for new records and notify your team in Slack while sending a formatted email summary to relevant stakeholders.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Airtable', event: 'New Record', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#airtable-updates', message: '📋 New {{table_name}} record: {{record_name}} — {{record_status}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{notification_email}}', subject: 'New Airtable Record: {{record_name}}', body: 'A new record was added to {{table_name}}:\n\n{{record_details}}' } },
    ],
  },
  {
    name: 'Google Calendar Event → Slack Reminder + Email',
    category: 'General Automation',
    description: 'Send Slack and email reminders before Google Calendar events to ensure attendees are prepared and have the meeting details.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Google Calendar', event: 'Event Start', params: { minutes_before: 60 } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#reminders', message: '⏰ Reminder: "{{summary}}" starts in 1 hour. Location: {{location}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{attendee_emails}}', subject: 'Reminder: {{summary}} in 1 Hour', body: 'This is a reminder that {{summary}} starts at {{start_time}}.\n\nLocation: {{location}}\nDetails: {{description}}' } },
    ],
  },
  {
    name: 'Google Drive New File → Slack + Email Team',
    category: 'General Automation',
    description: 'Notify the team in Slack and via email when new files are added to specific Google Drive folders, with a direct link to the file.',
    tags: ['Google Drive', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Google Drive', event: 'New File in Folder', params: {} },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#shared-files', message: '📁 New file: {{file_name}}\nUploaded by: {{owner_name}}\nLink: {{link}}' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{team_email}}', subject: 'New file shared: {{file_name}}', body: '{{owner_name}} added {{file_name}} to the shared drive.\n\nAccess it here: {{link}}' } },
    ],
  },
  {
    name: 'Notion Task → Trello Card + Slack Alert',
    category: 'General Automation',
    description: 'Mirror Notion database tasks to Trello cards and notify the team in Slack for seamless project management across both tools.',
    tags: ['Slack'],
    trigger_type: 'Event',
    steps: [
      { type: 'trigger', app: 'Notion', event: 'Updated Database Item', params: {} },
      { type: 'filter', app: 'Filter by Zapier', event: 'Only continue if', params: { condition: 'status equals Ready' } },
      { type: 'action', app: 'Trello', event: 'Create Card', params: { name: '{{page_title}}', list: 'To Do', desc: '{{page_url}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#project-updates', message: '✅ Task ready: "{{page_title}}" → Trello' } },
    ],
  },
  {
    name: 'Morning Briefing → Slack + Email',
    category: 'General Automation',
    description: 'Deliver an automated morning briefing to your team every weekday with key metrics, agenda items, and daily priorities.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Day', params: { time: '09:00', days: 'mon,tue,wed,thu,fri' } },
      { type: 'action', app: 'Google Sheets', event: 'Lookup Spreadsheet Row', params: { search_value: '{{today}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#general', message: '☀️ Good morning! Here is your briefing for {{formatted_date}}:\n\n{{agenda}}\n\nHave a great day!' } },
      { type: 'action', app: 'Gmail', event: 'Send Email', params: { to: '{{team_email}}', subject: 'Morning Briefing — {{formatted_date}}', body: '{{briefing_content}}' } },
    ],
  },
  {
    name: 'Webhook → Multi-destination Router',
    category: 'General Automation',
    description: 'A flexible webhook router that receives data and distributes it to Google Sheets, Slack, and a CRM based on the payload content.',
    tags: ['Slack', 'Google Sheets', 'HubSpot'],
    trigger_type: 'Webhook',
    steps: [
      { type: 'trigger', app: 'Webhooks by Zapier', event: 'Catch Hook', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Create Spreadsheet Row', params: { event: '{{event_type}}', data: '{{payload}}', timestamp: '{{now}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#webhooks', message: 'Webhook received: {{event_type}} — {{summary}}' } },
      { type: 'action', app: 'HubSpot', event: 'Create Note', params: { body: 'Webhook event: {{event_type}}\n\n{{payload}}' } },
    ],
  },
  {
    name: 'Weekly Backup → Google Sheets → Drive + Notify',
    category: 'General Automation',
    description: 'Run weekly automated data backups from Google Sheets to Google Drive and notify the team in Slack that the backup completed successfully.',
    tags: ['Google Sheets', 'Google Drive', 'Slack'],
    trigger_type: 'Schedule',
    steps: [
      { type: 'trigger', app: 'Schedule by Zapier', event: 'Every Week', params: {} },
      { type: 'action', app: 'Google Sheets', event: 'Get Many Spreadsheet Rows', params: {} },
      { type: 'action', app: 'Google Drive', event: 'Upload File', params: { name: 'backup_{{today}}.json', folder: '{{backup_folder_id}}' } },
      { type: 'action', app: 'Slack', event: 'Send Channel Message', params: { channel: '#ops', message: '💾 Weekly backup complete: {{row_count}} rows backed up to Google Drive ({{file_name}})' } },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ManageAI — Zapier Template Seeder');
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
      title: t.name,
      description: t.description,
      steps: t.steps,
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
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(1); });
