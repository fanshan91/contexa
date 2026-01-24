import { requireSystemAdmin } from '@/lib/auth/guards';
import { getTranslations } from 'next-intl/server';
import { NewProjectDialog } from './new-project-dialog';

export default async function NewProjectPage() {
  await requireSystemAdmin();
  const t = await getTranslations('newProject');

  return (
    <NewProjectDialog title={t('title')} backLabel={t('back')} />
  );
}
