'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Building2,
  User,
  Globe,
  DollarSign,
  Target,
  Wrench,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAIN_POINTS = [
  'Manual data entry',
  'Disconnected systems / no integration',
  'Slow or manual reporting',
  'Manual client follow-ups / outreach',
  'Manual invoicing or billing',
  'Spreadsheet-heavy processes',
  'Manual scheduling / booking',
  'Data silos across teams',
  'Manual lead management',
  'Slow client onboarding',
  'Manual document generation',
  'Repetitive email tasks',
  'Manual inventory tracking',
  'No automated notifications',
  'Slow approval workflows',
];

const TOOLS = [
  'Salesforce', 'HubSpot', 'Pipedrive', 'QuickBooks', 'Xero',
  'Monday.com', 'Asana', 'Notion', 'ClickUp', 'Slack',
  'Google Workspace', 'Microsoft 365', 'Shopify', 'Stripe',
  'Zendesk', 'Intercom', 'Airtable', 'Trello', 'Jira',
  'Zoho', 'FreshBooks', 'NetSuite',
];

const INDUSTRIES = [
  'Accounting / Finance',
  'Construction / Real Estate',
  'E-commerce / Retail',
  'Healthcare / Medical',
  'Legal / Law Firm',
  'Marketing / Agency',
  'Manufacturing',
  'Professional Services',
  'Property Management',
  'Recruiting / Staffing',
  'SaaS / Technology',
  'Education',
  'Non-profit',
  'Other',
];

const COMPANY_SIZES = [
  '1–10 employees',
  '11–50 employees',
  '51–200 employees',
  '201–500 employees',
  '500+ employees',
];

const REVENUES = [
  'Under $500K',
  '$500K – $2M',
  '$2M – $10M',
  '$10M – $50M',
  '$50M+',
];

const GOALS = [
  'Reduce manual work & save time',
  'Scale without hiring more staff',
  'Improve reporting & visibility',
  'Faster client onboarding',
  'Increase revenue & close rate',
  'Cut operational costs',
  'Improve data accuracy',
  'Better customer experience',
];

interface SelectChipProps {
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  max?: number;
}

function SelectChips({ options, selected, onChange, max }: SelectChipProps) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, opt]);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
            selected.includes(opt)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

interface SelectFieldProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}

function SelectField({ value, onChange, options, placeholder }: SelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-gray-700"
    >
      <option value="" disabled>
        {placeholder || 'Select…'}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [website, setWebsite] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [currentTools, setCurrentTools] = useState<string[]>([]);
  const [customTool, setCustomTool] = useState('');
  const [transcript, setTranscript] = useState('');

  function addCustomTool() {
    const t = customTool.trim();
    if (t && !currentTools.includes(t)) {
      setCurrentTools([...currentTools, t]);
      setCustomTool('');
    }
  }

  async function handleGenerate() {
    if (!companyName.trim() || !contactName.trim() || !industry) {
      toast.error('Company name, contact name, and industry are required');
      return;
    }
    if (painPoints.length === 0) {
      toast.error('Select at least one pain point');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/opportunity/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          contact_name: contactName,
          industry,
          company_size: companySize,
          website: website || undefined,
          pain_points: painPoints,
          current_tools: currentTools,
          transcript: transcript || undefined,
          annual_revenue: annualRevenue,
          primary_goal: primaryGoal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Generation failed');
        return;
      }

      toast.success('Assessment generated!');
      router.push(`/dashboard/opportunities/${data.id}`);
    } catch {
      toast.error('Failed to generate assessment');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/opportunities"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back to Assessments
        </Link>
        <h1 className="text-2xl font-bold">New Opportunity Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the company details and pain points. Tony uses this after every discovery call to generate a professional assessment for the prospect.
        </p>
      </div>

      {/* Section: Company Info */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Building2 size={14} /> Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 size={13} className="text-muted-foreground" /> Company Name
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corporation"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <User size={13} className="text-muted-foreground" /> Contact Name
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Industry <span className="text-red-500">*</span>
              </label>
              <SelectField
                value={industry}
                onChange={setIndustry}
                options={INDUSTRIES}
                placeholder="Select industry…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company Size</label>
              <SelectField
                value={companySize}
                onChange={setCompanySize}
                options={COMPANY_SIZES}
                placeholder="Select size…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Globe size={13} className="text-muted-foreground" /> Website
              </label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <DollarSign size={13} className="text-muted-foreground" /> Annual Revenue
              </label>
              <SelectField
                value={annualRevenue}
                onChange={setAnnualRevenue}
                options={REVENUES}
                placeholder="Select range…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Target size={13} className="text-muted-foreground" /> Primary Goal
            </label>
            <SelectField
              value={primaryGoal}
              onChange={setPrimaryGoal}
              options={GOALS}
              placeholder="What does this company most want to achieve?"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: Pain Points */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <AlertTriangle size={14} /> Pain Points
            {painPoints.length > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-normal normal-case">
                {painPoints.length} selected
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Select all the pain points the prospect mentioned during the call.
          </p>
          <SelectChips
            options={PAIN_POINTS}
            selected={painPoints}
            onChange={setPainPoints}
          />
        </CardContent>
      </Card>

      {/* Section: Current Tools */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Wrench size={14} /> Current Tools & Tech Stack
            {currentTools.length > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-normal normal-case">
                {currentTools.length} selected
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Select tools they currently use. This helps Claude recommend the right automations and integrations.
          </p>
          <SelectChips
            options={TOOLS}
            selected={currentTools}
            onChange={setCurrentTools}
          />
          {/* Custom tool input */}
          <div className="flex gap-2 pt-1">
            <Input
              value={customTool}
              onChange={(e) => setCustomTool(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTool();
                }
              }}
              placeholder="Add custom tool…"
              className="h-8 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomTool}
              className="h-8 shrink-0"
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section: Call Transcript */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <FileText size={14} /> Call Transcript / Notes
            <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">(optional but recommended)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Paste the call transcript or your discovery notes. The more context, the more tailored the assessment.
          </p>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste transcript or notes here…&#10;&#10;E.g.: &quot;Tony: What does your current invoicing process look like?&#10;Jane: We manually create each invoice in Excel, then email them... it takes about 3 hours per week...&quot;"
            rows={10}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y min-h-[120px]"
          />
          {transcript && (
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {transcript.length.toLocaleString()} characters
            </p>
          )}
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <p className="text-sm text-muted-foreground">
          Generation takes 30–60 seconds. The assessment will be saved automatically.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm min-w-48"
          size="lg"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating Assessment…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Assessment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
