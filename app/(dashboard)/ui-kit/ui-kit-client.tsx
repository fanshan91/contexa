"use client";

import { InfoIcon } from 'lucide-react';
import { z } from 'zod';

import { DataTable } from '@/components/common/data-table';
import { PageTree, type PageTreeNode } from '@/components/common/page-tree';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { CtxBadge } from '@/components/ui/badge';
import { CtxBreadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CtxDialog } from '@/components/ui/dialog';
import { CtxForm, CtxFormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CtxSheet } from '@/components/ui/sheet';
import { CtxSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CtxTooltip, CtxTooltipContent, CtxTooltipProvider, CtxTooltipTrigger } from '@/components/ui/tooltip';
import { useToggle } from '@/lib/hooks/use-toggle';
import { useZodForm } from '@/lib/hooks/use-zod-form';

const demoFormSchema = z.object({
  name: z.string().min(1, '请输入名称'),
  locale: z.enum(['zh-CN', 'en-US'], { message: '请选择语言' }),
  enabled: z.boolean().optional(),
  description: z.string().max(200, '最多 200 字').optional()
});

type DemoRow = { id: string; name: string; status: string; progress: number };

function UiKitClient() {
  const sheet = useToggle();

  const form = useZodForm({
    schema: demoFormSchema,
    defaultValues: {
      name: '',
      locale: 'zh-CN',
      enabled: true,
      description: ''
    }
  });

  const rows: DemoRow[] = [
    { id: 'p-1', name: 'Landing', status: 'approved', progress: 100 },
    { id: 'p-2', name: 'Settings', status: 'reviewing', progress: 72 },
    { id: 'p-3', name: 'Workbench', status: 'in_progress', progress: 38 }
  ];

  const nodes: PageTreeNode[] = [
    {
      id: 'page-1',
      label: '首页',
      children: [
        { id: 'page-1-1', label: 'Hero 区域' },
        { id: 'page-1-2', label: 'FAQ' }
      ]
    },
    {
      id: 'page-2',
      label: '项目设置',
      children: [
        { id: 'page-2-1', label: '基础信息' },
        { id: 'page-2-2', label: '成员管理' }
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card title={<span className="text-base">Buttons / Badges</span>} contentClassName="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CtxBadge>Default</CtxBadge>
            <CtxBadge variant="success">Success</CtxBadge>
            <CtxBadge variant="warning">Warning</CtxBadge>
            <CtxBadge variant="info">Info</CtxBadge>
            <CtxBadge variant="outline">Outline</CtxBadge>
            <StatusBadge status="approved" />
            <StatusBadge status="reviewing" />
          </div>
      </Card>

      <Card title={<span className="text-base">Form Controls</span>} contentClassName="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Input</Label>
              <Input id="demo-input" placeholder="请输入..." />
            </div>

            <div className="space-y-2">
              <Label>Checkbox / Switch</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">启用</span>
                </label>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Textarea</Label>
            <Textarea placeholder="描述..." />
          </div>

          <Separator />

          <CtxForm {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(() => {
                form.reset(form.getValues());
              })}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CtxFormField
                  control={form.control}
                  name="name"
                  label="名称"
                  render={(field) => <Input placeholder="项目名称" {...field} />}
                />

                <CtxFormField
                  control={form.control}
                  name="locale"
                  label="语言"
                  description="示例：源语言选择"
                  render={(field) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="选择语言"
                      className="h-10"
                      options={[
                        { value: 'zh-CN', label: 'zh-CN' },
                        { value: 'en-US', label: 'en-US' }
                      ]}
                    />
                  )}
                />
              </div>

              <CtxFormField
                control={form.control}
                name="description"
                label="描述"
                render={(field) => <Textarea placeholder="最多 200 字" {...field} />}
              />

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  提交
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => form.reset()}>
                  重置
                </Button>
              </div>
            </form>
          </CtxForm>
      </Card>

      <Card title={<span className="text-base">Feedback / Overlay</span>} contentClassName="space-y-4">
          <Alert
            icon={<InfoIcon className="size-4" />}
            title="提示"
            description="这是一个 Alert 示例。"
          />

          <div className="space-y-2">
            <div className="text-sm font-medium">Progress</div>
            <Progress value={62} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CtxDialog
              trigger={
                <Button size="sm" variant="outline">
                  打开 Dialog
                </Button>
              }
              title="Dialog"
              description="用于确认、编辑等交互。"
            />

            <CtxSheet
              open={sheet.value}
              onOpenChange={sheet.setValue}
              trigger={
                <Button size="sm" variant="outline">
                  打开 Sheet
                </Button>
              }
              title="Sheet"
              description="侧边抽屉，用于设置/说明等内容。"
            >
              <div className="text-sm text-muted-foreground">这里放置表单、说明或其它内容。</div>
            </CtxSheet>

            <CtxTooltipProvider>
              <CtxTooltip>
                <CtxTooltipTrigger asChild>
                  <Button size="sm" variant="secondary">
                    Tooltip
                  </Button>
                </CtxTooltipTrigger>
                <CtxTooltipContent>这是一个 Tooltip</CtxTooltipContent>
              </CtxTooltip>
            </CtxTooltipProvider>
          </div>
      </Card>

      <Card title={<span className="text-base">Layout / Navigation</span>} contentClassName="space-y-4">
          <CtxBreadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'UI Kit', current: true }
            ]}
          />

          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="tree">Tree</TabsTrigger>
              <TabsTrigger value="scroll">Scroll</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="mt-4 space-y-3">
              <DataTable<DemoRow>
                columns={[
                  {
                    header: 'Name',
                    accessorKey: 'name'
                  },
                  {
                    header: 'Status',
                    cell: ({ row }) => <StatusBadge status={row.original.status} />
                  },
                  {
                    header: 'Progress',
                    cell: ({ row }) => (
                      <div className="flex items-center gap-2">
                        <div className="w-32">
                          <Progress value={row.original.progress} />
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {row.original.progress}%
                        </span>
                      </div>
                    )
                  }
                ]}
                data={rows}
              />
            </TabsContent>

            <TabsContent value="tree" className="mt-4">
              <PageTree nodes={nodes} defaultExpandedIds={['page-1']} currentId="page-1-2" />
            </TabsContent>

            <TabsContent value="scroll" className="mt-4">
              <ScrollArea className="h-40 rounded-md border" viewportClassName="p-3">
                <div className="space-y-2 text-sm">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-foreground">Row {i + 1}</span>
                      <CtxSkeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
      </Card>
    </div>
  );
}

export { UiKitClient };
