import Link from 'next/link';
import { Settings, Download, Upload, FileDown, RefreshCcw, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, type TableColumn } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const project = {

    id,
    name: '海外电商 App',
    description: '覆盖首页、购物车、支付与订单中心，当前版本进入多语言发布阶段。',
    sourceLocale: 'zh-CN',
    targetLocales: ['en-US', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE'],
    totalKeys: 1386
  };
  const stats = {
    globalProgress: 72,
    pendingReview: 38,
    missing: 96
  };

  const localeStats = [
    {
      locale: 'en-US',
      label: '英语',
      flag: '��',
      progress: 100,
      translated: 1386,
      missing: 0,
      review: 0
    },
    {
      locale: 'ja-JP',
      label: '日语',
      flag: '��',
      progress: 74,
      translated: 1026,
      missing: 220,
      review: 40
    },
    {
      locale: 'ko-KR',
      label: '韩语',
      flag: '��',
      progress: 36,
      translated: 498,
      missing: 780,
      review: 24
    },
    {
      locale: 'fr-FR',
      label: '法语',
      flag: '��',
      progress: 88,
      translated: 1218,
      missing: 96,
      review: 24
    },
    {
      locale: 'de-DE',
      label: '德语',
      flag: '��',
      progress: 60,
      translated: 832,
      missing: 430,
      review: 38
    }
  ];

  const entryRows = [
    {
      key: 'checkout.button.confirm',
      source: '确认下单',
      status: '待验收',
      locale: 'de-DE',
      updatedAt: '2026-01-28 16:42'
    },
    {
      key: 'profile.empty.title',
      source: '暂无账号资料',
      status: '待翻译',
      locale: 'ko-KR',
      updatedAt: '2026-01-28 15:20'
    },
    {
      key: 'home.banner.subtitle',
      source: '满 299 元包邮',
      status: '已完成',
      locale: 'fr-FR',
      updatedAt: '2026-01-28 14:05'
    },
    {
      key: 'settings.security.desc',
      source: '开启双重验证保障账户安全',
      status: '待验收',
      locale: 'ja-JP',
      updatedAt: '2026-01-28 11:18'
    },
    {
      key: 'order.history.empty',
      source: '暂无最近订单',
      status: '已完成',
      locale: 'en-US',
      updatedAt: '2026-01-27 19:40'
    }
  ];

  const entryColumns: Array<TableColumn<(typeof entryRows)[number]>> = [
    {
      key: 'key',
      title: 'Key',
      headerClassName: 'text-xs text-muted-foreground',
      cellClassName: 'py-3 pr-4 text-sm text-foreground',
      render: (value: unknown) => (
        <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
          {String(value)}
        </span>
      )
    },
    {
      key: 'source',
      title: '源文案',
      headerClassName: 'text-xs text-muted-foreground',
      cellClassName: 'py-3 pr-4 text-sm text-foreground'
    },
    {
      key: 'status',
      title: '状态',
      headerClassName: 'text-xs text-muted-foreground',
      cellClassName: 'py-3 pr-4 text-sm',
      render: (value: unknown) => {
        const status = String(value);
        const tone =
          status === '已完成'
            ? 'text-success'
            : status === '待验收'
              ? 'text-warning'
              : 'text-destructive';

        return <span className={`text-xs font-medium ${tone}`}>{status}</span>;
      }
    },
    {
      key: 'updatedAt',
      title: '最近更新',
      headerClassName: 'text-xs text-muted-foreground text-right',
      cellClassName: 'py-3 text-right text-sm text-muted-foreground',
      align: 'right'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="text-xs text-muted-foreground">
          <Link href="/projects" className="text-foreground">
            项目
          </Link>
          <span className="mx-2">/</span>
          <span>{project.name}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{project.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${id}/settings`}>
                <Settings className="size-4" />
                项目设置
              </Link>
            </Button>
            <Button size="sm">
              <Download className="size-4" />
              导出全部语言包
            </Button>
          </div>
        </div>
      </div>

      <Card
        title={<span className="text-base">项目进度概览</span>}
        description={<span className="text-sm">汇总全局进度、规模与待处理事项</span>}
        contentClassName="grid gap-3 lg:grid-cols-3"
      >
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">总体完成度</div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xl font-semibold text-foreground">{stats.globalProgress}%</div>
            <span className="text-xs text-muted-foreground">平均进度</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${stats.globalProgress}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">翻译规模</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{project.totalKeys}</div>
          <div className="mt-2 text-xs text-muted-foreground">源语言 · {project.sourceLocale}</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">待处理事项</div>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground">待验收</span>
              <span className="text-warning">{stats.pendingReview}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground">待翻译</span>
              <span className="text-destructive">{stats.missing}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={<span className="text-base">快速操作</span>}
        description={<span className="text-sm">频繁录入与同步入口</span>}
        contentClassName="flex flex-wrap gap-3"
      >
        <Button size="sm">
          <Upload className="size-4" />
          上传源文件
        </Button>
        <Button size="sm" variant="outline">
          <FileDown className="size-4" />
          导入译文
        </Button>
        <Button size="sm" variant="outline">
          <RefreshCcw className="size-4" />
          从代码仓同步
        </Button>
      </Card>

      <Card
        title={<span className="text-base">目标语言状态</span>}
        description={<span className="text-sm">查看各语言进度与待处理量</span>}
        contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {localeStats.map((item) => {
          const statusLabel =
            item.progress >= 100 ? '可发布' : item.progress === 0 ? '未开始' : '进行中';
          const statusTone =
            item.progress >= 100
              ? 'text-success'
              : item.progress === 0
                ? 'text-destructive'
                : 'text-info';

          return (
            <div key={item.locale} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span>{item.flag}</span>
                    <span>{item.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.locale}</div>
                </div>
                <span className={`rounded-full border border-border bg-card px-2 py-0.5 text-xs ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>已翻译 {item.translated}</span>
                <span>待验收 {item.review}</span>
                <span>待翻译 {item.missing}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline">
                  下载
                </Button>
                <Button size="sm" variant={item.progress < 100 ? 'default' : 'outline'}>
                  {item.progress < 100 ? '翻译' : '验收'}
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      <Card
        title={<span className="text-base">词条工作台</span>}
        description={<span className="text-sm">聚焦近期更新与待处理条目</span>}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${id}/workbench`}>
              查看全部词条
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        }
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground"
            >
              概览
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1 text-sm text-muted-foreground"
            >
              全部词条
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1 text-sm text-muted-foreground"
            >
              历史记录
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="搜索 Key / 文案" className="w-60" />
            <Button size="sm" variant="outline">
              筛选
            </Button>
          </div>
        </div>
        <Table columns={entryColumns} data={entryRows} rowKey="key" className="rounded-lg border border-border" />
      </Card>
    </div>
  );
}
