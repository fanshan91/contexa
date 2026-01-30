'use client';

import { useEffect, useState, type TransitionStartFunction } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { type ResolvedSelection } from './context-model';
import { updateModuleAction, updatePageAction } from './actions';

export function ContextDetailsPanel({
  projectId,
  selection,
  isPending,
  startTransition
}: {
  projectId: number;
  selection: ResolvedSelection;
  isPending: boolean;
  startTransition: TransitionStartFunction;
}) {
  const t = useTranslations('projectContext');
  const { push } = useToast();

  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    setDescriptionDraft(
      selection.type === 'page'
        ? selection.page.description ?? ''
        : selection.module?.description ?? ''
    );
  }, [selection.type, selection.page.id, selection.module?.id]);

  const saveDescription = () => {
    startTransition(async () => {
      const result =
        selection.type === 'page'
          ? await updatePageAction({
              projectId,
              pageId: selection.page.id,
              description: descriptionDraft
            })
          : await updateModuleAction({
              projectId,
              moduleId: selection.module?.id ?? -1,
              description: descriptionDraft
            });

      if (!result.ok) {
        push({ variant: 'destructive', message: result.error });
        return;
      }

      push({ variant: 'default', message: result.success });
    });
  };

  return (
    <Card
      className="flex flex-col gap-0 py-0"
      headerClassName="px-4 pt-4 pb-2"
      title={<span className="text-base">{t('description.title')}</span>}
      description={t('description.subtitle')}
      action={
        <div className="flex items-center gap-1">
            {open ? (
              <Button
                variant="outline"
                className="shadow-none"
                onClick={saveDescription}
                disabled={isPending}
              >
                <Check className="h-4 w-4" />
                {t('description.save')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen((prev) => !prev)}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-200',
                  open ? 'rotate-180' : ''
                )}
              />
              <span className="sr-only">
                {open ? t('description.collapse') : t('description.expand')}
              </span>
            </Button>
        </div>
      }
      contentClassName="px-0"
    >
      <div
        data-state={open ? 'open' : 'closed'}
        className="grid transition-[grid-template-rows] duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]"
      >
          <div className="min-h-0 overflow-hidden">
            <div className="px-4 pb-4">
              <div className="h-[150px] space-y-2 overflow-auto sm:h-[170px] lg:h-[190px]">
                <Textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder={t('description.placeholder')}
                  className="min-h-24"
                />
                <div className="text-xs text-muted-foreground">{t('description.hint')}</div>
              </div>
            </div>
          </div>
      </div>
    </Card>
  );
}
