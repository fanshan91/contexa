## 目标
- 在不改整体布局的前提下，让界面配色更“精致/有层次”。
- **重点优化左侧菜单**：改为“深色侧边栏”（类似飞书/钉钉管理后台），并让 **选中态与 hover** 在“背景 + 文字（含图标）”上有明确差异。
- 继续遵守现有规范：颜色只在 [globals.css](file:///Users/victor/Desktop/%E9%A1%B9%E7%9B%AE/TMS/contexa/app/globals.css) 定义，业务/组件只消费语义类。

## 现状与问题定位
- 当前侧边栏使用 `bg-background`（白底）+ `Button` 的 `secondary/ghost`，整体对比弱，容易显得“素”。
- `secondary/muted/accent` 在亮色模式下同值，导致表面层级不够。
- 少量硬编码色（如遮罩 `bg-black/30`）破坏一致性。

## 左侧菜单（深色侧边栏）设计方案
- **新增 Sidebar 语义 Token（全局）**：
  - `sidebar`：侧边栏底色（深色，但不纯黑，偏蓝灰）
  - `sidebar-foreground`：默认文字/图标色（偏浅灰）
  - `sidebar-accent`：hover/active 背景（比 sidebar 更亮一档）
  - `sidebar-accent-foreground`：hover/active 文字/图标色（更亮，接近白）
  - `sidebar-border`：侧边栏分割线/边框（低对比但可见）
  - 可选：`sidebar-muted-foreground`（用于分组标题/弱提示）
- **交互态（参考飞书/钉钉后台）**：
  - 默认：背景透明 + 文字/图标较弱（例如 70–80% 亮度）
  - Hover：背景切到 `sidebar-accent`，文字/图标切到 `sidebar-accent-foreground`
  - Active：背景固定 `sidebar-accent`，文字/图标更亮 + 字重稍提升；并增加 **左侧高亮条（使用 primary）** 作为强识别（飞书/钉钉常见做法）
  - Focus：沿用现有 ring 体系，但在深色侧边栏上确保可见
- **落点文件（将统一替换样式）**：
  - [dashboard/layout.tsx](file:///Users/victor/Desktop/%E9%A1%B9%E7%9B%AE/TMS/contexa/app/(dashboard)/dashboard/layout.tsx#L83-L99)：aside/nav/菜单按钮样式
  - [project-sidebar.tsx](file:///Users/victor/Desktop/%E9%A1%B9%E7%9B%AE/TMS/contexa/app/(dashboard)/projects/%5BprojectId%5D/project-sidebar.tsx#L100-L120)：同样的 aside/nav/菜单按钮样式

## 全局配色“精致度”提升（不动结构）
1. **拉开 Surface 层级**：微调 `background / card / secondary / muted / accent / border` 的关系，让页面背景、面板、分组底更有层次（尤其是 `secondary/muted/accent` 不再完全同值）。
2. **提升文字层级清晰度**：适度加深 `muted-foreground`（避免“灰蒙蒙”），让信息层级更干净。
3. **状态色使用策略更高级**：在 UI 里更多使用 `bg-状态色/10~15 + border-状态色/20 + text-状态色` 的组合（减少大面积高饱和纯色块）。
4. **补齐 overlay/scrim Token**：把 `bg-black/30` 这类硬编码遮罩抽成语义色，明暗模式一致。
5. **品牌色一致性修复**：修复 logo 内 `hsl(var(--...))` 与当前 RGB Token 体系不一致的问题，避免品牌色偏差导致观感变“廉价”。

## 实施步骤（确认后我会直接落地）
1. 在 `globals.css` 增加并映射 Sidebar 语义 Token（含 dark 适配）。
2. 改造两处左侧菜单（Dashboard + Project）：
   - aside 用 `bg-sidebar text-sidebar-foreground border-sidebar-border`
   - 菜单项实现 hover/active 明显差异 + 左侧高亮条
3. 增加 overlay/scrim Token，并替换对话框遮罩硬编码色。
4. 微调基础 Token（surface/text 层级）并做全站回归检查。
5. 目视验证关键页面（侧边栏、列表页、表单页、弹窗），确保一致性与对比度。

## 交付结果
- 左侧菜单深色体系（更接近飞书/钉钉后台），hover/active 对比明显。
- 一套更有层次的全局配色 Token（仍完全兼容 shadcn/ui 与语义类）。
- 遮罩/品牌色等细节统一，整体质感提升。