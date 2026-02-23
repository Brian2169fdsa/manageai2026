'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Zap, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  platform: 'n8n' | 'make' | 'zapier';
  category: string;
  description: string;
  node_count: number;
  tags: string[];
}

const PLATFORM_STYLES = {
  n8n: { label: 'n8n', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  make: { label: 'Make.com', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  zapier: { label: 'Zapier', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
};

const CATEGORIES = [
  'All', 'Lead Gen', 'CRM', 'Marketing', 'Finance', 'Operations',
  'HR', 'Customer Support', 'Data', 'AI/ML', 'Communication', 'Reporting',
];

// Fallback static templates — used when the DB table doesn't exist yet
const STATIC_TEMPLATES: Template[] = [
  // ── n8n ─────────────────────────────────────────────────────────────────
  { id: 's1',  name: 'Lead Capture → CRM Sync',           platform: 'n8n',    category: 'Lead Gen',         description: 'Capture leads from any web form, enrich with Clearbit, and push to HubSpot or Salesforce with automatic deal creation.',              node_count: 8,  tags: ['hubspot','clearbit','forms'] },
  { id: 's2',  name: 'AI Email Campaign Automator',        platform: 'n8n',    category: 'Marketing',        description: 'Generate personalized email sequences with Claude AI, schedule sends via SendGrid, and track opens in Airtable.',                   node_count: 11, tags: ['sendgrid','claude','airtable'] },
  { id: 's3',  name: 'Invoice Processing & Approval',      platform: 'n8n',    category: 'Finance',          description: 'Parse PDF invoices with AI, route for approval via Slack, sync to QuickBooks, and archive to Google Drive.',                       node_count: 14, tags: ['pdf','quickbooks','slack'] },
  { id: 's4',  name: 'Slack Notification Hub',             platform: 'n8n',    category: 'Communication',    description: 'Aggregate alerts from PagerDuty, GitHub, Stripe, and Jira into a unified Slack digest with smart deduplication.',                   node_count: 9,  tags: ['slack','github','pagerduty'] },
  { id: 's5',  name: 'Support Ticket Router',              platform: 'n8n',    category: 'Customer Support', description: 'Classify inbound support emails using AI sentiment analysis, assign priority, and route to the correct Zendesk team queue.',         node_count: 10, tags: ['zendesk','ai','email'] },
  { id: 's6',  name: 'Employee Onboarding Workflow',       platform: 'n8n',    category: 'HR',               description: 'Trigger from BambooHR new hire event, provision Okta account, create Notion onboarding page, and send welcome Slack message.',    node_count: 13, tags: ['bamboohr','okta','notion'] },
  { id: 's7',  name: 'Social Media Cross-Poster',          platform: 'n8n',    category: 'Marketing',        description: 'Publish content from a Google Sheets calendar to Twitter/X, LinkedIn, and Instagram simultaneously with platform formatting.',       node_count: 7,  tags: ['twitter','linkedin','instagram'] },
  { id: 's8',  name: 'AI Content Writer Pipeline',         platform: 'n8n',    category: 'AI/ML',            description: 'Generate SEO blog posts with Claude, add images via Unsplash API, publish to WordPress, and post summary to Slack.',              node_count: 12, tags: ['claude','wordpress','unsplash'] },
  { id: 's9',  name: 'Data Backup & S3 Sync',              platform: 'n8n',    category: 'Data',             description: 'Schedule nightly database exports, compress them, upload to AWS S3, and send a Slack confirmation with file stats.',               node_count: 6,  tags: ['aws','s3','backup'] },
  { id: 's10', name: 'Webhook Relay & Transform',          platform: 'n8n',    category: 'Operations',       description: 'Receive webhooks from any source, validate signatures, transform payload with JSONata, and fan-out to multiple downstream services.', node_count: 5,  tags: ['webhook','jsonata','api'] },
  { id: 's11', name: 'PDF Report Generator',               platform: 'n8n',    category: 'Reporting',        description: 'Pull data from Google Sheets or Postgres, render a styled PDF report using Puppeteer, and email it to stakeholders.',               node_count: 9,  tags: ['pdf','puppeteer','sheets'] },
  { id: 's12', name: 'Meeting Notes Summarizer',           platform: 'n8n',    category: 'AI/ML',            description: 'Receive Otter.ai or Zoom transcript, summarize key decisions and action items with Claude, and post to Notion and Slack.',        node_count: 7,  tags: ['zoom','claude','notion'] },
  { id: 's13', name: 'E-commerce Order Processor',         platform: 'n8n',    category: 'Operations',       description: 'Process Shopify orders: validate inventory, trigger fulfillment, send branded confirmation email, and update customer in CRM.',      node_count: 15, tags: ['shopify','email','crm'] },
  { id: 's14', name: 'Contract Generation Pipeline',       platform: 'n8n',    category: 'Operations',       description: 'Generate NDAs and SOWs from a deal template when a HubSpot deal closes, send via DocuSign, and archive the signed copy.',          node_count: 11, tags: ['hubspot','docusign','templates'] },
  { id: 's15', name: 'Appointment Scheduler Sync',         platform: 'n8n',    category: 'Operations',       description: 'Sync Calendly bookings to Google Calendar, create Zoom meeting, notify team on Slack, and add contact to CRM.',                    node_count: 8,  tags: ['calendly','zoom','google'] },
  { id: 's16', name: 'Customer Feedback Analyzer',         platform: 'n8n',    category: 'AI/ML',            description: 'Collect NPS survey responses, run sentiment analysis with AI, tag by topic, store in Airtable, and alert on low scores.',         node_count: 10, tags: ['nps','ai','airtable'] },
  { id: 's17', name: 'WhatsApp Business Bot',              platform: 'n8n',    category: 'Communication',    description: 'Handle WhatsApp inbound messages, route FAQs to AI responder, escalate complex queries to live agent via Slack.',                   node_count: 12, tags: ['whatsapp','ai','slack'] },
  { id: 's18', name: 'Data Enrichment Pipeline',           platform: 'n8n',    category: 'Data',             description: 'Enrich new CRM contacts with company data from Apollo, LinkedIn, and BuiltWith; score them and update deal probability.',          node_count: 14, tags: ['apollo','linkedin','crm'] },
  { id: 's19', name: 'CRM Deal Updater',                   platform: 'n8n',    category: 'CRM',              description: 'Watch for email replies, calls, and demo bookings; auto-update CRM deal stage, log activity, and notify the account owner.',      node_count: 9,  tags: ['crm','email','calendar'] },
  { id: 's20', name: 'Monthly KPI Report Automation',      platform: 'n8n',    category: 'Reporting',        description: 'Pull metrics from GA4, Stripe, HubSpot, and Jira on the 1st of each month; assemble a Notion report and email to executives.',    node_count: 17, tags: ['ga4','stripe','hubspot'] },
  // ── Make.com ─────────────────────────────────────────────────────────────
  { id: 's21', name: 'Lead Scoring & Router',              platform: 'make',   category: 'Lead Gen',         description: 'Score inbound leads from web forms using firmographic data, route hot leads to sales Slack channel, cold leads to nurture sequence.', node_count: 9,  tags: ['forms','slack','hubspot'] },
  { id: 's22', name: 'HubSpot → Slack Deal Alerts',        platform: 'make',   category: 'CRM',              description: 'Send rich Slack notifications when HubSpot deals advance stages, including deal value, contact info, and next steps.',            node_count: 4,  tags: ['hubspot','slack'] },
  { id: 's23', name: 'Gmail → Notion Task Creator',        platform: 'make',   category: 'Operations',       description: 'Parse action items from starred Gmail messages using AI, create structured tasks in Notion with due dates and owners.',            node_count: 6,  tags: ['gmail','notion','ai'] },
  { id: 's24', name: 'Stripe Payment Notifier',            platform: 'make',   category: 'Finance',          description: 'Post Slack alerts for new Stripe payments, failed charges, and refunds with customer details and payment history link.',           node_count: 5,  tags: ['stripe','slack'] },
  { id: 's25', name: 'Sheets → Email Campaign',            platform: 'make',   category: 'Marketing',        description: 'Read campaign list from Google Sheets, personalize emails with Mailchimp merge tags, schedule and track delivery.',               node_count: 7,  tags: ['sheets','mailchimp','email'] },
  { id: 's26', name: 'Airtable HR Onboarding',             platform: 'make',   category: 'HR',               description: 'Trigger new hire flow from Airtable, provision tools, send Day 1 checklist, and schedule 30/60/90 day check-ins.',              node_count: 10, tags: ['airtable','hr','calendar'] },
  { id: 's27', name: 'Instagram Content Scheduler',        platform: 'make',   category: 'Marketing',        description: 'Pull approved posts from Airtable content calendar, auto-post to Instagram Business at scheduled times with caption and hashtags.', node_count: 6,  tags: ['instagram','airtable','social'] },
  { id: 's28', name: 'AI Blog Post Generator',             platform: 'make',   category: 'AI/ML',            description: 'Generate full blog articles from keyword brief using GPT-4, optimize for SEO, publish to WordPress, and share on social media.',  node_count: 8,  tags: ['openai','wordpress','seo'] },
  { id: 's29', name: 'Dropbox Automated Backup',           platform: 'make',   category: 'Data',             description: 'Schedule daily backups of critical Airtable, Notion, and Google Drive data to Dropbox Business with version management.',          node_count: 9,  tags: ['dropbox','airtable','backup'] },
  { id: 's30', name: 'Zendesk Ticket Escalator',           platform: 'make',   category: 'Customer Support', description: 'Monitor Zendesk for SLA breaches, escalate to manager via email and Slack, and create follow-up tasks in Asana.',                 node_count: 7,  tags: ['zendesk','slack','asana'] },
  { id: 's31', name: 'PDF Invoice Generator',              platform: 'make',   category: 'Finance',          description: 'Create professional PDF invoices from Airtable records, deliver via email, sync payment status to CRM.',                          node_count: 8,  tags: ['pdf','airtable','email'] },
  { id: 's32', name: 'Zoom Meeting Summarizer',            platform: 'make',   category: 'AI/ML',            description: 'Receive Zoom cloud recording, transcribe with Whisper, summarize with GPT-4, and distribute notes to attendees via email.',      node_count: 9,  tags: ['zoom','openai','email'] },
  { id: 's33', name: 'Shopify Order Fulfillment',          platform: 'make',   category: 'Operations',       description: 'Process new Shopify orders: check stock in inventory system, notify fulfillment warehouse, update tracking, email customer.',      node_count: 11, tags: ['shopify','inventory','email'] },
  { id: 's34', name: 'DocuSign Contract Flow',             platform: 'make',   category: 'Operations',       description: 'Auto-generate contracts from CRM deal data, send via DocuSign, monitor for signature, update deal and notify team on completion.', node_count: 10, tags: ['docusign','crm','contracts'] },
  { id: 's35', name: 'Calendly → CRM Auto-Sync',          platform: 'make',   category: 'Lead Gen',         description: 'Capture Calendly bookings, create or update CRM contact, assign to correct sales rep, send branded meeting confirmation.',        node_count: 7,  tags: ['calendly','crm','email'] },
  { id: 's36', name: 'NPS Survey Processor',               platform: 'make',   category: 'Customer Support', description: 'Process Typeform NPS responses, segment by score, trigger detractor recovery workflow, log everything to Airtable.',             node_count: 8,  tags: ['typeform','airtable','nps'] },
  { id: 's37', name: 'WhatsApp Support Bot',               platform: 'make',   category: 'Communication',    description: 'Answer common customer questions via WhatsApp Business API using a knowledge base, escalate unresolved queries to human agent.',  node_count: 11, tags: ['whatsapp','ai','support'] },
  { id: 's38', name: 'Apollo Data Enrichment',             platform: 'make',   category: 'Data',             description: 'Enrich new CRM contacts using Apollo.io API: firmographics, technographics, and contact data — all synced back automatically.',    node_count: 6,  tags: ['apollo','crm','enrichment'] },
  { id: 's39', name: 'Pipedrive Pipeline Updater',         platform: 'make',   category: 'CRM',              description: 'Auto-advance Pipedrive deals based on email activity, meeting completions, and proposal views. Notify reps of stale deals.',      node_count: 9,  tags: ['pipedrive','email','crm'] },
  { id: 's40', name: 'Weekly KPI Dashboard Builder',       platform: 'make',   category: 'Reporting',        description: 'Aggregate weekly metrics from HubSpot, Google Analytics, and Stripe; build a Notion dashboard and email executive summary.',      node_count: 14, tags: ['hubspot','ga4','notion'] },
  // ── Zapier ───────────────────────────────────────────────────────────────
  { id: 's41', name: 'New Lead → CRM + Slack Alert',       platform: 'zapier', category: 'Lead Gen',         description: 'Capture leads from Facebook Lead Ads or website forms, add to Salesforce, and post rich lead card to sales Slack channel.',       node_count: 4,  tags: ['salesforce','slack','facebook'] },
  { id: 's42', name: 'Gmail → Trello Task Creator',        platform: 'zapier', category: 'Operations',       description: 'Convert starred or labeled Gmail messages into Trello cards with smart field parsing, due dates, and assignee detection.',        node_count: 3,  tags: ['gmail','trello'] },
  { id: 's43', name: 'Stripe → QuickBooks Sync',           platform: 'zapier', category: 'Finance',          description: 'Sync Stripe payments, refunds, and subscriptions to QuickBooks Online in real-time with automatic invoice and customer matching.', node_count: 4,  tags: ['stripe','quickbooks'] },
  { id: 's44', name: 'Mailchimp Campaign Trigger',         platform: 'zapier', category: 'Marketing',        description: 'Auto-add new CRM contacts to targeted Mailchimp audiences based on deal stage, industry, and custom properties.',               node_count: 3,  tags: ['mailchimp','crm'] },
  { id: 's45', name: 'BambooHR New Hire Provisioner',      platform: 'zapier', category: 'HR',               description: 'Trigger from BambooHR new hire event, create Google Workspace account, add to Slack workspace, and assign onboarding checklist.', node_count: 5,  tags: ['bamboohr','google','slack'] },
  { id: 's46', name: 'Buffer Social Scheduler',            platform: 'zapier', category: 'Marketing',        description: 'Auto-schedule approved content from Airtable or Google Sheets to Buffer queue for Twitter, LinkedIn, and Facebook.',            node_count: 3,  tags: ['buffer','airtable','social'] },
  { id: 's47', name: 'OpenAI Content Pipeline',            platform: 'zapier', category: 'AI/ML',            description: 'Generate product descriptions, email copy, or ad creatives from a brief using OpenAI GPT-4, store results in Airtable.',        node_count: 4,  tags: ['openai','airtable','content'] },
  { id: 's48', name: 'Google Drive Backup Flow',           platform: 'zapier', category: 'Data',             description: 'Backup files from specified Google Drive folders to Dropbox daily, with a Slack confirmation message and file count summary.',     node_count: 4,  tags: ['drive','dropbox','backup'] },
  { id: 's49', name: 'Intercom → Zendesk Router',          platform: 'zapier', category: 'Customer Support', description: 'Route Intercom conversations tagged as bugs or billing issues to Zendesk tickets with full conversation context transferred.',      node_count: 3,  tags: ['intercom','zendesk'] },
  { id: 's50', name: 'PandaDoc Contract Creator',          platform: 'zapier', category: 'Operations',       description: 'Create and send PandaDoc contracts when HubSpot deals reach Proposal stage; notify rep when document is viewed and signed.',      node_count: 4,  tags: ['pandadoc','hubspot'] },
  { id: 's51', name: 'Acuity → Salesforce Sync',           platform: 'zapier', category: 'Lead Gen',         description: 'Sync Acuity Scheduling appointments to Salesforce as tasks and update contact records with meeting history and notes.',           node_count: 4,  tags: ['acuity','salesforce'] },
  { id: 's52', name: 'Typeform → Airtable Collector',      platform: 'zapier', category: 'Data',             description: 'Route Typeform survey responses to Airtable with field mapping, attachment handling, and conditional routing by response.',       node_count: 3,  tags: ['typeform','airtable'] },
  { id: 's53', name: 'WooCommerce Order Processor',        platform: 'zapier', category: 'Operations',       description: 'Process WooCommerce orders: add buyer to Mailchimp list, create Trello card for fulfillment, and send Slack notification.',       node_count: 4,  tags: ['woocommerce','mailchimp','trello'] },
  { id: 's54', name: 'Slack → Jira Bug Reporter',          platform: 'zapier', category: 'Operations',       description: 'Convert Slack messages with a bug emoji reaction into Jira tickets with priority, component, and reporter automatically set.',     node_count: 3,  tags: ['slack','jira'] },
  { id: 's55', name: 'Typeform → HubSpot Contact',        platform: 'zapier', category: 'Lead Gen',         description: 'Create or update HubSpot contacts from Typeform submissions with custom property mapping and lead source tracking.',              node_count: 3,  tags: ['typeform','hubspot'] },
  { id: 's56', name: 'Notion → Linear Task Sync',          platform: 'zapier', category: 'Operations',       description: 'Sync Notion database items tagged as engineering tasks to Linear issues with priority, cycle, and assignee mapping.',             node_count: 3,  tags: ['notion','linear'] },
  { id: 's57', name: 'Twilio SMS Alert System',            platform: 'zapier', category: 'Communication',    description: 'Send SMS alerts via Twilio for critical events: new high-value deals, server alerts, or form submissions from VIP contacts.',      node_count: 3,  tags: ['twilio','sms'] },
  { id: 's58', name: 'Clearbit Enrichment Flow',           platform: 'zapier', category: 'Data',             description: 'Enrich new HubSpot or Salesforce contacts with Clearbit data: company size, industry, tech stack, and social profiles.',         node_count: 3,  tags: ['clearbit','hubspot','crm'] },
  { id: 's59', name: 'Salesforce Opportunity Alerts',      platform: 'zapier', category: 'CRM',              description: 'Alert sales managers on Slack when high-value Salesforce opportunities stall, close, or change probability significantly.',       node_count: 4,  tags: ['salesforce','slack'] },
  { id: 's60', name: 'GA4 → Slack Weekly Report',          platform: 'zapier', category: 'Reporting',        description: 'Post a formatted weekly traffic and conversion summary from Google Analytics 4 to a Slack channel every Monday morning.',         node_count: 3,  tags: ['ga4','slack','reporting'] },
  { id: 's61', name: 'AI Chatbot FAQ Responder',           platform: 'n8n',    category: 'AI/ML',            description: 'Build a context-aware FAQ bot using embeddings: index your knowledge base, match questions semantically, respond with Claude.',    node_count: 16, tags: ['embeddings','claude','ai'] },
  { id: 's62', name: 'Multi-Channel Lead Aggregator',      platform: 'make',   category: 'Lead Gen',         description: 'Consolidate leads from LinkedIn Ads, Google Ads, and web forms into a unified CRM pipeline with deduplication and scoring.',        node_count: 12, tags: ['linkedin','google ads','crm'] },
  { id: 's63', name: 'Churn Prediction & Recovery',        platform: 'n8n',    category: 'Customer Support', description: 'Detect at-risk customers using usage signals, trigger personalized outreach from CSM, and log all touchpoints in CRM.',          node_count: 13, tags: ['ai','crm','retention'] },
  { id: 's64', name: 'Expense Report Automation',          platform: 'zapier', category: 'Finance',          description: 'Collect expense receipts from Gmail, extract data with OCR, create expense report in Expensify, and notify approver.',           node_count: 5,  tags: ['gmail','ocr','expensify'] },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<'all' | 'n8n' | 'make' | 'zapier'>('all');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('templates')
          .select('id, name, platform, category, description, node_count, tags')
          .order('name');

        if (!error && data && data.length > 0) {
          setTemplates(data as Template[]);
        } else {
          setTemplates(STATIC_TEMPLATES);
        }
      } catch {
        setTemplates(STATIC_TEMPLATES);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchesPlatform = platform === 'all' || t.platform === platform;
      const matchesCategory = category === 'All' || t.category === category;
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      return matchesPlatform && matchesCategory && matchesSearch;
    });
  }, [templates, platform, category, search]);

  function handleUseTemplate(t: Template) {
    const what = `Based on the "${t.name}" template: ${t.description}`;
    const params = new URLSearchParams({
      platform: t.platform,
      project_name: t.name,
      what_to_build: what,
    });
    router.push(`/portal/new-ticket?${params.toString()}`);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Automation Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and deploy pre-built workflows for n8n, Make.com, and Zapier
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Platform tabs */}
        <div className="flex items-center rounded-lg border bg-muted/30 p-1 gap-0.5">
          {(['all', 'n8n', 'make', 'zapier'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                platform === p
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'all' ? 'All' : p === 'make' ? 'Make.com' : p === 'n8n' ? 'n8n' : 'Zapier'}
            </button>
          ))}
        </div>

        {/* Category dropdown */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} template{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-52 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <BookOpen size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">No templates match your filters</p>
          <button
            onClick={() => { setPlatform('all'); setCategory('All'); setSearch(''); }}
            className="text-blue-600 text-sm mt-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} onUse={handleUseTemplate} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template: t, onUse }: { template: Template; onUse: (t: Template) => void }) {
  const plat = PLATFORM_STYLES[t.platform];

  return (
    <div className="flex flex-col border rounded-xl bg-white hover:shadow-md transition-shadow p-5 gap-3">
      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold border', plat.class)}>
          {plat.label}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
          {t.category}
        </span>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <Zap size={11} />
          {t.node_count} nodes
        </span>
      </div>

      {/* Name */}
      <div>
        <h3 className="font-semibold text-sm leading-snug">{t.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
          {t.description}
        </p>
      </div>

      {/* Tags */}
      {t.tags && t.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* CTA */}
      <Button
        size="sm"
        className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
        onClick={() => onUse(t)}
      >
        Use Template
      </Button>
    </div>
  );
}
