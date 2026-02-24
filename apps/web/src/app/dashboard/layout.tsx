import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { OrgProvider } from '@/lib/org/context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OrgProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
              {children}
            </main>
          </div>
        </div>
      </OrgProvider>
    </AuthGuard>
  );
}
