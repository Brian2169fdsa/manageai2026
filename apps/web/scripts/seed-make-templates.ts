#!/usr/bin/env tsx
/**
 * Seed Make.com (platform: "make") templates into Supabase `templates` table.
 *
 * Usage (from apps/web/):
 *   npx tsx scripts/seed-make-templates.ts
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

const SOURCE = 'seed:make-templates';
const BATCH_SIZE = 50;

// ── Types ─────────────────────────────────────────────────────────────────────
type MakeModule = {
  id: number;
  module: string;
  version: number;
  parameters: Record<string, unknown>;
  mapper: Record<string, unknown>;
  metadata: { designer: { x: number; y: number } };
};

type SeedTemplate = {
  name: string;
  category: string;
  description: string;
  tags: string[];
  trigger_type: string;
  flow: MakeModule[];
};

// ── Helper ────────────────────────────────────────────────────────────────────
function m(id: number, module: string, x: number, mapper: Record<string, unknown> = {}): MakeModule {
  return { id, module, version: 1, parameters: {}, mapper, metadata: { designer: { x, y: 0 } } };
}

function complexity(nodeCount: number): string {
  if (nodeCount <= 3) return 'Beginner';
  if (nodeCount <= 7) return 'Intermediate';
  return 'Advanced';
}

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES: SeedTemplate[] = [

  // ── Sales & CRM ─────────────────────────────────────────────────────────────
  {
    name: 'New HubSpot Contact → Pipedrive Deal + Slack Alert',
    category: 'Sales & CRM',
    description: 'When a new contact is created in HubSpot, automatically create a corresponding deal in Pipedrive and notify your sales team in Slack.',
    tags: ['HubSpot', 'Pipedrive', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'hubspot-crm:watchContacts', 0),
      m(2, 'pipedrive:createDeal', 300, { title: '{{1.firstname}} {{1.lastname}} - New Lead', value: '0' }),
      m(3, 'slack:createMessage', 600, { channel: '#sales', text: 'New HubSpot lead: {{1.firstname}} {{1.lastname}} ({{1.email}}) → Pipedrive deal created' }),
    ],
  },
  {
    name: 'Pipedrive Deal Won → Google Sheets Log + Email',
    category: 'Sales & CRM',
    description: 'Log every won deal in a Google Sheets CRM tracker and send a congratulatory email to the deal owner automatically.',
    tags: ['Pipedrive', 'Google Sheets', 'Gmail'],
    trigger_type: 'Event',
    flow: [
      m(1, 'pipedrive:watchDeals', 0),
      m(2, 'builtin:BasicFilter', 300, { condition: '{{1.status}} = "won"' }),
      m(3, 'google-sheets:addRow', 600, { spreadsheetId: '{{spreadsheetId}}', values: ['{{1.title}}', '{{1.value}}', '{{1.close_time}}', '{{1.owner_name}}'] }),
      m(4, 'gmail:sendEmail', 900, { to: '{{1.owner_email}}', subject: 'Deal Won: {{1.title}}', content: 'Congratulations! The deal "{{1.title}}" worth ${{1.value}} has been marked as won.' }),
    ],
  },
  {
    name: 'Typeform Lead → HubSpot Contact + Pipedrive Deal',
    category: 'Sales & CRM',
    description: 'Capture Typeform form submissions and instantly create a HubSpot contact and a Pipedrive deal to start your sales process.',
    tags: ['Typeform', 'HubSpot', 'Pipedrive'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'typeform:watchResponses', 0),
      m(2, 'hubspot-crm:createContact', 300, { email: '{{1.answers.email}}', firstname: '{{1.answers.name}}', company: '{{1.answers.company}}' }),
      m(3, 'pipedrive:createDeal', 600, { title: '{{1.answers.company}} - Inbound Lead', person_id: '{{2.id}}', value: '{{1.answers.budget}}' }),
    ],
  },
  {
    name: 'Calendly Booking → CRM Lead + Confirmation Email',
    category: 'Sales & CRM',
    description: 'When a prospect books a meeting in Calendly, create a lead in your CRM and send them a personalized confirmation email with meeting details.',
    tags: ['Calendly', 'HubSpot', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'calendly:watchEvents', 0),
      m(2, 'hubspot-crm:createContact', 300, { email: '{{1.email}}', firstname: '{{1.first_name}}', lastname: '{{1.last_name}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.email}}', subject: 'Meeting Confirmed - {{1.event_type_name}}', content: 'Hi {{1.first_name}}, your meeting is confirmed for {{1.start_time}}.' }),
      m(4, 'slack:createMessage', 900, { channel: '#sales', text: 'New Calendly booking: {{1.first_name}} {{1.last_name}} at {{1.start_time}}' }),
    ],
  },
  {
    name: 'Salesforce New Lead → Slack + Email Sequence',
    category: 'Sales & CRM',
    description: 'Alert your sales team in Slack when a new Salesforce lead comes in and trigger an automated email sequence to engage the prospect immediately.',
    tags: ['Salesforce', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    flow: [
      m(1, 'salesforce:watchLeads', 0),
      m(2, 'slack:createMessage', 300, { channel: '#sales-leads', text: 'New Salesforce lead: {{1.FirstName}} {{1.LastName}} from {{1.Company}} ({{1.Email}})' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.Email}}', subject: 'Welcome to our platform, {{1.FirstName}}!', content: 'Hi {{1.FirstName}}, thanks for your interest. Our team will reach out shortly.' }),
    ],
  },
  {
    name: 'Facebook Lead Ad → Pipedrive + Google Sheets',
    category: 'Sales & CRM',
    description: 'Capture Facebook Lead Ads submissions in real-time and push them to Pipedrive as deals while logging to Google Sheets for reporting.',
    tags: ['Facebook', 'Pipedrive', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'facebook-lead-ads:watchLeads', 0),
      m(2, 'pipedrive:createPerson', 300, { name: '{{1.full_name}}', email: '{{1.email}}', phone: '{{1.phone_number}}' }),
      m(3, 'pipedrive:createDeal', 600, { title: '{{1.full_name}} - Facebook Lead', person_id: '{{2.id}}' }),
      m(4, 'google-sheets:addRow', 900, { values: ['{{1.full_name}}', '{{1.email}}', '{{1.phone_number}}', 'Facebook Lead', '{{now}}'] }),
    ],
  },
  {
    name: 'New Gmail Email → Pipedrive Deal + HubSpot Note',
    category: 'Sales & CRM',
    description: 'Monitor a specific Gmail label for inbound sales inquiries and automatically create a Pipedrive deal and log the email as a HubSpot note.',
    tags: ['Gmail', 'Pipedrive', 'HubSpot'],
    trigger_type: 'Email',
    flow: [
      m(1, 'gmail:watchEmails', 0, { labelIds: ['INBOX'], q: 'label:sales-inquiry' }),
      m(2, 'pipedrive:createDeal', 300, { title: '{{1.subject}}', value: '0' }),
      m(3, 'hubspot-crm:createNote', 600, { body: 'Inbound email: {{1.subject}}\n\n{{1.snippet}}' }),
    ],
  },
  {
    name: 'Stripe Payment → HubSpot Deal Won + Receipt Email',
    category: 'Sales & CRM',
    description: 'When a Stripe payment succeeds, mark the corresponding HubSpot deal as won and send an automated receipt email to the customer.',
    tags: ['Stripe', 'HubSpot', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'stripe:watchEvents', 0, { events: ['payment_intent.succeeded'] }),
      m(2, 'hubspot-crm:searchContacts', 300, { filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: '{{1.customer.email}}' }] }] }),
      m(3, 'hubspot-crm:updateDeal', 600, { dealstage: 'closedwon', amount: '{{1.amount_received}}' }),
      m(4, 'gmail:sendEmail', 900, { to: '{{1.customer.email}}', subject: 'Payment Receipt - ${{1.amount_received_formatted}}', content: 'Thank you for your payment of ${{1.amount_received_formatted}}. Your transaction ID is {{1.id}}.' }),
    ],
  },
  {
    name: 'PandaDoc Signed → Pipedrive Won + Slack Celebration',
    category: 'Sales & CRM',
    description: 'When a PandaDoc proposal is signed by the client, automatically mark the Pipedrive deal as won and celebrate with a Slack message to the team.',
    tags: ['Pipedrive', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'pipedrive:updateDeal', 300, { id: '{{1.deal_id}}', status: 'won' }),
      m(3, 'slack:createMessage', 600, { channel: '#sales-wins', text: '🎉 Deal closed! {{1.deal_name}} just signed the contract! ' }),
    ],
  },
  {
    name: 'LinkedIn Lead Gen Form → HubSpot + Slack',
    category: 'Sales & CRM',
    description: 'Capture LinkedIn Lead Gen Form submissions and automatically create HubSpot contacts while alerting your sales team in Slack for immediate follow-up.',
    tags: ['HubSpot', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'hubspot-crm:createContact', 300, { email: '{{1.email}}', firstname: '{{1.firstName}}', lastname: '{{1.lastName}}', company: '{{1.company}}', jobtitle: '{{1.title}}' }),
      m(3, 'hubspot-crm:createDeal', 600, { dealname: '{{1.firstName}} {{1.lastName}} - LinkedIn Lead', dealstage: 'appointmentscheduled', associatedVids: ['{{2.id}}'] }),
      m(4, 'slack:createMessage', 900, { channel: '#sales', text: 'New LinkedIn lead: {{1.firstName}} {{1.lastName}}, {{1.title}} at {{1.company}}' }),
    ],
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    name: 'RSS Blog Post → Buffer Social Media Queue',
    category: 'Marketing',
    description: 'Monitor your blog RSS feed and automatically queue new posts to Buffer for publishing across all your social media channels.',
    tags: ['Buffer'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'rss:triggerRssFeed', 0),
      m(2, 'buffer:createUpdate', 300, { text: '{{1.title}} - {{1.link}} #blog #content', profile_ids: ['{{profileId}}'] }),
    ],
  },
  {
    name: 'Webinar Registration → Mailchimp + Google Sheets',
    category: 'Marketing',
    description: 'Add webinar registrants to a Mailchimp email list and log their details to Google Sheets for post-event follow-up campaigns.',
    tags: ['Mailchimp', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'mailchimp:subscribe', 300, { listId: '{{listId}}', email_address: '{{1.email}}', merge_fields: { FNAME: '{{1.first_name}}', LNAME: '{{1.last_name}}' } }),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.first_name}}', '{{1.last_name}}', '{{1.email}}', '{{1.company}}', '{{now}}'] }),
    ],
  },
  {
    name: 'YouTube New Video → Twitter + LinkedIn Post',
    category: 'Marketing',
    description: 'Automatically share your new YouTube videos on Twitter and LinkedIn with a custom message, saving hours of manual social posting.',
    tags: ['Twitter/X', 'LinkedIn'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'youtube:watchVideos', 0),
      m(2, 'twitter:createTweet', 300, { status: 'New video: {{1.snippet.title}} 🎬 Watch now: https://youtu.be/{{1.id.videoId}} #YouTube' }),
      m(3, 'linkedin:createShare', 600, { comment: 'Excited to share our latest video: {{1.snippet.title}}\n\nhttps://youtu.be/{{1.id.videoId}}' }),
    ],
  },
  {
    name: 'Google Analytics Weekly Report → Slack + Email',
    category: 'Marketing',
    description: 'Pull key Google Analytics metrics every week and deliver a formatted digest report to your team via Slack and email.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'google-analytics:runReport', 0, { metrics: ['sessions', 'users', 'bounceRate'], dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }] }),
      m(2, 'slack:createMessage', 300, { channel: '#marketing', text: '📊 Weekly Analytics Report\nSessions: {{1.rows.0.metricValues.0.value}}\nUsers: {{1.rows.0.metricValues.1.value}}\nBounce Rate: {{1.rows.0.metricValues.2.value}}%' }),
      m(3, 'gmail:sendEmail', 600, { to: 'team@company.com', subject: 'Weekly Analytics Report - {{formatDate(now, "MMM D, YYYY")}}', content: 'Weekly analytics summary attached.' }),
    ],
  },
  {
    name: 'WordPress New Post → Multi-Channel Social Share',
    category: 'Marketing',
    description: 'When you publish a new WordPress post, automatically share it across Facebook, Twitter, and LinkedIn with formatted messages.',
    tags: ['Facebook', 'Twitter/X', 'LinkedIn'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'wordpress:watchPosts', 0),
      m(2, 'facebook-pages:createPost', 300, { message: '📝 New post: {{1.title.rendered}}\n\n{{1.excerpt.rendered}}\n\nRead more: {{1.link}}' }),
      m(3, 'twitter:createTweet', 600, { status: '{{1.title.rendered}} - {{1.link}} #blog' }),
      m(4, 'linkedin:createShare', 900, { comment: 'New blog post: {{1.title.rendered}}\n\n{{1.link}}' }),
    ],
  },
  {
    name: 'Hotjar Survey Response → Mailchimp + Slack Alert',
    category: 'Marketing',
    description: 'Capture Hotjar survey responses and add respondents to a targeted Mailchimp segment while alerting your marketing team in Slack.',
    tags: ['Mailchimp', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'mailchimp:subscribe', 300, { listId: '{{listId}}', email_address: '{{1.email}}', tags: ['survey-respondent'] }),
      m(3, 'slack:createMessage', 600, { channel: '#marketing', text: 'New survey response from {{1.email}}: "{{1.feedback}}" (Rating: {{1.rating}}/10)' }),
    ],
  },
  {
    name: 'Mailchimp Campaign Sent → Google Sheets Analytics Log',
    category: 'Marketing',
    description: 'Automatically log every Mailchimp campaign send event to Google Sheets with open rates, click rates, and subscriber counts for trend analysis.',
    tags: ['Mailchimp', 'Google Sheets'],
    trigger_type: 'Event',
    flow: [
      m(1, 'mailchimp:watchCampaigns', 0, { status: 'sent' }),
      m(2, 'mailchimp:getCampaignReport', 300, { campaign_id: '{{1.id}}' }),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.settings.title}}', '{{2.emails_sent}}', '{{2.opens.open_rate}}', '{{2.clicks.click_rate}}', '{{1.send_time}}'] }),
    ],
  },
  {
    name: 'Instagram New Post → Facebook Page Repost',
    category: 'Marketing',
    description: 'Automatically mirror new Instagram posts to your Facebook Page to maximize content reach without any manual effort.',
    tags: ['Instagram', 'Facebook'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'instagram:watchMedia', 0),
      m(2, 'facebook-pages:createPost', 300, { message: '{{1.caption}}', link: '{{1.permalink}}' }),
    ],
  },
  {
    name: 'NPS Survey → Segment Users + Slack Alert',
    category: 'Marketing',
    description: 'Process NPS survey responses to segment promoters, passives, and detractors automatically, and alert your team for immediate follow-up on detractors.',
    tags: ['Mailchimp', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'builtin:BasicRouter', 300),
      m(3, 'mailchimp:addTagToContact', 600, { tag: '{{1.score >= 9 ? "promoter" : 1.score >= 7 ? "passive" : "detractor"}}', email: '{{1.email}}' }),
      m(4, 'google-sheets:addRow', 900, { values: ['{{1.email}}', '{{1.score}}', '{{1.comment}}', '{{now}}'] }),
      m(5, 'slack:createMessage', 1200, { channel: '#customer-success', text: '⚠️ NPS Detractor: {{1.email}} scored {{1.score}}/10. Comment: "{{1.comment}}"' }),
    ],
  },
  {
    name: 'Twitter Brand Mention → Slack Alert + Google Sheets Log',
    category: 'Marketing',
    description: 'Monitor Twitter for brand mentions in real time and log them to Google Sheets while sending an immediate Slack notification to your social team.',
    tags: ['Twitter/X', 'Slack', 'Google Sheets'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'twitter:searchTweets', 0, { q: '@YourBrand OR #YourBrand' }),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.user.screen_name}}', '{{1.full_text}}', '{{1.created_at}}', '{{1.favorite_count}}'] }),
      m(3, 'slack:createMessage', 600, { channel: '#social-mentions', text: '🐦 New mention by @{{1.user.screen_name}}: "{{1.full_text}}" — {{1.created_at}}' }),
    ],
  },

  // ── E-Commerce ────────────────────────────────────────────────────────────
  {
    name: 'Shopify New Order → Fulfillment Email + Slack',
    category: 'E-Commerce',
    description: 'When a new Shopify order comes in, send a fulfillment confirmation email to the customer and notify your operations team in Slack.',
    tags: ['Shopify', 'Gmail', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'shopify:watchOrders', 0),
      m(2, 'gmail:sendEmail', 300, { to: '{{1.email}}', subject: 'Order Confirmed #{{1.order_number}}', content: 'Hi {{1.billing_address.first_name}}, your order #{{1.order_number}} has been confirmed and is being processed.' }),
      m(3, 'slack:createMessage', 600, { channel: '#fulfillment', text: 'New Shopify order #{{1.order_number}} — ${{1.total_price}} from {{1.billing_address.first_name}} {{1.billing_address.last_name}}' }),
    ],
  },
  {
    name: 'WooCommerce Order → Google Sheets + QuickBooks',
    category: 'E-Commerce',
    description: 'Log every WooCommerce order to Google Sheets for reporting and create a corresponding QuickBooks sales receipt for bookkeeping.',
    tags: ['Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'woocommerce:watchOrders', 0),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.id}}', '{{1.billing.first_name}} {{1.billing.last_name}}', '{{1.billing.email}}', '{{1.total}}', '{{1.status}}', '{{1.date_created}}'] }),
      m(3, 'quickbooks:createSalesReceipt', 600, { CustomerRef: { value: '{{1.billing.email}}' }, TotalAmt: '{{1.total}}' }),
    ],
  },
  {
    name: 'Shopify Abandoned Cart → Email Recovery Sequence',
    category: 'E-Commerce',
    description: 'Detect abandoned Shopify carts and trigger a personalized recovery email sequence with a discount offer to win back the customer.',
    tags: ['Shopify', 'Mailchimp', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'shopify:watchAbandonedCheckouts', 0),
      m(2, 'builtin:BasicFilter', 300, { condition: '{{1.abandoned_checkout_url}} != ""' }),
      m(3, 'mailchimp:subscribe', 600, { listId: '{{listId}}', email_address: '{{1.email}}', tags: ['abandoned-cart'] }),
      m(4, 'gmail:sendEmail', 900, { to: '{{1.email}}', subject: 'You left something behind...', content: 'Hi {{1.billing_address.first_name}}, you forgot items in your cart! Use code COMEBACK10 for 10% off: {{1.abandoned_checkout_url}}' }),
    ],
  },
  {
    name: 'Shopify Refund → Accounting Update + Customer Email',
    category: 'E-Commerce',
    description: 'Process Shopify refunds by updating your accounting records in QuickBooks and sending a professional refund confirmation email to the customer.',
    tags: ['Shopify', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'shopify:watchRefunds', 0),
      m(2, 'quickbooks:createCreditMemo', 300, { CustomerRef: { value: '{{1.order.customer.email}}' }, TotalAmt: '{{1.transactions.0.amount}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.order.email}}', subject: 'Refund Processed - Order #{{1.order.order_number}}', content: 'Your refund of ${{1.transactions.0.amount}} has been processed and will appear in 3-5 business days.' }),
      m(4, 'slack:createMessage', 900, { channel: '#ecommerce', text: 'Refund processed: Order #{{1.order.order_number}} — ${{1.transactions.0.amount}} to {{1.order.email}}' }),
    ],
  },
  {
    name: 'New Product Review → Slack + Email Alert',
    category: 'E-Commerce',
    description: 'Monitor for new product reviews and instantly notify your team in Slack, especially flagging low-rated reviews that need immediate attention.',
    tags: ['Shopify', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'builtin:BasicRouter', 300),
      m(3, 'slack:createMessage', 600, { channel: '#reviews', text: '⭐ New review ({{1.rating}}/5) for {{1.product}}: "{{1.body}}" — {{1.author}}' }),
      m(4, 'slack:createMessage', 900, { channel: '#urgent', text: '🚨 Low review alert! {{1.product}} received {{1.rating}}/5: "{{1.body}}"' }),
    ],
  },
  {
    name: 'Out of Stock Product → Supplier Email + Slack Alert',
    category: 'E-Commerce',
    description: 'Detect out-of-stock products in Shopify and automatically send a reorder email to your supplier while alerting the team in Slack.',
    tags: ['Shopify', 'Gmail', 'Slack'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'shopify:searchProducts', 0, { inventory_quantity_less_than: 1 }),
      m(2, 'gmail:sendEmail', 300, { to: 'supplier@vendor.com', subject: 'Reorder Request: {{1.title}}', content: 'Please reorder SKU {{1.variants.0.sku}} - {{1.title}}. Current stock: {{1.variants.0.inventory_quantity}}' }),
      m(3, 'slack:createMessage', 600, { channel: '#inventory', text: '📦 Out of stock: {{1.title}} (SKU: {{1.variants.0.sku}}) - Reorder email sent to supplier' }),
    ],
  },
  {
    name: 'Stripe Subscription Created → Welcome Email + CRM',
    category: 'E-Commerce',
    description: 'When a new Stripe subscription is created, send a personalized welcome email and create or update the customer record in HubSpot.',
    tags: ['Stripe', 'HubSpot', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'stripe:watchEvents', 0, { events: ['customer.subscription.created'] }),
      m(2, 'hubspot-crm:createContact', 300, { email: '{{1.customer.email}}', firstname: '{{1.customer.name}}', lifecyclestage: 'customer' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.customer.email}}', subject: 'Welcome to {{planName}}!', content: 'Hi {{1.customer.name}}, welcome aboard! Your {{1.plan.nickname}} subscription is now active.' }),
    ],
  },
  {
    name: 'WooCommerce Low Stock → Slack + Reorder Google Sheet',
    category: 'E-Commerce',
    description: 'Automatically detect low-stock WooCommerce products and log them to a Google Sheets reorder tracker while sending a Slack alert to your inventory team.',
    tags: ['Google Sheets', 'Slack'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'woocommerce:watchProducts', 0, { stock_status: 'onbackorder', stock_quantity_max: 5 }),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.name}}', '{{1.sku}}', '{{1.stock_quantity}}', '{{now}}', 'Reorder needed'] }),
      m(3, 'slack:createMessage', 600, { channel: '#inventory', text: '⚠️ Low stock alert: {{1.name}} (SKU: {{1.sku}}) has only {{1.stock_quantity}} units left' }),
    ],
  },
  {
    name: 'PayPal Payment Received → Invoice + Spreadsheet',
    category: 'E-Commerce',
    description: 'Process incoming PayPal payments by generating a professional invoice and logging all payment details to a Google Sheets financial tracker.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.payer.email_address}}', '{{1.purchase_units.0.amount.value}}', '{{1.purchase_units.0.description}}', '{{1.id}}', '{{now}}'] }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.payer.email_address}}', subject: 'Payment Received — Thank You!', content: 'Hi {{1.payer.name.given_name}}, we received your payment of ${{1.purchase_units.0.amount.value}}. Invoice attached.' }),
    ],
  },
  {
    name: 'Shopify Order Shipped → Tracking Email + SMS',
    category: 'E-Commerce',
    description: 'When a Shopify fulfillment is created, send the customer a shipping confirmation email with their tracking number and an SMS notification.',
    tags: ['Shopify', 'Gmail', 'SMS'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'shopify:watchFulfillments', 0),
      m(2, 'gmail:sendEmail', 300, { to: '{{1.order.email}}', subject: 'Your Order #{{1.order.order_number}} Has Shipped!', content: 'Your order has been shipped! Tracking number: {{1.tracking_number}}. Track at: {{1.tracking_url}}' }),
      m(3, 'twilio:sendSms', 600, { To: '{{1.order.phone}}', Body: 'Order #{{1.order.order_number}} shipped! Track: {{1.tracking_url}}' }),
    ],
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    name: 'Invoice Created → QuickBooks + Client Email',
    category: 'Finance',
    description: 'Automatically create an invoice in QuickBooks Online and send it to the client via email when a new project milestone is triggered.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'quickbooks:createInvoice', 300, { CustomerRef: { value: '{{1.customer_id}}' }, Line: [{ Amount: '{{1.amount}}', Description: '{{1.description}}' }] }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.client_email}}', subject: 'Invoice #{{2.DocNumber}} — ${{1.amount}}', content: 'Please find your invoice attached. Payment is due within 30 days.' }),
    ],
  },
  {
    name: 'Receipt Email → Google Sheets Expense Tracker',
    category: 'Finance',
    description: 'Parse expense receipt emails in Gmail and automatically log them to a Google Sheets expense tracker with category, amount, and vendor.',
    tags: ['Gmail', 'Google Sheets', 'Slack'],
    trigger_type: 'Email',
    flow: [
      m(1, 'gmail:watchEmails', 0, { q: 'label:receipts' }),
      m(2, 'builtin:TextParser', 300),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.from}}', '{{2.amount}}', '{{2.vendor}}', '{{2.date}}', 'Uncategorized'] }),
      m(4, 'slack:createMessage', 900, { channel: '#finance', text: 'New expense logged: {{2.vendor}} — ${{2.amount}} on {{2.date}}' }),
    ],
  },
  {
    name: 'Stripe Monthly Revenue → Google Sheets Dashboard',
    category: 'Finance',
    description: 'Pull Stripe revenue metrics at the end of each month and populate a Google Sheets financial dashboard with MRR, new customers, and churn.',
    tags: ['Stripe', 'Google Sheets'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'builtin:BasicScheduler', 0, { interval: 'monthly' }),
      m(2, 'stripe:listBalanceTransactions', 300, { created: { gte: '{{startOfMonth}}', lte: '{{endOfMonth}}' } }),
      m(3, 'builtin:SetVariables', 600),
      m(4, 'google-sheets:updateRow', 900, { values: ['{{month}}', '{{totalRevenue}}', '{{newCustomers}}', '{{refunds}}'] }),
    ],
  },
  {
    name: 'Overdue Invoice → Email Reminder Sequence',
    category: 'Finance',
    description: 'Automatically detect overdue invoices in QuickBooks and trigger a polite payment reminder email sequence with escalation after 30 days.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'quickbooks:searchInvoices', 0, { DueDate_lt: '{{today}}', Balance_gt: 0 }),
      m(2, 'builtin:BasicRouter', 300),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.BillEmail.Address}}', subject: 'Payment Reminder — Invoice #{{1.DocNumber}}', content: 'This is a friendly reminder that Invoice #{{1.DocNumber}} for ${{1.Balance}} was due on {{1.DueDate}}.' }),
      m(4, 'slack:createMessage', 900, { channel: '#finance', text: '⚠️ Overdue invoice: #{{1.DocNumber}} — ${{1.Balance}} overdue since {{1.DueDate}}' }),
    ],
  },
  {
    name: 'Xero Invoice Paid → Slack + Google Sheets Update',
    category: 'Finance',
    description: 'When a Xero invoice is marked as paid, update the Google Sheets revenue tracker and notify the finance team in Slack.',
    tags: ['Google Sheets', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'xero:watchInvoices', 0, { Status: 'PAID' }),
      m(2, 'google-sheets:updateRow', 300, { filter: '{{1.InvoiceNumber}}', values: ['PAID', '{{1.AmountPaid}}', '{{now}}'] }),
      m(3, 'slack:createMessage', 600, { channel: '#finance', text: '💰 Invoice paid: #{{1.InvoiceNumber}} — ${{1.AmountPaid}} from {{1.Contact.Name}}' }),
    ],
  },
  {
    name: 'Monthly P&L Report → Email Digest to Executives',
    category: 'Finance',
    description: 'Compile monthly profit and loss data from multiple sources and generate an automated email digest report for company executives.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'builtin:BasicScheduler', 0),
      m(2, 'google-sheets:getRows', 300, { spreadsheetId: '{{pnlSpreadsheetId}}' }),
      m(3, 'builtin:SetVariables', 600),
      m(4, 'gmail:sendEmail', 900, { to: 'executives@company.com', subject: 'Monthly P&L Report — {{formatDate(now, "MMMM YYYY")}}', content: 'Please find the monthly P&L summary below:\n\nRevenue: ${{revenue}}\nExpenses: ${{expenses}}\nNet Profit: ${{profit}}' }),
    ],
  },
  {
    name: 'Harvest Time Entry → QuickBooks Invoice',
    category: 'Finance',
    description: 'Automatically convert approved Harvest timesheets into QuickBooks invoices at the end of each billing period, eliminating manual invoice creation.',
    tags: ['Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'harvest:watchTimeEntries', 0, { is_billed: false, is_running: false }),
      m(2, 'builtin:SetVariables', 300),
      m(3, 'quickbooks:createInvoice', 600, { CustomerRef: { value: '{{1.client.id}}' }, Line: [{ Amount: '{{1.hours * 1.hourly_rate}}', Description: '{{1.task.name}}: {{1.notes}}' }] }),
    ],
  },
  {
    name: 'QuickBooks New Bill → Manager Approval Workflow',
    category: 'Finance',
    description: 'When a new bill is created in QuickBooks above a threshold amount, send an approval request email to the finance manager with one-click approve/reject.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'quickbooks:watchBills', 0),
      m(2, 'builtin:BasicFilter', 300, { condition: '{{1.TotalAmt}} > 1000' }),
      m(3, 'gmail:sendEmail', 600, { to: 'manager@company.com', subject: 'Approval Required: Bill #{{1.DocNumber}} — ${{1.TotalAmt}}', content: 'A new bill requires your approval:\n\nVendor: {{1.VendorRef.name}}\nAmount: ${{1.TotalAmt}}\nDue: {{1.DueDate}}\n\nApprove: {{approveLink}}\nReject: {{rejectLink}}' }),
      m(4, 'slack:createMessage', 900, { channel: '#finance', text: '📋 Bill approval needed: {{1.VendorRef.name}} — ${{1.TotalAmt}} (manager notified via email)' }),
    ],
  },
  {
    name: 'Stripe Dispute Created → Slack + Evidence Collection',
    category: 'Finance',
    description: 'When a Stripe dispute is filed, immediately alert the finance team in Slack and create a Trello card to collect evidence for the dispute response.',
    tags: ['Stripe', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'stripe:watchEvents', 0, { events: ['charge.dispute.created'] }),
      m(2, 'slack:createMessage', 300, { channel: '#finance-urgent', text: '🚨 Stripe Dispute Filed!\nAmount: ${{1.data.object.amount_formatted}}\nReason: {{1.data.object.reason}}\nDue: {{1.data.object.evidence_details.due_by}}\nRespond immediately!' }),
      m(3, 'trello:createCard', 600, { idList: '{{disputeListId}}', name: 'Dispute: ${{1.data.object.amount_formatted}} — {{1.data.object.reason}}', desc: 'Charge ID: {{1.data.object.charge}}\nEvidence due: {{1.data.object.evidence_details.due_by}}' }),
    ],
  },
  {
    name: 'Expense Over Budget → Alert + Google Sheets Flag',
    category: 'Finance',
    description: 'Monitor expense submissions and automatically flag and alert when a category exceeds its monthly budget, preventing budget overruns.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'google-sheets:getRow', 300, { filter: '{{1.category}}' }),
      m(3, 'builtin:BasicFilter', 600, { condition: '{{1.amount + 2.spent}} > {{2.budget}}' }),
      m(4, 'slack:createMessage', 900, { channel: '#finance', text: '🚨 Budget overrun: {{1.category}} is now ${{total}} vs ${{2.budget}} budget!' }),
      m(5, 'gmail:sendEmail', 1200, { to: 'cfo@company.com', subject: 'Budget Alert: {{1.category}} Over Budget', content: 'The {{1.category}} budget has been exceeded. Current spend: ${{total}}, Budget: ${{2.budget}}' }),
    ],
  },

  // ── HR & Recruiting ────────────────────────────────────────────────────────
  {
    name: 'Job Application Received → ATS + Slack + Email',
    category: 'HR & Recruiting',
    description: 'When a job application is submitted, add it to your ATS, notify the hiring manager in Slack, and send the applicant an automated acknowledgment email.',
    tags: ['Gmail', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.name}}', '{{1.email}}', '{{1.position}}', '{{1.linkedin}}', '{{now}}', 'Applied'] }),
      m(3, 'slack:createMessage', 600, { channel: '#recruiting', text: '📋 New application for {{1.position}}: {{1.name}} ({{1.email}})' }),
      m(4, 'gmail:sendEmail', 900, { to: '{{1.email}}', subject: 'Application Received — {{1.position}}', content: 'Hi {{1.name}}, we received your application for {{1.position}} and will review it shortly.' }),
    ],
  },
  {
    name: 'New Hire Onboarding → BambooHR + GSuite + Slack Welcome',
    category: 'HR & Recruiting',
    description: 'Automate the new hire onboarding process by creating a BambooHR profile, setting up GSuite accounts, and sending a Slack welcome message.',
    tags: ['BambooHR', 'Gmail', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'bamboohr:createEmployee', 300, { firstName: '{{1.firstName}}', lastName: '{{1.lastName}}', workEmail: '{{1.email}}', department: '{{1.department}}', hireDate: '{{1.startDate}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.email}}', subject: 'Welcome to the Team, {{1.firstName}}!', content: 'Hi {{1.firstName}}, welcome to {{companyName}}! Your first day is {{1.startDate}}. Here is what to expect...' }),
      m(4, 'slack:createMessage', 900, { channel: '#general', text: '👋 Please welcome {{1.firstName}} {{1.lastName}} who is joining us as {{1.jobTitle}} on {{1.startDate}}!' }),
    ],
  },
  {
    name: 'PTO Request → Manager Email + Calendar Block',
    category: 'HR & Recruiting',
    description: 'Process PTO requests from BambooHR by sending an approval request to the manager and blocking the dates on the team Google Calendar.',
    tags: ['BambooHR', 'Gmail'],
    trigger_type: 'Event',
    flow: [
      m(1, 'bamboohr:watchTimeOffRequests', 0, { status: 'requested' }),
      m(2, 'gmail:sendEmail', 300, { to: '{{managerEmail}}', subject: 'PTO Approval Required: {{1.employeeName}}', content: '{{1.employeeName}} has requested {{1.workingDays}} days off from {{1.startDate}} to {{1.endDate}}.\n\nApprove: {{approveLink}}\nDeny: {{denyLink}}' }),
      m(3, 'google-calendar:createEvent', 600, { summary: '{{1.employeeName}} - PTO (Pending)', start: { date: '{{1.startDate}}' }, end: { date: '{{1.endDate}}' } }),
    ],
  },
  {
    name: 'Interview Scheduled → ATS Update + Calendar Invite',
    category: 'HR & Recruiting',
    description: 'When a Calendly interview is booked, update the candidate status in your ATS and send calendar invites to both the interviewer and candidate.',
    tags: ['Calendly', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'calendly:watchEvents', 0),
      m(2, 'google-sheets:updateRow', 300, { filter: '{{1.invitee.email}}', values: ['Interview Scheduled', '{{1.start_time}}'] }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.invitee.email}}', subject: 'Interview Confirmed — {{1.event_type.name}}', content: 'Hi {{1.invitee.name}}, your interview is confirmed for {{1.start_time}}. Join link: {{1.location.join_url}}' }),
      m(4, 'slack:createMessage', 900, { channel: '#recruiting', text: '📅 Interview scheduled: {{1.invitee.name}} on {{1.start_time}} for {{1.event_type.name}}' }),
    ],
  },
  {
    name: 'Employee Birthday → Slack Greeting + Gift Card',
    category: 'HR & Recruiting',
    description: 'Automatically celebrate employee birthdays with a personalized Slack message to the team and trigger a gift card email reward.',
    tags: ['BambooHR', 'Slack', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'bamboohr:searchEmployees', 0, { birthday: '{{today}}' }),
      m(2, 'slack:createMessage', 300, { channel: '#general', text: '🎂 Happy Birthday to {{1.firstName}} {{1.lastName}}! Please join us in wishing them a wonderful day!' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.workEmail}}', subject: 'Happy Birthday from the Team! 🎉', content: 'Hi {{1.firstName}}, wishing you a wonderful birthday! Enjoy your special gift card as a token of appreciation.' }),
    ],
  },
  {
    name: 'Offboarding Trigger → Checklist + Slack + IT Ticket',
    category: 'HR & Recruiting',
    description: 'When an employee is marked as terminated in BambooHR, trigger the full offboarding workflow: IT ticket, access revocation checklist, and team notification.',
    tags: ['BambooHR', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    flow: [
      m(1, 'bamboohr:watchEmployees', 0, { status: 'Terminated' }),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.firstName}} {{1.lastName}}', '{{1.terminationDate}}', '{{1.department}}', 'Offboarding Started'] }),
      m(3, 'slack:createMessage', 600, { channel: '#it-support', text: '🔒 Offboarding: Please revoke all system access for {{1.firstName}} {{1.lastName}} (last day: {{1.terminationDate}})' }),
      m(4, 'gmail:sendEmail', 900, { to: 'it@company.com', subject: 'Offboarding Checklist: {{1.firstName}} {{1.lastName}}', content: 'Employee offboarding initiated. Please complete the deprovisioning checklist for {{1.firstName}} {{1.lastName}} by {{1.terminationDate}}.' }),
    ],
  },
  {
    name: 'Resume via Email → ATS + Recruiter Slack Alert',
    category: 'HR & Recruiting',
    description: 'Parse incoming resume emails and automatically add candidates to your ATS spreadsheet while alerting recruiters in Slack for quick review.',
    tags: ['Gmail', 'Google Sheets', 'Slack'],
    trigger_type: 'Email',
    flow: [
      m(1, 'gmail:watchEmails', 0, { q: 'label:resumes subject:resume OR subject:application' }),
      m(2, 'builtin:TextParser', 300),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.from}}', '{{1.subject}}', '{{now}}', 'New', '{{1.snippet}}'] }),
      m(4, 'slack:createMessage', 900, { channel: '#recruiting', text: '📄 New resume received from {{1.from}}: "{{1.subject}}" — Review in ATS' }),
    ],
  },
  {
    name: 'Performance Review Due → BambooHR + Manager Email',
    category: 'HR & Recruiting',
    description: 'Automatically send performance review reminders to managers 30 days before the scheduled review date, with instructions and the review form link.',
    tags: ['BambooHR', 'Gmail', 'Slack'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'bamboohr:searchEmployees', 0, { nextReviewDate: '{{dateAdd(today, 30, "days")}}' }),
      m(2, 'gmail:sendEmail', 300, { to: '{{managerEmail}}', subject: 'Performance Review Due in 30 Days: {{1.firstName}} {{1.lastName}}', content: 'A performance review for {{1.firstName}} {{1.lastName}} is due on {{1.nextReviewDate}}. Please complete the review form: {{reviewFormLink}}' }),
      m(3, 'slack:createMessage', 600, { channel: '#hr', text: '📊 Performance review reminder sent to manager for {{1.firstName}} {{1.lastName}} (due: {{1.nextReviewDate}})' }),
    ],
  },
  {
    name: 'Candidate Offer Accepted → Onboarding Kickoff',
    category: 'HR & Recruiting',
    description: 'When a job offer is accepted, automatically kick off the onboarding process by creating BambooHR profile, sending welcome email, and ordering equipment.',
    tags: ['BambooHR', 'Gmail', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'bamboohr:createEmployee', 300, { firstName: '{{1.firstName}}', lastName: '{{1.lastName}}', workEmail: '{{1.email}}', hireDate: '{{1.startDate}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.email}}', subject: 'Welcome to {{companyName}} — Your Offer is Confirmed!', content: 'Hi {{1.firstName}}, welcome to the team! Your start date is {{1.startDate}}. We are thrilled to have you join us.' }),
      m(4, 'slack:createMessage', 900, { channel: '#hr', text: '🎉 Offer accepted! {{1.firstName}} {{1.lastName}} will join as {{1.jobTitle}} on {{1.startDate}}. Onboarding initiated.' }),
      m(5, 'trello:createCard', 1200, { idList: '{{onboardingListId}}', name: 'Onboard: {{1.firstName}} {{1.lastName}} — {{1.startDate}}', desc: 'Role: {{1.jobTitle}}\nDepartment: {{1.department}}\nEquipment: laptop, monitor, accessories' }),
    ],
  },
  {
    name: 'Weekly Headcount Report → Google Sheets + Email',
    category: 'HR & Recruiting',
    description: 'Generate a weekly headcount and department breakdown report from BambooHR data and send it to HR leadership via email and Google Sheets.',
    tags: ['BambooHR', 'Google Sheets', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'bamboohr:listEmployees', 0, { status: 'active' }),
      m(2, 'builtin:SetVariables', 300),
      m(3, 'google-sheets:addRow', 600, { values: ['{{formatDate(now, "YYYY-MM-DD")}}', '{{totalCount}}', '{{engineeringCount}}', '{{salesCount}}', '{{marketingCount}}'] }),
      m(4, 'gmail:sendEmail', 900, { to: 'hr-leadership@company.com', subject: 'Weekly Headcount Report — {{formatDate(now, "MMM D")}}', content: 'Total employees: {{totalCount}}\nNew hires this week: {{newHires}}\nDepartment breakdown in Google Sheets.' }),
    ],
  },

  // ── Customer Support ───────────────────────────────────────────────────────
  {
    name: 'New Zendesk Ticket → Slack Alert + Auto-assign',
    category: 'Customer Support',
    description: 'When a new Zendesk support ticket is created, immediately notify the support team in Slack and automatically assign it based on category keywords.',
    tags: ['Zendesk', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'zendesk:watchTickets', 0),
      m(2, 'slack:createMessage', 300, { channel: '#support', text: '🎫 New ticket #{{1.id}}: "{{1.subject}}" from {{1.requester.email}} (Priority: {{1.priority}})' }),
      m(3, 'zendesk:updateTicket', 600, { id: '{{1.id}}', assignee_id: '{{determineAgent(1.subject)}}' }),
    ],
  },
  {
    name: 'CSAT Survey → Zendesk Tag + Google Sheets',
    category: 'Customer Support',
    description: 'Process CSAT survey responses and update Zendesk ticket tags while logging all scores to Google Sheets for support quality reporting.',
    tags: ['Zendesk', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'zendesk:updateTicket', 300, { id: '{{1.ticket_id}}', tags: ['csat-{{1.rating}}'] }),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.ticket_id}}', '{{1.rating}}', '{{1.comment}}', '{{1.agent_name}}', '{{now}}'] }),
    ],
  },
  {
    name: 'High Priority Ticket → PagerDuty + Slack + Escalation',
    category: 'Customer Support',
    description: 'When a Zendesk ticket is marked as Urgent, trigger a PagerDuty incident and escalate to senior support via Slack with a 5-minute response SLA.',
    tags: ['Zendesk', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'zendesk:watchTickets', 0, { priority: 'urgent' }),
      m(2, 'slack:createMessage', 300, { channel: '#support-urgent', text: '🚨 URGENT Ticket #{{1.id}}: "{{1.subject}}" from {{1.requester.email}} — 5 min SLA!' }),
      m(3, 'gmail:sendEmail', 600, { to: 'support-lead@company.com', subject: '[URGENT] Escalation: Ticket #{{1.id}}', content: 'Urgent ticket requires immediate attention.\n\nSubject: {{1.subject}}\nFrom: {{1.requester.email}}\nDetails: {{1.description}}' }),
    ],
  },
  {
    name: 'Intercom Conversation → Zendesk Ticket + CRM Note',
    category: 'Customer Support',
    description: 'Bridge Intercom and Zendesk by creating a Zendesk ticket for every new Intercom conversation and logging the interaction to HubSpot CRM.',
    tags: ['Zendesk', 'HubSpot'],
    trigger_type: 'Event',
    flow: [
      m(1, 'intercom:watchConversations', 0),
      m(2, 'zendesk:createTicket', 300, { subject: 'Intercom: {{1.conversation_message.subject}}', description: '{{1.conversation_message.body}}', requester: { email: '{{1.user.email}}' } }),
      m(3, 'hubspot-crm:createNote', 600, { body: 'Intercom support conversation: {{1.conversation_message.body}}' }),
    ],
  },
  {
    name: 'Customer Churn Signal → CRM + Slack + Email Outreach',
    category: 'Customer Support',
    description: 'Detect churn signals (low usage, support tickets, negative CSAT) and trigger an automated customer success outreach sequence.',
    tags: ['HubSpot', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'hubspot-crm:updateContact', 300, { id: '{{1.contact_id}}', churn_risk: '{{1.risk_level}}' }),
      m(3, 'slack:createMessage', 600, { channel: '#customer-success', text: '⚠️ Churn risk detected: {{1.company}} ({{1.contact_email}}) — Risk: {{1.risk_level}}\nSignal: {{1.signal}}' }),
      m(4, 'gmail:sendEmail', 900, { to: '{{1.contact_email}}', subject: 'Checking In — How Can We Help?', content: 'Hi {{1.first_name}}, I wanted to personally reach out to make sure you are getting the most out of {{productName}}. Can we schedule a quick call?' }),
    ],
  },
  {
    name: 'Support Email → Zendesk Ticket + Auto-Reply',
    category: 'Customer Support',
    description: 'Convert support emails to Zendesk tickets automatically and send a branded auto-reply with a ticket number and expected response time.',
    tags: ['Gmail', 'Zendesk'],
    trigger_type: 'Email',
    flow: [
      m(1, 'gmail:watchEmails', 0, { q: 'to:support@company.com' }),
      m(2, 'zendesk:createTicket', 300, { subject: '{{1.subject}}', description: '{{1.bodyText}}', requester: { email: '{{1.from}}' } }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.from}}', subject: 'Re: {{1.subject}} [Ticket #{{2.id}}]', content: 'Thank you for contacting support. Your ticket #{{2.id}} has been created. We will respond within 24 hours.' }),
    ],
  },
  {
    name: 'Freshdesk SLA Breach → Escalation Email + Slack',
    category: 'Customer Support',
    description: 'Detect Freshdesk SLA breaches and immediately escalate to support managers via email and Slack to ensure timely resolution.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'slack:createMessage', 300, { channel: '#support-escalations', text: '🔴 SLA Breach! Ticket #{{1.ticket_id}} "{{1.subject}}" from {{1.customer_email}} has breached {{1.sla_type}} SLA by {{1.breach_time}} minutes' }),
      m(3, 'gmail:sendEmail', 600, { to: 'support-manager@company.com', subject: 'SLA Breach: Ticket #{{1.ticket_id}}', content: 'SLA breach detected for ticket #{{1.ticket_id}}. Immediate action required.\n\nCustomer: {{1.customer_email}}\nSubject: {{1.subject}}' }),
    ],
  },
  {
    name: 'Ticket Resolved → CSAT Email + Satisfaction Log',
    category: 'Customer Support',
    description: 'When a Zendesk ticket is resolved, automatically send a CSAT survey email and log the ticket resolution data to Google Sheets.',
    tags: ['Zendesk', 'Gmail', 'Google Sheets'],
    trigger_type: 'Event',
    flow: [
      m(1, 'zendesk:watchTickets', 0, { status: 'solved' }),
      m(2, 'gmail:sendEmail', 300, { to: '{{1.requester.email}}', subject: 'How did we do? Rate your support experience', content: 'Hi {{1.requester.name}}, your ticket #{{1.id}} has been resolved. Please rate your experience:\n\n⭐ {{surveyLink1}}\n⭐⭐ {{surveyLink2}}\n⭐⭐⭐ {{surveyLink3}}\n⭐⭐⭐⭐ {{surveyLink4}}\n⭐⭐⭐⭐⭐ {{surveyLink5}}' }),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.id}}', '{{1.requester.email}}', '{{1.subject}}', '{{1.assignee.name}}', '{{1.solved_at}}', 'Awaiting CSAT'] }),
    ],
  },
  {
    name: 'Knowledge Base Gap → Notion Article Draft',
    category: 'Customer Support',
    description: 'Analyze recurring support tickets for common questions and automatically create Notion drafts for new knowledge base articles to reduce ticket volume.',
    tags: ['Zendesk', 'Slack'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'zendesk:searchTickets', 0, { query: 'created>{{last7Days}} type:ticket' }),
      m(2, 'builtin:SetVariables', 300),
      m(3, 'notion:createDatabaseItem', 600, { parent: { database_id: '{{kbDatabaseId}}' }, properties: { Name: { title: [{ text: { content: 'KB Draft: {{topQuestion}}' } }] }, Status: { select: { name: 'Draft' } } } }),
      m(4, 'slack:createMessage', 900, { channel: '#support', text: '📝 KB gap identified: "{{topQuestion}}" appeared {{occurrences}} times this week. Draft article created in Notion.' }),
    ],
  },
  {
    name: 'Live Chat Transcript → CRM + Support Sheet',
    category: 'Customer Support',
    description: 'Capture completed live chat transcripts and automatically save them to HubSpot CRM notes and log key details to a Google Sheets support tracker.',
    tags: ['HubSpot', 'Google Sheets', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'hubspot-crm:createNote', 300, { body: 'Live chat transcript:\n\n{{1.transcript}}', associations: [{ to: { id: '{{1.contact_id}}' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }] }),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.visitor_name}}', '{{1.visitor_email}}', '{{1.agent_name}}', '{{1.duration}}', '{{1.resolved}}', '{{1.started_at}}'] }),
    ],
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    name: 'Daily Slack Digest → Email Summary',
    category: 'Communication',
    description: 'Compile important Slack channel messages from the day and deliver a formatted email digest to stakeholders who prefer email communication.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'slack:getChannelMessages', 0, { channel: 'C0123456', oldest: '{{startOfDay}}' }),
      m(2, 'builtin:SetVariables', 300),
      m(3, 'gmail:sendEmail', 600, { to: 'leadership@company.com', subject: 'Daily Slack Digest — {{formatDate(now, "MMM D")}}', content: '{{digestContent}}' }),
    ],
  },
  {
    name: 'Important Gmail → Slack Channel Notification',
    category: 'Communication',
    description: 'Forward important emails (VIP senders or specific subjects) from Gmail to relevant Slack channels for the team to see immediately.',
    tags: ['Gmail', 'Slack'],
    trigger_type: 'Email',
    flow: [
      m(1, 'gmail:watchEmails', 0, { q: 'label:important is:unread' }),
      m(2, 'slack:createMessage', 300, { channel: '#inbox-alerts', text: '📧 Important email from {{1.from}}: "{{1.subject}}"\n\n{{1.snippet}}' }),
    ],
  },
  {
    name: 'Microsoft Teams Message → Trello Card',
    category: 'Communication',
    description: 'Convert Microsoft Teams messages tagged with specific keywords into Trello action items automatically, ensuring nothing falls through the cracks.',
    tags: ['Microsoft Teams'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'microsoft-teams:watchMessages', 0, { containsKeyword: 'TODO' }),
      m(2, 'trello:createCard', 300, { idList: '{{todoListId}}', name: '{{1.body.content}}', desc: 'From Teams: {{1.from.user.displayName}} in {{1.channelIdentity.teamId}}' }),
      m(3, 'microsoft-teams:createMessage', 600, { channelId: '{{1.channelIdentity.channelId}}', content: '✅ Trello card created for: "{{1.body.content}}"' }),
    ],
  },
  {
    name: 'Twilio SMS Received → Slack + CRM Note',
    category: 'Communication',
    description: 'When your business number receives an SMS via Twilio, forward it to a Slack channel and log it as a CRM note for customer communication tracking.',
    tags: ['SMS', 'Slack', 'HubSpot'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'twilio:watchSms', 0),
      m(2, 'slack:createMessage', 300, { channel: '#sms-inbox', text: '📱 SMS from {{1.From}}: "{{1.Body}}"' }),
      m(3, 'hubspot-crm:createNote', 600, { body: 'SMS received from {{1.From}}: {{1.Body}}' }),
    ],
  },
  {
    name: 'Typeform Response → Slack Alert + Database',
    category: 'Communication',
    description: 'Send Typeform survey or form responses to a Slack channel for immediate review and store all submissions in a structured database sheet.',
    tags: ['Typeform', 'Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'typeform:watchResponses', 0),
      m(2, 'slack:createMessage', 300, { channel: '#form-submissions', text: '📝 New form submission from {{1.answers.email}}:\n{{formattedAnswers}}' }),
      m(3, 'google-sheets:addRow', 600, { values: ['{{1.answers.name}}', '{{1.answers.email}}', '{{1.answers.message}}', '{{1.submitted_at}}'] }),
    ],
  },
  {
    name: 'Zoom Meeting Ended → Summary Email + Notion Notes',
    category: 'Communication',
    description: 'After a Zoom meeting ends, automatically send a follow-up email to all participants and create a meeting notes page in Notion.',
    tags: ['Zoom', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'zoom:watchMeetings', 0, { event: 'meeting.ended' }),
      m(2, 'notion:createDatabaseItem', 300, { parent: { database_id: '{{meetingsDatabaseId}}' }, properties: { Name: { title: [{ text: { content: '{{1.topic}} — {{formatDate(1.start_time, "MMM D, YYYY")}}' } }] }, Duration: { number: '{{1.duration}}' } } }),
      m(3, 'gmail:sendEmail', 600, { to: '{{participantEmails}}', subject: 'Meeting Summary: {{1.topic}}', content: 'Thank you for joining {{1.topic}} on {{1.start_time}}. Meeting notes have been added to Notion.' }),
    ],
  },
  {
    name: 'WhatsApp Message → Slack Mirror + CRM',
    category: 'Communication',
    description: 'Mirror incoming WhatsApp Business messages to a Slack channel and log each conversation to your CRM for unified communication tracking.',
    tags: ['WhatsApp', 'Slack', 'HubSpot'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'whatsapp-business:watchMessages', 0),
      m(2, 'slack:createMessage', 300, { channel: '#whatsapp-inbox', text: '💬 WhatsApp from {{1.from}}: "{{1.text.body}}"' }),
      m(3, 'hubspot-crm:createNote', 600, { body: 'WhatsApp message from {{1.from}}: {{1.text.body}}' }),
    ],
  },
  {
    name: 'Calendly Booking → Email + Slack + Calendar Invite',
    category: 'Communication',
    description: 'When a Calendly meeting is booked, send a personalized confirmation email, notify the host in Slack, and create a Google Calendar event.',
    tags: ['Calendly', 'Gmail', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'calendly:watchEvents', 0),
      m(2, 'gmail:sendEmail', 300, { to: '{{1.email}}', subject: 'Meeting Confirmed: {{1.event_type_name}}', content: 'Hi {{1.name}}, your {{1.event_type_name}} is confirmed for {{1.start_time}}.' }),
      m(3, 'slack:createMessage', 600, { channel: '#meetings', text: '📅 New meeting booked: {{1.name}} — {{1.event_type_name}} at {{1.start_time}}' }),
      m(4, 'google-calendar:createEvent', 900, { summary: '{{1.event_type_name}} with {{1.name}}', start: { dateTime: '{{1.start_time}}' }, end: { dateTime: '{{1.end_time}}' } }),
    ],
  },
  {
    name: 'Weekly Team Newsletter → Multi-channel Broadcast',
    category: 'Communication',
    description: 'Compile weekly company updates and broadcast the newsletter to Slack, email subscribers, and Microsoft Teams every Friday afternoon.',
    tags: ['Slack', 'Gmail', 'Microsoft Teams'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'google-sheets:getRows', 0, { spreadsheetId: '{{newsletterSheetId}}', filter: 'week={{currentWeek}}' }),
      m(2, 'builtin:SetVariables', 300),
      m(3, 'slack:createMessage', 600, { channel: '#general', text: '📰 This Week at {{companyName}}\n\n{{weeklyUpdate}}' }),
      m(4, 'gmail:sendEmail', 900, { to: '{{subscriberList}}', subject: 'Weekly Update — {{formatDate(now, "MMM D, YYYY")}}', content: '{{newsletterHtml}}' }),
      m(5, 'microsoft-teams:createMessage', 1200, { channelId: '{{generalChannelId}}', content: '📰 Weekly company update: {{weeklyUpdateSummary}}' }),
    ],
  },
  {
    name: 'Discord New Message → Slack Mirror',
    category: 'Communication',
    description: 'Mirror important Discord server messages to Slack channels, keeping your team informed across both platforms without switching apps.',
    tags: ['Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'discord:watchMessages', 0),
      m(2, 'builtin:BasicFilter', 300, { condition: '{{1.content}} contains "@important"' }),
      m(3, 'slack:createMessage', 600, { channel: '#discord-mirror', text: '💬 Discord [#{{1.channel_name}}] {{1.author.username}}: {{1.content}}' }),
    ],
  },

  // ── Development ───────────────────────────────────────────────────────────
  {
    name: 'GitHub PR Opened → Slack Review Request + JIRA',
    category: 'Development',
    description: 'When a GitHub pull request is opened, post a review request to the dev team Slack channel and create a linked JIRA task for tracking.',
    tags: ['GitHub', 'Slack', 'Jira'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'github:watchPullRequests', 0, { action: 'opened' }),
      m(2, 'slack:createMessage', 300, { channel: '#code-review', text: '🔍 PR Review Needed: "{{1.pull_request.title}}" by {{1.pull_request.user.login}}\n{{1.pull_request.html_url}}' }),
      m(3, 'jira:createIssue', 600, { fields: { summary: 'Review PR: {{1.pull_request.title}}', issuetype: { name: 'Task' }, description: '{{1.pull_request.html_url}}' } }),
    ],
  },
  {
    name: 'New GitHub Issue → Trello Card + Slack Alert',
    category: 'Development',
    description: 'Convert new GitHub issues into Trello backlog cards automatically and notify the development team in Slack for prioritization.',
    tags: ['GitHub', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'github:watchIssues', 0, { action: 'opened' }),
      m(2, 'trello:createCard', 300, { idList: '{{backlogListId}}', name: '[{{1.repository.name}}] {{1.issue.title}}', desc: '{{1.issue.body}}\n\nGitHub: {{1.issue.html_url}}' }),
      m(3, 'slack:createMessage', 600, { channel: '#dev-issues', text: '🐛 New issue in {{1.repository.name}}: "{{1.issue.title}}" — {{1.issue.html_url}}' }),
    ],
  },
  {
    name: 'Sentry Error Alert → JIRA Issue + Slack Incident',
    category: 'Development',
    description: 'When Sentry detects a critical error, automatically create a JIRA bug ticket and post an incident alert to Slack with error details.',
    tags: ['Jira', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'sentry:watchIssues', 0, { level: 'error' }),
      m(2, 'jira:createIssue', 300, { fields: { summary: '[ERROR] {{1.culprit}}: {{1.title}}', issuetype: { name: 'Bug' }, priority: { name: 'High' }, description: '{{1.url}}\n\nFirst seen: {{1.firstSeen}}\nOccurrences: {{1.count}}' } }),
      m(3, 'slack:createMessage', 600, { channel: '#incidents', text: '🔴 Sentry Error: {{1.title}}\nCulprit: {{1.culprit}}\nOccurrences: {{1.count}}\nJIRA: {{2.key}}\nDetails: {{1.url}}' }),
    ],
  },
  {
    name: 'GitHub PR Merged → Changelog + Team Notify',
    category: 'Development',
    description: 'Track merged pull requests in a Google Sheets changelog and notify the team in Slack so everyone stays informed about code changes.',
    tags: ['GitHub', 'Google Sheets', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'github:watchPullRequests', 0, { action: 'closed', merged: true }),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.pull_request.merged_at}}', '{{1.repository.name}}', '{{1.pull_request.title}}', '{{1.pull_request.user.login}}', '{{1.pull_request.html_url}}'] }),
      m(3, 'slack:createMessage', 600, { channel: '#deployments', text: '✅ PR Merged: "{{1.pull_request.title}}" by {{1.pull_request.user.login}} in {{1.repository.name}}' }),
    ],
  },
  {
    name: 'Failed GitHub Action → Slack Alert + Email',
    category: 'Development',
    description: 'When a GitHub Actions CI/CD workflow fails, immediately alert the committing developer via Slack and email to fix the broken build.',
    tags: ['GitHub', 'Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'github:watchWorkflowRuns', 0, { conclusion: 'failure' }),
      m(2, 'slack:createMessage', 300, { channel: '#ci-cd', text: '❌ Build Failed: {{1.workflow.name}} on {{1.repository.name}}\nBranch: {{1.head_branch}}\nCommit: {{1.head_sha.slice(0,7)}} by {{1.triggering_actor.login}}\n{{1.html_url}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.triggering_actor.login}}@company.com', subject: '❌ Build Failed: {{1.workflow.name}}', content: 'Your commit {{1.head_sha}} caused a build failure in {{1.repository.name}}. Please investigate: {{1.html_url}}' }),
    ],
  },
  {
    name: 'New GitHub Release → Slack Announcement + Docs',
    category: 'Development',
    description: 'When a GitHub release is published, post a release announcement to Slack and create a release notes page in Notion for documentation.',
    tags: ['GitHub', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'github:watchReleases', 0, { action: 'published' }),
      m(2, 'slack:createMessage', 300, { channel: '#releases', text: '🚀 New Release: {{1.release.name}} ({{1.release.tag_name}})\n\n{{1.release.body.slice(0,500)}}\n\n{{1.release.html_url}}' }),
      m(3, 'notion:createDatabaseItem', 600, { parent: { database_id: '{{releaseDatabaseId}}' }, properties: { Name: { title: [{ text: { content: '{{1.release.name}}' } }] }, Version: { rich_text: [{ text: { content: '{{1.release.tag_name}}' } }] } } }),
    ],
  },
  {
    name: 'Linear Issue Created → Slack + GitHub Issue',
    category: 'Development',
    description: 'Sync Linear issues to GitHub by automatically creating corresponding GitHub issues and notifying the development team in Slack.',
    tags: ['GitHub', 'Slack'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'github:createIssue', 300, { owner: '{{repoOwner}}', repo: '{{repoName}}', title: '[Linear] {{1.title}}', body: '{{1.description}}\n\nLinear URL: {{1.url}}', labels: ['linear-sync'] }),
      m(3, 'slack:createMessage', 600, { channel: '#dev-sync', text: '🔄 Linear → GitHub sync: "{{1.title}}" created as GitHub issue #{{2.number}}' }),
    ],
  },
  {
    name: 'AWS CloudWatch Alarm → PagerDuty + Slack',
    category: 'Development',
    description: 'When an AWS CloudWatch alarm triggers, create a PagerDuty incident for on-call engineers and post a detailed alert to the infrastructure Slack channel.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'slack:createMessage', 300, { channel: '#infrastructure', text: '🚨 CloudWatch Alarm: {{1.AlarmName}}\nState: {{1.NewStateValue}}\nReason: {{1.NewStateReason}}\nRegion: {{1.Region}}' }),
      m(3, 'gmail:sendEmail', 600, { to: 'oncall@company.com', subject: '[CRITICAL] CloudWatch: {{1.AlarmName}}', content: 'CloudWatch alarm triggered:\n\nAlarm: {{1.AlarmName}}\nState: {{1.NewStateValue}}\nReason: {{1.NewStateReason}}\nTime: {{1.StateChangeTime}}' }),
    ],
  },
  {
    name: 'Notion Task → GitHub Issue + Slack',
    category: 'Development',
    description: 'When a Notion database task is created with "Development" label, automatically create a GitHub issue and notify the dev team in Slack.',
    tags: ['GitHub', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'notion:watchDatabaseItems', 0),
      m(2, 'builtin:BasicFilter', 300, { condition: '{{1.properties.Label.select.name}} = "Development"' }),
      m(3, 'github:createIssue', 600, { owner: '{{repoOwner}}', repo: '{{repoName}}', title: '{{1.properties.Name.title.0.text.content}}', body: '{{1.properties.Description.rich_text.0.text.content}}\n\nNotion: {{1.url}}' }),
      m(4, 'slack:createMessage', 900, { channel: '#dev-team', text: '📋 New dev task from Notion: "{{1.properties.Name.title.0.text.content}}" → GitHub #{{3.number}}' }),
    ],
  },
  {
    name: 'Uptime Monitor Alert → Slack + PagerDuty + Email',
    category: 'Development',
    description: 'When an uptime monitor detects a service outage, trigger a coordinated incident response: Slack alert, PagerDuty page, and executive email notification.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'builtin:BasicFilter', 300, { condition: '{{1.status}} = "down"' }),
      m(3, 'slack:createMessage', 600, { channel: '#incidents', text: '🔴 OUTAGE DETECTED: {{1.service_name}} is DOWN\nURL: {{1.url}}\nDowntime started: {{1.started_at}}\nAll hands on deck!' }),
      m(4, 'gmail:sendEmail', 900, { to: 'cto@company.com,oncall@company.com', subject: '[OUTAGE] {{1.service_name}} is Down', content: 'Service outage detected:\n\nService: {{1.service_name}}\nURL: {{1.url}}\nStarted: {{1.started_at}}\nError: {{1.error_message}}' }),
    ],
  },

  // ── General Automation ─────────────────────────────────────────────────────
  {
    name: 'Daily Schedule → Report + Slack Digest',
    category: 'General Automation',
    description: 'Run a daily scheduled automation to compile reports from Google Sheets and deliver a concise digest to Slack and email subscribers.',
    tags: ['Google Sheets', 'Slack', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'builtin:BasicScheduler', 0),
      m(2, 'google-sheets:getRows', 300, { spreadsheetId: '{{reportSheetId}}' }),
      m(3, 'builtin:SetVariables', 600),
      m(4, 'slack:createMessage', 900, { channel: '#reports', text: '📊 Daily Report — {{formatDate(now, "MMM D, YYYY")}}\n\n{{reportSummary}}' }),
      m(5, 'gmail:sendEmail', 1200, { to: '{{emailList}}', subject: 'Daily Report — {{formatDate(now, "MMM D, YYYY")}}', content: '{{reportHtml}}' }),
    ],
  },
  {
    name: 'Google Form Submission → Sheets + Email Notify',
    category: 'General Automation',
    description: 'Process Google Form submissions by storing responses in Google Sheets and sending an automated acknowledgment email to the submitter.',
    tags: ['Google Sheets', 'Gmail'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'google-sheets:addRow', 300, { spreadsheetId: '{{formResponsesSheet}}', values: ['{{1.name}}', '{{1.email}}', '{{1.message}}', '{{now}}'] }),
      m(3, 'gmail:sendEmail', 600, { to: '{{1.email}}', subject: 'Thank you for your submission!', content: 'Hi {{1.name}}, we received your submission and will be in touch soon.' }),
    ],
  },
  {
    name: 'Webhook Received → Parse + Multi-step Processing',
    category: 'General Automation',
    description: 'A flexible webhook automation that parses incoming data, applies conditional routing, and distributes to multiple destinations based on the payload.',
    tags: ['Slack', 'Google Sheets'],
    trigger_type: 'Webhook',
    flow: [
      m(1, 'webhook:CustomWebHook', 0),
      m(2, 'builtin:TextParser', 300),
      m(3, 'builtin:BasicRouter', 600),
      m(4, 'google-sheets:addRow', 900, { values: ['{{1.event}}', '{{2.value}}', '{{now}}'] }),
      m(5, 'slack:createMessage', 1200, { channel: '#webhooks', text: 'Processed webhook: {{1.event}} — {{2.value}}' }),
    ],
  },
  {
    name: 'RSS Feed → Airtable Database + Slack Alert',
    category: 'General Automation',
    description: 'Monitor RSS feeds for new content and store each item in Airtable for content curation while alerting your team in Slack about new posts.',
    tags: ['Slack'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'rss:triggerRssFeed', 0, { url: '{{rssFeedUrl}}' }),
      m(2, 'airtable:createRecord', 300, { baseId: '{{airtableBaseId}}', tableId: '{{tableId}}', fields: { Title: '{{1.title}}', URL: '{{1.link}}', Published: '{{1.pubDate}}', Summary: '{{1.description}}' } }),
      m(3, 'slack:createMessage', 600, { channel: '#content-feed', text: '📰 New article: {{1.title}}\n{{1.link}}' }),
    ],
  },
  {
    name: 'Google Calendar Event → Task + Reminder Email',
    category: 'General Automation',
    description: 'Sync Google Calendar events to your task manager and send automatic email reminders 1 hour before each event to all attendees.',
    tags: ['Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'google-calendar:watchEvents', 0),
      m(2, 'trello:createCard', 300, { idList: '{{upcomingListId}}', name: '{{1.summary}}', due: '{{1.start.dateTime}}', desc: '{{1.description}}\n\nLocation: {{1.location}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{attendeeEmails}}', subject: 'Reminder: {{1.summary}} in 1 Hour', content: 'This is a reminder for "{{1.summary}}" starting at {{1.start.dateTime}}.\n\nLocation: {{1.location}}' }),
    ],
  },
  {
    name: 'New Airtable Record → Google Sheets + Slack',
    category: 'General Automation',
    description: 'Mirror new Airtable records to Google Sheets for analysis and notify a Slack channel so your team can take immediate action on new entries.',
    tags: ['Google Sheets', 'Slack'],
    trigger_type: 'Event',
    flow: [
      m(1, 'airtable:watchRecords', 0),
      m(2, 'google-sheets:addRow', 300, { values: ['{{1.fields.Name}}', '{{1.fields.Email}}', '{{1.fields.Status}}', '{{1.fields.Notes}}', '{{1.createdTime}}'] }),
      m(3, 'slack:createMessage', 600, { channel: '#updates', text: '📋 New Airtable record: {{1.fields.Name}} — {{1.fields.Status}}' }),
    ],
  },
  {
    name: 'Google Drive File Upload → Process + Notify Team',
    category: 'General Automation',
    description: 'Detect new files uploaded to a Google Drive folder and automatically notify relevant team members in Slack with a direct link to the file.',
    tags: ['Google Drive', 'Slack', 'Gmail'],
    trigger_type: 'Event',
    flow: [
      m(1, 'google-drive:watchFiles', 0, { folderId: '{{watchFolderId}}' }),
      m(2, 'slack:createMessage', 300, { channel: '#shared-files', text: '📁 New file uploaded to Drive: {{1.name}}\nUploaded by: {{1.owners.0.displayName}}\nLink: {{1.webViewLink}}' }),
      m(3, 'gmail:sendEmail', 600, { to: '{{teamEmail}}', subject: 'New File in Shared Drive: {{1.name}}', content: 'A new file has been added to the shared folder.\n\nFile: {{1.name}}\nLink: {{1.webViewLink}}' }),
    ],
  },
  {
    name: 'Dropbox New File → Convert Format + Email',
    category: 'General Automation',
    description: 'When a new file is dropped in a Dropbox folder, automatically process it and email the converted or processed result to designated recipients.',
    tags: ['Dropbox', 'Gmail'],
    trigger_type: 'Event',
    flow: [
      m(1, 'dropbox:watchFiles', 0, { path: '/inbox' }),
      m(2, 'builtin:SetVariables', 300),
      m(3, 'gmail:sendEmail', 600, { to: '{{processingEmail}}', subject: 'New Dropbox File: {{1.name}}', content: 'A new file has been added to Dropbox:\n\nFile: {{1.name}}\nSize: {{1.size}} bytes\nPath: {{1.path_display}}' }),
    ],
  },
  {
    name: 'Morning Standup Reminder → Slack + Email',
    category: 'General Automation',
    description: 'Send automated daily standup reminders to your team in Slack and email every weekday morning with a prompt form to collect updates.',
    tags: ['Slack', 'Gmail'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'builtin:BasicScheduler', 0, { schedule: '0 9 * * 1-5' }),
      m(2, 'slack:createMessage', 300, { channel: '#standup', text: '☀️ Good morning! Time for the daily standup.\n\nPlease share:\n1. What did you do yesterday?\n2. What are you doing today?\n3. Any blockers?\n\nSubmit: {{standupFormLink}}' }),
    ],
  },
  {
    name: 'Data Backup → Google Sheets → Google Drive',
    category: 'General Automation',
    description: 'Run weekly automated backups of important Google Sheets data to Google Drive, ensuring data safety with versioned backup files.',
    tags: ['Google Sheets', 'Google Drive'],
    trigger_type: 'Schedule',
    flow: [
      m(1, 'builtin:BasicScheduler', 0, { schedule: '0 2 * * 0' }),
      m(2, 'google-sheets:getRows', 300, { spreadsheetId: '{{dataSheetId}}' }),
      m(3, 'google-drive:uploadFile', 600, { name: 'backup_{{formatDate(now, "YYYY-MM-DD")}}.json', parents: ['{{backupFolderId}}'], content: '{{json(2.rows)}}' }),
      m(4, 'slack:createMessage', 900, { channel: '#ops', text: '💾 Weekly backup completed: {{3.name}} ({{2.rows.length}} records) saved to Google Drive' }),
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ManageAI — Make.com Template Seeder');
  console.log(`  Templates to seed: ${TEMPLATES.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Clear existing Make.com seed records
  const { error: delErr, count: delCount } = await supabase
    .from('templates')
    .delete({ count: 'exact' })
    .eq('source', SOURCE);
  if (delErr) {
    console.warn(`Warning — could not clear existing records: ${delErr.message}`);
  } else {
    console.log(`Cleared ${delCount ?? 0} existing Make.com seed records`);
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
      metadata: { instant: t.trigger_type === 'Webhook', version: 1, scenario: { roundtrips: 1, maxErrors: 3, autoCommit: true } },
    },
    source: SOURCE,
    source_repo: 'seed:manageai/make-templates',
    source_filename: `make/${t.category}/${t.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`,
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
    .eq('platform', 'make');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Make.com templates inserted: ${inserted}/${rows.length}`);
  console.log(`  Batch errors: ${errors}`);
  console.log(`  Total Make.com in DB: ${total ?? 0}`);
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
