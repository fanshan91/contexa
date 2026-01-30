'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { NewProjectForm } from './new-project-form';

export function NewProjectDialog({
  title,
  backLabel
}: {
  title: string;
  backLabel: string;
}) {
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.push('/dashboard');
      }}
      title={title}
      contentClassName="max-w-3xl"
      footer={
        <div className="pt-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">{backLabel}</Link>
          </Button>
        </div>
      }
    >
      <NewProjectForm />
    </Dialog>
  );
}
