'use client';
import { useState, useRef, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Upload, FileText, Link2, Clock } from 'lucide-react';
import { WizardStep2Data } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  data: WizardStep2Data;
  onChange: (data: WizardStep2Data) => void;
  onNext: () => void;
  onBack: () => void;
}

function getFileCategory(file: File): string {
  const name = file.name.toLowerCase();
  if (name.includes('sow') || name.includes('statement')) return 'sow';
  if (name.includes('spec') || name.includes('requirement')) return 'specs';
  if (file.type.startsWith('image/')) return 'screenshots';
  if (name.includes('.csv') || name.includes('data')) return 'data';
  if (name.includes('transcript') || name.includes('call')) return 'transcript';
  return 'other';
}

const categoryColors: Record<string, string> = {
  sow: 'bg-purple-100 text-purple-700',
  specs: 'bg-blue-100 text-blue-700',
  screenshots: 'bg-green-100 text-green-700',
  data: 'bg-orange-100 text-orange-700',
  transcript: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-700',
};

export function TicketWizardStep2({ data, onChange, onNext, onBack }: Props) {
  const [dragging, setDragging] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    onChange({ ...data, files: [...data.files, ...arr] });
  }

  function removeFile(index: number) {
    const files = data.files.filter((_, i) => i !== index);
    onChange({ ...data, files });
  }

  function addLink() {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    onChange({ ...data, links: [...data.links, trimmed] });
    setLinkInput('');
  }

  function removeLink(index: number) {
    onChange({ ...data, links: data.links.filter((_, i) => i !== index) });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-6">
      {/* File upload zone */}
      <div className="space-y-2">
        <label className="text-sm font-medium">📁 Upload Documents</label>
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            dragging ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-gray-400'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, CSV, PNG, JPG up to 50MB</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {data.files.length > 0 && (
          <div className="space-y-2 mt-3">
            {data.files.map((file, i) => {
              const cat = getFileCategory(file);
              return (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                  <FileText size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{file.name}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', categoryColors[cat])}>
                    {cat}
                  </span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">📝 Paste Transcript</label>
        <Textarea
          placeholder="Paste a call transcript, meeting notes, or any relevant text..."
          className="min-h-[120px]"
          value={data.transcript}
          onChange={(e) => onChange({ ...data, transcript: e.target.value })}
        />
      </div>

      {/* Links */}
      <div className="space-y-2">
        <label className="text-sm font-medium">🔗 Add Links</label>
        <div className="flex gap-2">
          <Input
            placeholder="https://docs.example.com/requirements"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLink()}
          />
          <Button variant="outline" onClick={addLink}>Add</Button>
        </div>
        {data.links.length > 0 && (
          <div className="space-y-2">
            {data.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-background">
                <Link2 size={14} className="text-blue-500 shrink-0" />
                <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                  {link}
                </a>
                <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-destructive">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Vault coming soon */}
      <div className="flex items-center gap-3 p-4 border rounded-xl bg-muted/50">
        <span className="text-xl">🗄️</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Knowledge Vault</span>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Connect your company knowledge base, past projects, and templates</p>
        </div>
        <Clock size={16} className="ml-auto text-muted-foreground shrink-0" />
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}
