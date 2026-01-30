'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ProjectSidebar } from './project-sidebar';

export function ProjectShell({
  projectId,
  projectName,
  children
}: {
  projectId: number;
  projectName: string;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const t = useTranslations('projectNav');

  return (
    <div className="flex h-[calc(100dvh-68px)] w-full flex-col overflow-hidden bg-muted/30">
      <div className="lg:hidden flex items-center justify-between bg-background border-b border-border px-4 py-3">
        <div className="flex items-center">
          <span className="text-sm font-medium">
            {t('mobileTitle', { projectName })}
          </span>
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
        <ProjectSidebar
          projectId={projectId}
          projectName={projectName}
          isSidebarOpen={isSidebarOpen}
          onSidebarOpenChange={setIsSidebarOpen}
        />
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
