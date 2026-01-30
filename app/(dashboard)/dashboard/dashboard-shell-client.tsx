'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, ScrollText, Settings, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type NavItem = {
  href: string;
  icon: 'users' | 'settings' | 'scroll-text';
  label: string;
};

const iconMap = {
  users: Users,
  settings: Settings,
  'scroll-text': ScrollText
} as const;

function SidebarNav({
  navItems,
  onNavigate
}: {
  navItems: NavItem[];
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return navItems.map((item) => {
    const Icon = iconMap[item.icon];
    const isActive = pathname === item.href;

    return (
      <Link key={item.href} href={item.href}>
        <Button
          variant="ghost"
          className={[
            'my-0.5 h-9 w-full justify-start gap-2 px-3 text-sm shadow-none',
            'text-sidebar-foreground/90 hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground',
            isActive
              ? 'bg-sidebar-accent/15 text-sidebar-accent-foreground font-medium relative overflow-hidden before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-primary'
              : ''
          ].join(' ')}
          onClick={onNavigate}
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </Button>
      </Link>
    );
  });
}

export default function DashboardShell({
  navItems,
  children
}: {
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const t = useTranslations('sidebar');

  return (
    <div className="flex h-[calc(100dvh-68px)] w-full flex-col overflow-hidden bg-muted/30">
      <div className="lg:hidden flex items-center justify-between bg-background border-b border-border px-4 py-3">
        <div className="flex items-center">
          <span className="text-sm font-medium">{t('mobileTitle')}</span>
        </div>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">{t('toggleSidebar')}</span>
        </Button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={`w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border/12 lg:block ${
            isSidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-3">
            <SidebarNav
              navItems={navItems}
              onNavigate={() => setIsSidebarOpen(false)}
            />
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

