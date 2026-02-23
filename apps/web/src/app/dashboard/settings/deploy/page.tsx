'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle, XCircle, Loader2, Save, Zap, Settings2, Globe } from 'lucide-react';

interface N8nForm {
  instanceUrl: string;
  apiKey: string;
}

interface MakeForm {
  apiToken: string;
  teamId: string;
  folderId: string;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

export default function DeployConfigPage() {
  const [n8n, setN8n] = useState<N8nForm>({ instanceUrl: '', apiKey: '' });
  const [make, setMake] = useState<MakeForm>({ apiToken: '', teamId: '', folderId: '' });
  const [n8nStatus, setN8nStatus] = useState<TestStatus>('idle');
  const [makeStatus, setMakeStatus] = useState<TestStatus>('idle');
  const [n8nMsg, setN8nMsg] = useState('');
  const [makeMsg, setMakeMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  async function getAuthHeader(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  }

  async function loadConfig() {
    setLoading(true);
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/deploy/config', {
        headers: { Authorization: auth },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.n8n?.instanceUrl) {
          setN8n((p) => ({ ...p, instanceUrl: data.n8n.instanceUrl }));
        }
        if (data.make?.teamId) {
          setMake((p) => ({ ...p, teamId: String(data.make.teamId), folderId: String(data.make.folderId ?? '') }));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function testN8n() {
    if (!n8n.instanceUrl || !n8n.apiKey) {
      setN8nMsg('Enter both instance URL and API key first.');
      setN8nStatus('fail');
      return;
    }
    setN8nStatus('testing');
    setN8nMsg('');
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/deploy/config?platform=n8n', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ instanceUrl: n8n.instanceUrl, apiKey: n8n.apiKey }),
      });
      const data = await res.json();
      setN8nStatus(data.ok ? 'ok' : 'fail');
      setN8nMsg(data.message ?? '');
    } catch (err) {
      setN8nStatus('fail');
      setN8nMsg((err as Error).message);
    }
  }

  async function testMake() {
    if (!make.apiToken || !make.teamId) {
      setMakeMsg('Enter both API token and team ID first.');
      setMakeStatus('fail');
      return;
    }
    setMakeStatus('testing');
    setMakeMsg('');
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/deploy/config?platform=make', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ apiToken: make.apiToken, teamId: Number(make.teamId) }),
      });
      const data = await res.json();
      setMakeStatus(data.ok ? 'ok' : 'fail');
      setMakeMsg(data.message ?? '');
    } catch (err) {
      setMakeStatus('fail');
      setMakeMsg((err as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    setSaveMsg('');
    try {
      const auth = await getAuthHeader();
      const payload: Record<string, unknown> = {};

      if (n8n.instanceUrl || n8n.apiKey) {
        payload.n8n = {
          instanceUrl: n8n.instanceUrl,
          ...(n8n.apiKey ? { apiKey: n8n.apiKey } : {}),
        };
      }

      if (make.apiToken || make.teamId) {
        payload.make = {
          ...(make.apiToken ? { apiToken: make.apiToken } : {}),
          ...(make.teamId ? { teamId: Number(make.teamId) } : {}),
          ...(make.folderId ? { folderId: Number(make.folderId) } : {}),
        };
      }

      payload.zapier = { mode: 'manual' };

      const res = await fetch('/api/deploy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg('Configuration saved successfully.');
      } else {
        setSaveMsg('Error: ' + (data.error ?? 'Unknown error'));
      }
    } catch (err) {
      setSaveMsg('Error: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: '#4A8FD6' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A2E', margin: '0 0 8px' }}>Deploy Configuration</h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
          Connect your automation platforms to enable one-click deployment of approved workflows.
        </p>
      </div>

      {/* n8n Section */}
      <Section icon={<Settings2 size={18} />} title="n8n" subtitle="Self-hosted n8n instance">
        <Field
          label="Instance URL"
          placeholder="https://n8n.yourcompany.com"
          value={n8n.instanceUrl}
          onChange={(v) => { setN8n((p) => ({ ...p, instanceUrl: v })); setN8nStatus('idle'); }}
        />
        <Field
          label="API Key"
          placeholder="••••••••••••••••••••••••"
          value={n8n.apiKey}
          type="password"
          onChange={(v) => { setN8n((p) => ({ ...p, apiKey: v })); setN8nStatus('idle'); }}
          hint='Generate in n8n: Settings → API → Create API Key'
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button onClick={testN8n} disabled={n8nStatus === 'testing'} style={testBtnStyle}>
            {n8nStatus === 'testing' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Test Connection
          </button>
          <StatusBadge status={n8nStatus} message={n8nMsg} />
        </div>
      </Section>

      {/* Make.com Section */}
      <Section icon={<Zap size={18} />} title="Make.com" subtitle="Make.com (formerly Integromat)">
        <Field
          label="API Token"
          placeholder="••••••••••••••••••••••••"
          value={make.apiToken}
          type="password"
          onChange={(v) => { setMake((p) => ({ ...p, apiToken: v })); setMakeStatus('idle'); }}
          hint="Profile → API Access → New Token"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field
            label="Team ID"
            placeholder="123456"
            value={make.teamId}
            onChange={(v) => { setMake((p) => ({ ...p, teamId: v })); setMakeStatus('idle'); }}
            hint="Your Make.com team numeric ID"
          />
          <Field
            label="Folder ID (optional)"
            placeholder="789"
            value={make.folderId}
            onChange={(v) => setMake((p) => ({ ...p, folderId: v }))}
            hint="Organise scenarios into a folder"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button onClick={testMake} disabled={makeStatus === 'testing'} style={testBtnStyle}>
            {makeStatus === 'testing' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Test Connection
          </button>
          <StatusBadge status={makeStatus} message={makeMsg} />
        </div>
      </Section>

      {/* Zapier Section */}
      <Section icon={<Globe size={18} />} title="Zapier" subtitle="Manual import workflow">
        <div style={infoPanelStyle}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>Manual Import Mode</p>
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            Zapier does not provide a public API for programmatic Zap creation. When you click Deploy
            on a Zapier ticket, Manage AI will generate step-by-step import instructions and a
            structured JSON reference that you can follow inside the Zapier editor.
          </p>
          <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 13, color: '#555', lineHeight: 2 }}>
            <li>No credentials required</li>
            <li>Detailed field-mapping instructions provided with every deploy</li>
            <li>Works with any Zapier plan</li>
          </ul>
        </div>
      </Section>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
        <button onClick={save} disabled={saving} style={saveBtnStyle}>
          {saving ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Save size={16} />
          )}
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#E74C3C' : '#27AE60' }}>
            {saveMsg}
          </span>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={iconCircleStyle}>{icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1A1A2E' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#999' }}>{hint}</p>}
    </div>
  );
}

function StatusBadge({ status, message }: { status: TestStatus; message: string }) {
  if (status === 'idle') return null;
  if (status === 'testing') return <span style={{ fontSize: 13, color: '#666' }}>Testing…</span>;
  if (status === 'ok') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#27AE60' }}>
      <CheckCircle size={14} /> {message || 'Connected'}
    </span>
  );
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#E74C3C' }}>
      <XCircle size={14} /> {message || 'Connection failed'}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8E8F0',
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
};

const iconCircleStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: '#EBF4FF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#4A8FD6',
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: '1px solid #E0E0E8',
  borderRadius: 8,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#FAFAFE',
};

const testBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  background: '#F0F4FF',
  color: '#4A8FD6',
  border: '1px solid #C5D8F5',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const saveBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 24px',
  fontSize: 15,
  fontWeight: 600,
  background: '#4A8FD6',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const infoPanelStyle: React.CSSProperties = {
  background: '#F8F9FB',
  border: '1px solid #E8E8F0',
  borderRadius: 8,
  padding: 16,
};
