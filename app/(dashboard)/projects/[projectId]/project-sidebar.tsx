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
        variant={isActive(item.href) ? 'secondary' : 'ghost'}
        className={`shadow-none my-1 w-full justify-start ${
          isActive(item.href) ? 'bg-gray-100' : ''
        }`}
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
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div className="flex items-center">
          <span className="font-medium">{t('mobileTitle', { projectName })}</span>
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
        className={`w-64 bg-white lg:bg-gray-50 border-r border-gray-200 lg:block ${
          isSidebarOpen ? 'block' : 'hidden'
        } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="h-full overflow-y-auto p-4">
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

