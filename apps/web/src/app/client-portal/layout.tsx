import type { ReactNode } from 'react';

export const metadata = {
  title: 'Client Portal — ManageAI',
  description: 'View your automations, reports, and request new builds.',
};

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-black">MANAGE</span>
            <span style={{ color: '#2563EB' }}>AI</span>
          </span>
          <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">
            Client Portal
          </span>
        </div>
        <a
          href="/client-portal/login"
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign Out
        </a>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
