'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';
import {
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  MapPin,
  DollarSign,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Paperclip,
  History,
  Wrench,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface DealDetail {
  deal: Record<string, unknown>;
  persons: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  flow: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  org: Record<string, unknown> | null;
  demo_mode: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStr(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const rec = v as Record<string, unknown>;
    return String(rec.name ?? rec.value ?? '');
  }
  return '';
}

function getEmail(arr: unknown): string {
  if (!Array.isArray(arr)) return '';
  const primary = arr.find((e: unknown) => (e as Record<string, unknown>)?.primary);
  return String((primary as Record<string, unknown>)?.value ?? arr[0]?.value ?? '');
}

function getPhone(arr: unknown): string {
  if (!Array.isArray(arr)) return '';
  const primary = arr.find((e: unknown) => (e as Record<string, unknown>)?.primary);
  return String((primary as Record<string, unknown>)?.value ?? (arr[0] as Record<string, unknown>)?.value ?? '');
}

function fmtDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(String(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtValue(v: unknown, currency = 'USD'): string {
  const n = Number(v ?? 0);
  if (!n) return '—';
  return `$${n.toLocaleString()} ${currency}`;
}

function dealAgeDays(addTime: unknown): number {
  if (!addTime) return 0;
  return Math.floor((Date.now() - new Date(String(addTime)).getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-700',
  ANALYZING: 'bg-blue-100 text-blue-700',
  QUESTIONS_PENDING: 'bg-amber-100 text-amber-700',
  BUILDING: 'bg-violet-100 text-violet-700',
  REVIEW_PENDING: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DEPLOYED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const PLATFORM_BADGE: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700',
  make: 'bg-purple-100 text-purple-700',
  zapier: 'bg-orange-100 text-orange-700',
};

const TABS = ['Activity', 'Notes', 'Files', 'History', 'ManageAI Builds'] as const;
type Tab = (typeof TABS)[number];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Activity');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/pipedrive/deals/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Once we have company/email, fetch tickets
        const orgName = getStr(d.deal ?? {}, 'org_name');
        const primaryPerson = d.persons?.[0];
        const email = primaryPerson ? getEmail(primaryPerson.email) : '';
        fetchTickets(orgName, email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function fetchTickets(orgName: string, email: string) {
    setTicketsLoading(true);
    try {
      let query = supabase.from('tickets').select('*').order('created_at', { ascending: false });
      if (orgName) {
        query = query.ilike('company_name', `%${orgName}%`);
      } else if (email) {
        query = query.eq('contact_email', email);
      }
      const { data: rows } = await query;
      setTickets((rows as Ticket[]) ?? []);
    } finally {
      setTicketsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl animate-pulse">
        <div className="h-10 bg-muted rounded-lg w-48" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!data?.deal) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 max-w-xl">
        <AlertCircle size={16} /> Could not load deal #{id}.
      </div>
    );
  }

  const deal = data.deal;
  const primaryPerson = data.persons?.[0] ?? null;
  const org = data.org;

  const companyName = getStr(deal, 'org_name') || getStr(deal, 'title') || `Deal #${id}`;
  const contactName = getStr(deal, 'person_name') || (primaryPerson ? getStr(primaryPerson, 'name') : '');
  const contactEmail = getEmail(primaryPerson?.email) || '';
  const contactPhone = getPhone(primaryPerson?.phone) || '';
  const ownerName = getStr(deal, 'owner_name') || (deal.user_id as Record<string, unknown>)?.name as string || '—';
  const stageName = getStr(deal, 'stage_name') || '—';
  const ageDays = dealAgeDays(deal.add_time);

  // Custom fields from deal (Pipedrive stores as custom_ prefixed or in custom fields array)
  const customFields: Record<string, string> = {};
  const DISPLAY_CUSTOM = [
    'Vertical', 'Lead List', 'Lead Stage', 'Seniority', 'State',
    'AI Readiness Score', 'Software Tools', 'LLM Usage', 'Apollo/Clay Organization',
  ];

  // Build context for agent
  const agentContext = `You are viewing the deal for ${companyName} (Deal #${id}) with contact ${contactName || 'unknown'}. You have access to their full Pipedrive profile. Stage: ${stageName}. Value: ${fmtValue(deal.value, String(deal.currency ?? 'USD'))}. Owner: ${ownerName}.`;

  const salesConfig = {
    ...agentConfigs.sales,
    systemPrompt: `${agentContext}\n\n${agentConfigs.sales.systemPrompt}`,
  };

  // ── Ticket URL builder for new ticket pre-filled with customer data
  const newTicketUrl = `/portal/new-ticket?company=${encodeURIComponent(companyName)}&contact=${encodeURIComponent(contactName)}&email=${encodeURIComponent(contactEmail)}`;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold">{companyName}</h1>
          {data.demo_mode && (
            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Demo</Badge>
          )}
        </div>
        <AgentButton config={salesConfig} />
      </div>

      {/* ── Row 1: Deal + Contact ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deal Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <DollarSign size={14} /> Deal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stage</span>
              <span className="font-medium">{stageName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Value</span>
              <span className="font-bold text-blue-700">{fmtValue(deal.value, String(deal.currency ?? 'USD'))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span>{ownerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Age</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {ageDays > 0 ? `${ageDays} days` : '—'}</span>
            </div>
            {Boolean(deal.expected_close_date) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Close Date</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> {fmtDate(deal.expected_close_date)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                className={`text-[11px] border-0 ${
                  deal.status === 'won' ? 'bg-emerald-100 text-emerald-700' :
                  deal.status === 'lost' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}
              >
                {String(deal.status ?? 'open').replace('_', ' ')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contact Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <User size={14} /> Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {contactName && (
              <div className="flex items-center gap-2">
                <User size={13} className="text-muted-foreground shrink-0" />
                <span className="font-medium">{contactName}</span>
              </div>
            )}
            {contactEmail && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-muted-foreground shrink-0" />
                <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline truncate">
                  {contactEmail}
                </a>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-muted-foreground shrink-0" />
                <a href={`tel:${contactPhone}`} className="hover:underline">{contactPhone}</a>
              </div>
            )}
            {primaryPerson && getStr(primaryPerson, 'job_title') && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wrench size={13} className="shrink-0" />
                <span>{getStr(primaryPerson, 'job_title')}</span>
              </div>
            )}
            {!contactName && !contactEmail && (
              <p className="text-muted-foreground text-xs">No contact linked to this deal.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Organization ── */}
      {(org || companyName) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Building2 size={14} /> Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {org && (
              <>
                {getStr(org, 'name') && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Company</div>
                    <div className="font-medium">{getStr(org, 'name')}</div>
                  </div>
                )}
                {getStr(org, 'industry') && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Industry</div>
                    <div>{getStr(org, 'industry')}</div>
                  </div>
                )}
                {org.employee_count && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Employees</div>
                    <div>{String(org.employee_count)}</div>
                  </div>
                )}
                {getStr(org, 'address') && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin size={10} /> Address</div>
                    <div className="text-xs">{getStr(org, 'address')}</div>
                  </div>
                )}
                {getStr(org, 'web_site_url') && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Globe size={10} /> Website</div>
                    <a
                      href={getStr(org, 'web_site_url')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {getStr(org, 'web_site_url')}
                    </a>
                  </div>
                )}
              </>
            )}
            {/* Custom fields */}
            {DISPLAY_CUSTOM.map((field) => {
              const val = customFields[field];
              if (!val) return null;
              return (
                <div key={field}>
                  <div className="text-xs text-muted-foreground mb-0.5">{field}</div>
                  <div className="text-xs">{val}</div>
                </div>
              );
            })}
            {!org && (
              <div className="col-span-4 text-xs text-muted-foreground">No organization data.</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {tab === 'ManageAI Builds' && tickets.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                  {tickets.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Activity Tab */}
        {activeTab === 'Activity' && (
          <div className="space-y-3">
            {data.activities.length === 0 && (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            )}
            {data.activities.map((act, i) => (
              <div key={(act.id as number) ?? i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={13} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium">{getStr(act, 'subject') || getStr(act, 'type')}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(act.due_date)} · {getStr(act, 'type')}
                    {act.done ? ' · ✓ Done' : ' · Pending'}
                  </div>
                  {getStr(act, 'note') && (
                    <div className="text-xs text-muted-foreground mt-0.5">{getStr(act, 'note')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'Notes' && (
          <div className="space-y-3">
            {data.notes.length === 0 && (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
            {data.notes.map((note, i) => (
              <Card key={(note.id as number) ?? i}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={13} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {(note.user as Record<string, unknown>)?.name as string ?? '—'} · {fmtDate(note.add_time)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">{getStr(note, 'content')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'Files' && (
          <div className="space-y-2">
            {data.files.length === 0 && (
              <p className="text-sm text-muted-foreground">No files attached to this deal.</p>
            )}
            {data.files.map((file, i) => (
              <div key={(file.id as number) ?? i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Paperclip size={14} className="text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{getStr(file, 'name') || getStr(file, 'file_name')}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(file.add_time)}</div>
                </div>
                {Boolean(file.url) && (
                  <a
                    href={String(file.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'History' && (
          <div className="space-y-3">
            {data.flow.length === 0 && (
              <p className="text-sm text-muted-foreground">No history events.</p>
            )}
            {data.flow.map((event, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <History size={13} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm">{getStr(event, 'subject') || getStr(event, 'object') || 'Event'}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(event.timestamp ?? event.add_time)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ManageAI Builds Tab */}
        {activeTab === 'ManageAI Builds' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Builds linked to <strong>{companyName}</strong>
              </p>
              <Link
                href={newTicketUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <PlusCircle size={13} /> Create New Ticket
              </Link>
            </div>

            {ticketsLoading && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            )}

            {!ticketsLoading && tickets.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <FileText size={28} className="mx-auto mb-2 opacity-30" />
                No builds found for this client.
                <br />
                <Link href={newTicketUrl} className="text-blue-600 hover:underline mt-1 inline-block">
                  Create the first ticket →
                </Link>
              </div>
            )}

            {!ticketsLoading && tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/dashboard/tickets/${ticket.id}`}
                className="block"
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200 hover:border-blue-200">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{ticket.project_name || ticket.what_to_build || `Ticket #${ticket.id}`}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{ticket.what_to_build}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ticket.ticket_type && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${PLATFORM_BADGE[ticket.ticket_type] ?? 'bg-gray-100 text-gray-700'}`}>
                            {ticket.ticket_type}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Created {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
