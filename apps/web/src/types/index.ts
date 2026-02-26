export type TicketStatus =
  | 'SUBMITTED'
  | 'CONTEXT_PENDING'
  | 'ANALYZING'
  | 'QUESTIONS_PENDING'
  | 'BUILDING'
  | 'REVIEW_PENDING'
  | 'APPROVED'
  | 'DEPLOYED'
  | 'CLOSED';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketType = 'n8n' | 'make' | 'zapier';

export interface Ticket {
  id: string;
  company_name: string;
  company_domain?: string;
  contact_name: string;
  contact_email: string;
  project_name?: string;
  description?: string;
  ticket_type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  what_to_build?: string;
  expected_outcome?: string;
  trigger_event?: string;
  systems_involved?: string[];
  constraints?: string;
  ai_summary?: string;
  ai_questions?: AIQuestion[];
  ai_understanding?: string;
  ready_to_build?: boolean;
  recommended_platform?: string;
  complexity_estimate?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AIQuestion {
  id: string;
  question: string;
  category: 'technical' | 'business';
  answer?: string;
}

export interface TicketAsset {
  id: string;
  ticket_id: string;
  asset_type: 'file' | 'transcript' | 'vault_ref' | 'link';
  file_name?: string;
  file_path?: string;
  external_url?: string;
  mime_type?: string;
  file_size?: number;
  category: 'sow' | 'specs' | 'screenshots' | 'data' | 'transcript' | 'other';
  created_at: string;
}

export interface TicketArtifact {
  id: string;
  ticket_id: string;
  artifact_type: 'build_plan' | 'solution_demo' | 'workflow_json' | 'ai_analysis';
  file_name: string;
  file_path: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIAnalysisResult {
  summary: string;
  understanding: string;
  questions: AIQuestion[];
  ready_to_build: boolean;
  recommended_platform: string;
  complexity_estimate: string;
  risk_flags?: string[];
}

// Wizard form state
export interface WizardStep1Data {
  company_name: string;
  contact_name: string;
  contact_email: string;
  project_name: string;
  ticket_type: TicketType;
  what_to_build: string;
  expected_outcome: string;
  priority: TicketPriority;
}

export interface WizardStep2Data {
  files: File[];
  transcript: string;
  links: string[];
}

// ── Opportunity Assessments ──────────────────────────────────────────────────

export interface AssessmentMetrics {
  hours_saved_per_week: number;
  annual_cost_savings: number;
  implementation_cost_low: number;
  implementation_cost_high: number;
  payback_months: number;
  three_year_roi: number;
  opportunities_count: number;
}

export interface OpportunityAssessmentFormData {
  company_name: string;
  contact_name: string;
  industry: string;
  company_size: string;
  website?: string;
  pain_points: string[];
  current_tools: string[];
  annual_revenue: string;
  primary_goal: string;
}

export interface OpportunityAssessment {
  id: string;
  pipedrive_deal_id?: number | null;
  company_name: string;
  contact_name: string;
  form_data: OpportunityAssessmentFormData;
  transcript?: string | null;
  assessment: { metrics?: AssessmentMetrics };
  html_content?: string | null;
  blueprint_content?: string | null;
  status: 'draft' | 'sent' | 'converted';
  created_at: string;
}
