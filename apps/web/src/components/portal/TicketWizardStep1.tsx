'use client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { WizardStep1Data, TicketType, TicketPriority } from '@/types';

interface Props {
  data: WizardStep1Data;
  onChange: (data: WizardStep1Data) => void;
  onNext: () => void;
}

const platforms: { type: TicketType; label: string; icon: string; desc: string }[] = [
  { type: 'n8n', label: 'n8n', icon: '⚙️', desc: 'Self-hosted automation' },
  { type: 'make', label: 'Make.com', icon: '🔧', desc: 'Visual workflow builder' },
  { type: 'zapier', label: 'Zapier', icon: '⚡', desc: 'Connect 5000+ apps' },
];

export function TicketWizardStep1({ data, onChange, onNext }: Props) {
  function update<K extends keyof WizardStep1Data>(key: K, val: WizardStep1Data[K]) {
    onChange({ ...data, [key]: val });
  }

  function validate() {
    return (
      data.company_name.trim() &&
      data.contact_name.trim() &&
      data.contact_email.trim() &&
      data.what_to_build.trim()
    );
  }

  return (
    <div className="space-y-6">
      {/* Contact info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Company Name *</label>
          <Input
            placeholder="Acme Corp"
            value={data.company_name}
            onChange={(e) => update('company_name', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Contact Name *</label>
          <Input
            placeholder="Jane Smith"
            value={data.contact_name}
            onChange={(e) => update('contact_name', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Contact Email *</label>
          <Input
            type="email"
            placeholder="jane@acme.com"
            value={data.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Project Name</label>
          <Input
            placeholder="Lead Routing Automation"
            value={data.project_name}
            onChange={(e) => update('project_name', e.target.value)}
          />
        </div>
      </div>

      {/* Platform selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Build Platform *</label>
        <div className="grid grid-cols-3 gap-3">
          {platforms.map((p) => (
            <button
              key={p.type}
              type="button"
              onClick={() => update('ticket_type', p.type)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all',
                data.ticket_type === p.type
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-border hover:border-gray-300 text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="text-2xl">{p.icon}</span>
              <span>{p.label}</span>
              <span className="text-xs font-normal text-muted-foreground text-center">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* What to build */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">What needs to be built? *</label>
        <Textarea
          placeholder="Describe the automation or workflow you need built..."
          className="min-h-[100px]"
          value={data.what_to_build}
          onChange={(e) => update('what_to_build', e.target.value)}
        />
      </div>

      {/* Expected outcome */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Expected Outcome</label>
        <Textarea
          placeholder="What should happen when this automation runs? What problem does it solve?"
          className="min-h-[80px]"
          value={data.expected_outcome}
          onChange={(e) => update('expected_outcome', e.target.value)}
        />
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Priority</label>
        <Select value={data.priority} onValueChange={(v) => update('priority', v as TicketPriority)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white px-8"
          onClick={onNext}
          disabled={!validate()}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
