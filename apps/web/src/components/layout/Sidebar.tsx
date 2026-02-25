'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  BookOpen,
  Package,
  Bot,
  Rocket,
  BarChart3,
  Crown,
  TrendingUp,
  Megaphone,
  Layers,
  Code,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Users,
  FileBarChart2,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/portal/new-ticket', label: 'New Ticket', icon: PlusCircle },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { href: '/dashboard/tickets', label: 'Tickets', icon: ClipboardList },
      { href: '/dashboard/templates', label: 'Templates', icon: BookOpen },
      { href: '/dashboard/delivery', label: 'Delivery', icon: Package },
      { href: '/dashboard/build-team', label: 'Build Team', icon: Bot },
      { href: '/dashboard/deploy', label: 'Deploy', icon: Rocket },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'CLIENTS',
    items: [
      { href: '/dashboard/customers', label: 'Customers', icon: Users },
      { href: '/dashboard/opportunities', label: 'Opportunities', icon: FileBarChart2 },
    ],
  },
  {
    title: 'DEPARTMENTS',
    items: [
      { href: '/dashboard/ceo', label: 'CEO', icon: Crown },
      { href: '/dashboard/sales', label: 'Sales', icon: TrendingUp },
      { href: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
      { href: '/dashboard/product', label: 'Product', icon: Layers },
      { href: '/dashboard/engineering', label: 'Engineering', icon: Code },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { href: '/dashboard/settings/agents', label: 'Agent Jobs', icon: Bot },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const displayName = user?.email?.split('@')[0] ?? 'User';

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center px-4 h-16 border-b border-gray-200', collapsed ? 'justify-center' : '')}>
        {!collapsed && (
          <Image src="/logo.png" alt="Manage AI" width={140} height={40} className="object-contain" priority />
        )}
        {collapsed && (
          <Image src="/logo.png" alt="Manage AI" width={28} height={28} className="object-contain" priority />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {/* Section header — hidden when collapsed */}
            {!collapsed && (
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
                  {section.title}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                      collapsed && 'justify-center px-2'
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Sign out */}
      <div className="border-t border-gray-200 px-2 py-3 space-y-1">
        <div className={cn('flex items-center gap-3 px-3 py-2 text-sm text-gray-700', collapsed && 'justify-center')}>
          <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <User size={14} className="text-blue-600" />
          </div>
          {!collapsed && (
            <span className="truncate text-xs font-medium">{displayName}</span>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
