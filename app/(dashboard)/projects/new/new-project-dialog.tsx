'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NewProjectForm } from './new-project-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
        </DialogHeader>

        <NewProjectForm />

        <DialogFooter className="pt-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard">{backLabel}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

