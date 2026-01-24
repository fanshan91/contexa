'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, Languages, LayoutTemplate, Menu, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = {
  href: string;
  icon: typeof BookOpen;
  label: string;
};

function ProjectSidebarNav({
  navItems,
  onNavigate
}: {
  navItems: NavItem[];
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return navItems.map((item) => (
    <Link key={item.href} href={item.href} passHref>
      <Button
        variant="ghost"
        className={[
          "my-0.5 h-9 w-full justify-start gap-2 px-3 text-sm shadow-none",
          "text-sidebar-foreground/90 hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground",
          isActive(item.href)
            ? "bg-sidebar-accent/15 text-sidebar-accent-foreground font-medium relative overflow-hidden before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-primary"
            : ""
        ].join(" ")}
        onClick={onNavigate}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Button>
    </Link>
  ));
}

export function ProjectSidebar({
  projectId,
  projectName
}: {
  projectId: number;
  projectName: string;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const t = useTranslations('projectNav');

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        href: `/projects/${projectId}/packages`,
        icon: Languages,
        label: t('packages')
      },
      {
        href: `/projects/${projectId}/glossary`,
        icon: BookOpen,
        label: t('glossary')
      },
      {
        href: `/projects/${projectId}/workbench`,
        icon: LayoutTemplate,
        label: t('workbench')
      },
      {
        href: `/projects/${projectId}/context`,
        icon: LayoutTemplate,
        label: t('context')
      },
      {
        href: `/projects/${projectId}/settings/basic`,
        icon: Settings,
        label: t('settings')
      }
    ],
    [projectId, t]
  );

  return (
    <>
      <div className="lg:hidden flex items-center justify-between bg-background border-b border-border px-4 py-3">
        <div className="flex items-center">
          <span className="text-sm font-medium">{t('mobileTitle', { projectName })}</span>
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

      <aside
        className={`w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border/12 lg:block ${
          isSidebarOpen ? 'block' : 'hidden'
        } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="h-full overflow-y-auto p-3">
          <div className="hidden lg:block px-3 py-2">
            <div className="truncate text-sm font-semibold text-sidebar-muted-foreground">
              {projectName}
            </div>
          </div>
          <Suspense fallback={null}>
            <ProjectSidebarNav
              navItems={navItems}
              onNavigate={() => setIsSidebarOpen(false)}
            />
          </Suspense>
        </nav>
      </aside>
    </>
  );
}
