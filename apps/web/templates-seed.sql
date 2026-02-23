-- ============================================================
-- ManageAI — Templates Table + Seed Data
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('n8n','make','zapier')),
  category TEXT,
  description TEXT,
  node_count INTEGER,
  tags TEXT[],
  workflow_json JSONB,
  source_repo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates readable by authenticated users"
  ON templates FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- SEED: n8n templates (20)
-- ============================================================
INSERT INTO templates (name, platform, category, description, node_count, tags, source_repo) VALUES
('Lead Capture → CRM Sync', 'n8n', 'Lead Gen',
 'Capture leads from any web form, enrich with Clearbit, and push to HubSpot or Salesforce with automatic deal creation.',
 8, ARRAY['hubspot','clearbit','forms'],
 'github.com/Danitilahun/n8n-workflow-templates'),

('AI Email Campaign Automator', 'n8n', 'Marketing',
 'Generate personalized email sequences with Claude AI, schedule sends via SendGrid, and track opens in Airtable.',
 11, ARRAY['sendgrid','claude','airtable'],
 'github.com/wassupjay/n8n-free-templates'),

('Invoice Processing & Approval', 'n8n', 'Finance',
 'Parse PDF invoices with AI, route for approval via Slack, sync to QuickBooks, and archive to Google Drive.',
 14, ARRAY['pdf','quickbooks','slack'],
 'github.com/Zie619/n8n-workflows'),

('Slack Notification Hub', 'n8n', 'Communication',
 'Aggregate alerts from PagerDuty, GitHub, Stripe, and Jira into a unified Slack digest with smart deduplication.',
 9, ARRAY['slack','github','pagerduty'],
 'github.com/zengfr/n8n-workflow-all-templates'),

('Support Ticket Router', 'n8n', 'Customer Support',
 'Classify inbound support emails using AI sentiment analysis, assign priority, and route to the correct Zendesk team queue.',
 10, ARRAY['zendesk','ai','email'],
 'github.com/Danitilahun/n8n-workflow-templates'),

('Employee Onboarding Workflow', 'n8n', 'HR',
 'Trigger from BambooHR new hire event, provision Okta account, create Notion onboarding page, and send welcome Slack message.',
 13, ARRAY['bamboohr','okta','notion'],
 'github.com/Zie619/n8n-workflows'),

('Social Media Cross-Poster', 'n8n', 'Marketing',
 'Publish content from a Google Sheets calendar to Twitter/X, LinkedIn, and Instagram simultaneously with platform formatting.',
 7, ARRAY['twitter','linkedin','instagram'],
 'github.com/wassupjay/n8n-free-templates'),

('AI Content Writer Pipeline', 'n8n', 'AI/ML',
 'Generate SEO blog posts with Claude, add images via Unsplash API, publish to WordPress, and post summary to Slack.',
 12, ARRAY['claude','wordpress','unsplash'],
 'github.com/zengfr/n8n-workflow-all-templates'),

('Data Backup & S3 Sync', 'n8n', 'Data',
 'Schedule nightly database exports, compress them, upload to AWS S3, and send a Slack confirmation with file stats.',
 6, ARRAY['aws','s3','backup'],
 'github.com/Danitilahun/n8n-workflow-templates'),

('Webhook Relay & Transform', 'n8n', 'Operations',
 'Receive webhooks from any source, validate signatures, transform payload with JSONata, and fan-out to multiple downstream services.',
 5, ARRAY['webhook','jsonata','api'],
 'github.com/Zie619/n8n-workflows'),

('PDF Report Generator', 'n8n', 'Reporting',
 'Pull data from Google Sheets or Postgres, render a styled PDF report using Puppeteer, and email it to stakeholders.',
 9, ARRAY['pdf','puppeteer','sheets'],
 'github.com/wassupjay/n8n-free-templates'),

('Meeting Notes Summarizer', 'n8n', 'AI/ML',
 'Receive Otter.ai or Zoom transcript, summarize key decisions and action items with Claude, and post to Notion and Slack.',
 7, ARRAY['zoom','claude','notion'],
 'github.com/zengfr/n8n-workflow-all-templates'),

('E-commerce Order Processor', 'n8n', 'Operations',
 'Process Shopify orders: validate inventory, trigger fulfillment, send branded confirmation email, and update customer in CRM.',
 15, ARRAY['shopify','email','crm'],
 'github.com/Danitilahun/n8n-workflow-templates'),

('Contract Generation Pipeline', 'n8n', 'Operations',
 'Generate NDAs and SOWs from a deal template when a HubSpot deal closes, send via DocuSign, and archive the signed copy.',
 11, ARRAY['hubspot','docusign','templates'],
 'github.com/Zie619/n8n-workflows'),

('Appointment Scheduler Sync', 'n8n', 'Operations',
 'Sync Calendly bookings to Google Calendar, create Zoom meeting, notify team on Slack, and add contact to CRM.',
 8, ARRAY['calendly','zoom','google'],
 'github.com/wassupjay/n8n-free-templates'),

('Customer Feedback Analyzer', 'n8n', 'AI/ML',
 'Collect NPS survey responses, run sentiment analysis with AI, tag by topic, store in Airtable, and alert on low scores.',
 10, ARRAY['nps','ai','airtable'],
 'github.com/zengfr/n8n-workflow-all-templates'),

('WhatsApp Business Bot', 'n8n', 'Communication',
 'Handle WhatsApp inbound messages, route FAQs to AI responder, escalate complex queries to live agent via Slack.',
 12, ARRAY['whatsapp','ai','slack'],
 'github.com/Danitilahun/n8n-workflow-templates'),

('Data Enrichment Pipeline', 'n8n', 'Data',
 'Enrich new CRM contacts with company data from Apollo, LinkedIn, and BuiltWith; score them and update deal probability.',
 14, ARRAY['apollo','linkedin','crm'],
 'github.com/Zie619/n8n-workflows'),

('CRM Deal Updater', 'n8n', 'CRM',
 'Watch for email replies, calls, and demo bookings; auto-update CRM deal stage, log activity, and notify the account owner.',
 9, ARRAY['crm','email','calendar'],
 'github.com/wassupjay/n8n-free-templates'),

('Monthly KPI Report Automation', 'n8n', 'Reporting',
 'Pull metrics from GA4, Stripe, HubSpot, and Jira on the 1st of each month; assemble a Notion report and email to executives.',
 17, ARRAY['ga4','stripe','hubspot'],
 'github.com/zengfr/n8n-workflow-all-templates'),

-- ============================================================
-- SEED: Make.com templates (20)
-- ============================================================
('Lead Scoring & Router', 'make', 'Lead Gen',
 'Score inbound leads from web forms using firmographic data, route hot leads to sales Slack channel, cold leads to nurture sequence.',
 9, ARRAY['forms','slack','hubspot'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('HubSpot → Slack Deal Alerts', 'make', 'CRM',
 'Send rich Slack notifications when HubSpot deals advance stages, including deal value, contact info, and next steps.',
 4, ARRAY['hubspot','slack'],
 'make.com/en/templates'),

('Gmail → Notion Task Creator', 'make', 'Operations',
 'Parse action items from starred Gmail messages using AI, create structured tasks in Notion with due dates and owners.',
 6, ARRAY['gmail','notion','ai'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('Stripe Payment Notifier', 'make', 'Finance',
 'Post Slack alerts for new Stripe payments, failed charges, and refunds with customer details and payment history link.',
 5, ARRAY['stripe','slack'],
 'make.com/en/templates'),

('Google Sheets → Email Campaign', 'make', 'Marketing',
 'Read campaign list from Google Sheets, personalize emails with Mailchimp merge tags, schedule and track delivery.',
 7, ARRAY['sheets','mailchimp','email'],
 'make.com/en/templates'),

('Airtable HR Onboarding', 'make', 'HR',
 'Trigger new hire flow from Airtable, provision tools, send Day 1 checklist, and schedule 30/60/90 day check-ins.',
 10, ARRAY['airtable','hr','calendar'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('Instagram Content Scheduler', 'make', 'Marketing',
 'Pull approved posts from Airtable content calendar, auto-post to Instagram Business at scheduled times with caption and hashtags.',
 6, ARRAY['instagram','airtable','social'],
 'make.com/en/templates'),

('AI Blog Post Generator', 'make', 'AI/ML',
 'Generate full blog articles from keyword brief using GPT-4, optimize for SEO, publish to WordPress, and share on social media.',
 8, ARRAY['openai','wordpress','seo'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('Dropbox Automated Backup', 'make', 'Data',
 'Schedule daily backups of critical Airtable, Notion, and Google Drive data to Dropbox Business with version management.',
 9, ARRAY['dropbox','airtable','backup'],
 'make.com/en/templates'),

('Zendesk Ticket Escalator', 'make', 'Customer Support',
 'Monitor Zendesk for SLA breaches, escalate to manager via email and Slack, and create follow-up tasks in Asana.',
 7, ARRAY['zendesk','slack','asana'],
 'make.com/en/templates'),

('PDF Invoice Generator', 'make', 'Finance',
 'Create professional PDF invoices from Airtable records, deliver via email, sync payment status to CRM.',
 8, ARRAY['pdf','airtable','email'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('Zoom Meeting Summarizer', 'make', 'AI/ML',
 'Receive Zoom cloud recording, transcribe with Whisper, summarize with GPT-4, and distribute notes to attendees via email.',
 9, ARRAY['zoom','openai','email'],
 'make.com/en/templates'),

('Shopify Order Fulfillment', 'make', 'Operations',
 'Process new Shopify orders: check stock in inventory system, notify fulfillment warehouse, update tracking, email customer.',
 11, ARRAY['shopify','inventory','email'],
 'make.com/en/templates'),

('DocuSign Contract Flow', 'make', 'Operations',
 'Auto-generate contracts from CRM deal data, send via DocuSign, monitor for signature, update deal and notify team on completion.',
 10, ARRAY['docusign','crm','contracts'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('Calendly → CRM Auto-Sync', 'make', 'Lead Gen',
 'Capture Calendly bookings, create or update CRM contact, assign to correct sales rep, send branded meeting confirmation.',
 7, ARRAY['calendly','crm','email'],
 'make.com/en/templates'),

('NPS Survey Processor', 'make', 'Customer Support',
 'Process Typeform NPS responses, segment by score, trigger detractor recovery workflow, log everything to Airtable.',
 8, ARRAY['typeform','airtable','nps'],
 'make.com/en/templates'),

('WhatsApp Support Bot', 'make', 'Communication',
 'Answer common customer questions via WhatsApp Business API using a knowledge base, escalate unresolved queries to human agent.',
 11, ARRAY['whatsapp','ai','support'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

('Apollo Data Enrichment', 'make', 'Data',
 'Enrich new CRM contacts using Apollo.io API: firmographics, technographics, and contact data — all synced back automatically.',
 6, ARRAY['apollo','crm','enrichment'],
 'make.com/en/templates'),

('Pipedrive Pipeline Updater', 'make', 'CRM',
 'Auto-advance Pipedrive deals based on email activity, meeting completions, and proposal views. Notify reps of stale deals.',
 9, ARRAY['pipedrive','email','crm'],
 'make.com/en/templates'),

('Weekly KPI Dashboard Builder', 'make', 'Reporting',
 'Aggregate weekly metrics from HubSpot, Google Analytics, and Stripe; build a Notion dashboard and email executive summary.',
 14, ARRAY['hubspot','ga4','notion'],
 'github.com/nateshelly/make-ai-automation-agents-blueprints'),

-- ============================================================
-- SEED: Zapier templates (22)
-- ============================================================
('New Lead → CRM + Slack Alert', 'zapier', 'Lead Gen',
 'Capture leads from Facebook Lead Ads or website forms, add to Salesforce, and post rich lead card to sales Slack channel.',
 4, ARRAY['salesforce','slack','facebook'], NULL),

('Gmail → Trello Task Creator', 'zapier', 'Operations',
 'Convert starred or labeled Gmail messages into Trello cards with smart field parsing, due dates, and assignee detection.',
 3, ARRAY['gmail','trello'], NULL),

('Stripe → QuickBooks Sync', 'zapier', 'Finance',
 'Sync Stripe payments, refunds, and subscriptions to QuickBooks Online in real-time with automatic invoice and customer matching.',
 4, ARRAY['stripe','quickbooks'], NULL),

('Mailchimp Campaign Trigger', 'zapier', 'Marketing',
 'Auto-add new CRM contacts to targeted Mailchimp audiences based on deal stage, industry, and custom properties.',
 3, ARRAY['mailchimp','crm'], NULL),

('BambooHR New Hire Provisioner', 'zapier', 'HR',
 'Trigger from BambooHR new hire event, create Google Workspace account, add to Slack workspace, and assign onboarding checklist.',
 5, ARRAY['bamboohr','google','slack'], NULL),

('Buffer Social Scheduler', 'zapier', 'Marketing',
 'Auto-schedule approved content from Airtable or Google Sheets to Buffer queue for Twitter, LinkedIn, and Facebook.',
 3, ARRAY['buffer','airtable','social'], NULL),

('OpenAI Content Pipeline', 'zapier', 'AI/ML',
 'Generate product descriptions, email copy, or ad creatives from a brief using OpenAI GPT-4, store results in Airtable.',
 4, ARRAY['openai','airtable','content'], NULL),

('Google Drive Backup Flow', 'zapier', 'Data',
 'Backup files from specified Google Drive folders to Dropbox daily, with a Slack confirmation message and file count summary.',
 4, ARRAY['drive','dropbox','backup'], NULL),

('Intercom → Zendesk Router', 'zapier', 'Customer Support',
 'Route Intercom conversations tagged as bugs or billing issues to Zendesk tickets with full conversation context transferred.',
 3, ARRAY['intercom','zendesk'], NULL),

('PandaDoc Contract Creator', 'zapier', 'Operations',
 'Create and send PandaDoc contracts when HubSpot deals reach Proposal stage; notify rep when document is viewed and signed.',
 4, ARRAY['pandadoc','hubspot'], NULL),

('Acuity → Salesforce Sync', 'zapier', 'Lead Gen',
 'Sync Acuity Scheduling appointments to Salesforce as tasks and update contact records with meeting history and notes.',
 4, ARRAY['acuity','salesforce'], NULL),

('Typeform → Airtable Collector', 'zapier', 'Data',
 'Route Typeform survey responses to Airtable with field mapping, attachment handling, and conditional routing by response.',
 3, ARRAY['typeform','airtable'], NULL),

('WooCommerce Order Processor', 'zapier', 'Operations',
 'Process WooCommerce orders: add buyer to Mailchimp list, create Trello card for fulfillment, and send Slack notification.',
 4, ARRAY['woocommerce','mailchimp','trello'], NULL),

('Slack → Jira Bug Reporter', 'zapier', 'Operations',
 'Convert Slack messages with a bug emoji reaction into Jira tickets with priority, component, and reporter automatically set.',
 3, ARRAY['slack','jira'], NULL),

('Typeform → HubSpot Contact', 'zapier', 'Lead Gen',
 'Create or update HubSpot contacts from Typeform submissions with custom property mapping and lead source tracking.',
 3, ARRAY['typeform','hubspot'], NULL),

('Notion → Linear Task Sync', 'zapier', 'Operations',
 'Sync Notion database items tagged as engineering tasks to Linear issues with priority, cycle, and assignee mapping.',
 3, ARRAY['notion','linear'], NULL),

('Twilio SMS Alert System', 'zapier', 'Communication',
 'Send SMS alerts via Twilio for critical events: new high-value deals, server alerts, or form submissions from VIP contacts.',
 3, ARRAY['twilio','sms'], NULL),

('Clearbit Enrichment Flow', 'zapier', 'Data',
 'Enrich new HubSpot or Salesforce contacts with Clearbit data: company size, industry, tech stack, and social profiles.',
 3, ARRAY['clearbit','hubspot','crm'], NULL),

('Salesforce Opportunity Alerts', 'zapier', 'CRM',
 'Alert sales managers on Slack when high-value Salesforce opportunities stall, close, or change probability significantly.',
 4, ARRAY['salesforce','slack'], NULL),

('GA4 → Slack Weekly Report', 'zapier', 'Reporting',
 'Post a formatted weekly traffic and conversion summary from Google Analytics 4 to a Slack channel every Monday morning.',
 3, ARRAY['ga4','slack','reporting'], NULL),

('Expense Report Automation', 'zapier', 'Finance',
 'Collect expense receipts from Gmail, extract data with OCR, create expense report in Expensify, and notify approver.',
 5, ARRAY['gmail','ocr','expensify'], NULL),

('Churn Prevention Alert', 'zapier', 'Customer Support',
 'Detect at-risk customers from usage data drops in product analytics, trigger CSM outreach and create CRM task.',
 4, ARRAY['analytics','crm','retention'], NULL);
