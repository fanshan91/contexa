import { Card } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/guards';

import { UiKitClient } from './ui-kit-client';

export default async function UiKitPage() {
  await requireUser();

  return (
    <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col space-y-6">
        <Card
          title={<span className="text-base">UI Kit</span>}
          contentClassName="text-sm text-muted-foreground"
        >
          用于在不接入 Storybook 的前提下，快速预览与回归检查通用组件的视觉与交互。
        </Card>

        <UiKitClient />
      </div>
    </main>
  );
}
