# UI 通用组件封装与优化计划

## 1. 目标与背景

为了支撑 TMS 系统的高效开发与统一体验，我们需要基于 [TMS UI Design Tokens](../TMS%20UI%20Design%20Tokens%20说明文档.md) 和 [shadcn/ui](https://ui.shadcn.com/) 构建一套完整的通用组件库。
当前系统仅包含少量基础组件，无法满足原型（如翻译工作台、项目设置、列表管理）的复杂需求。本计划旨在补全缺失组件，并确保所有组件严格遵循语义化 Design Tokens。

## 2. 现状分析

### 2.1 已有组件 (`apps/web/components/ui`)
- `avatar.tsx`: 头像
- `button.tsx`: 按钮
- `card.tsx`: 卡片
- `dialog.tsx`: 弹窗
- `dropdown-menu.tsx`: 下拉菜单
- `input.tsx`: 输入框
- `label.tsx`: 标签
- `radio-group.tsx`: 单选组
- `toast.tsx`: 轻提示

### 2.2 缺失组件清单 (基于原型需求分析)

根据 `02 TMS原型文档` 中的 `02_项目列表`、`05_页面翻译工作台`、`09_项目设置` 等核心页面，我们需要补充以下组件：

#### 基础表单类
- **Form**: 表单容器与校验（用于所有表单页）
- **Select**: 下拉选择器（用于语言选择、角色选择）
- **Checkbox**: 复选框（用于多选语言、批量操作）
- **Switch**: 开关（用于“可审核”开关、配置项）
- **Textarea**: 多行文本域（用于项目描述、译文编辑）

#### 数据展示类
- **Table**: 数据表格（用于项目列表、词条列表、成员列表）
- **Badge**: 状态徽章（用于显示待翻译/已定版、License 状态）
- **Tabs**: 标签页（用于项目设置页的多 Tab 切换）
- **Separator**: 分割线（用于视觉分隔）
- **Skeleton**: 骨架屏（用于加载状态占位）
- **ScrollArea**: 滚动区域（用于翻译工作台的长列表容器）

#### 导航与反馈类
- **Breadcrumb**: 面包屑导航（用于层级导航）
- **Sheet**: 侧边抽屉（用于快捷键说明、移动端菜单）
- **Tooltip**: 文字提示（用于图标按钮说明、长文本截断）
- **Alert**: 警告提示（用于 License 到期提醒、冲突提示）
- **Progress**: 进度条（用于显示翻译进度）
- **Collapsible**: 折叠面板（用于构建左侧页面/模块树结构）

## 3. 封装与优化规范 (强制)

所有组件必须遵循以下原则，确保 Design Tokens 的单一事实源地位：

1.  **严禁硬编码颜色**：
    -   ❌ 禁止：`bg-blue-500`, `text-gray-700`, `border-slate-200`
    -   ✅ 必须：`bg-primary`, `text-muted-foreground`, `border-input`
2.  **Dark Mode 适配**：
    -   不使用 `dark:` 前缀硬写样式，而是依赖 CSS 变量的自动切换。
3.  **圆角统一**：
    -   使用 `rounded-*`（如 `rounded-md` / `rounded-lg`），由 `app/globals.css` 的 `@theme inline` 半径 tokens 统一控制。
4.  **Focus 状态**：
    -   统一使用 `ring-ring` (语义化 ring 颜色)。

## 4. 执行计划

### 第一阶段：表单基础 (High Priority)
支撑“项目创建”、“设置”等核心交互。
- [x] 安装 `form` (react-hook-form + zod)
- [x] 安装 `select`
- [x] 安装 `checkbox`
- [x] 安装 `switch`
- [x] 安装 `textarea`

### 第二阶段：数据展示 (High Priority)
支撑“项目列表”、“词条管理”等高频页面。
- [x] 安装 `table` (TanStack Table adapter)
- [x] 安装 `badge` (需扩展 variants: default, secondary, destructive, outline + 自定义状态语义如 success/warning)
- [x] 安装 `tabs`
- [x] 安装 `separator`
- [x] 安装 `skeleton`

### 第三阶段：交互增强 (Medium Priority)
提升用户体验与工作台效率。
- [x] 安装 `sheet`
- [x] 安装 `tooltip`
- [x] 安装 `alert`
- [x] 安装 `progress`
- [x] 安装 `breadcrumb`
- [x] 安装 `scroll-area`
- [x] 安装 `collapsible` (作为 Tree 组件的基础)

### 第四阶段：复杂组件封装 (Custom)
基于上述原子组件封装业务级通用组件。
- [x] **DataTable**: 封装排序、筛选、分页逻辑的通用表格。
- [x] **PageTree**: 基于 `Collapsible` 封装的页面/模块树形导航。
- [x] **StatusBadge**: 基于 `Badge` 封装的状态映射组件 (映射 API 状态到 UI 颜色)。

## 6. 预览入口（替代 Storybook）

- 已添加 `/ui-kit` 页面用于组件预览与回归检查。

## 5. 待执行命令参考

```bash
# Phase 1
npx shadcn@latest add form select checkbox switch textarea

# Phase 2
npx shadcn@latest add table badge tabs separator skeleton

# Phase 3
npx shadcn@latest add sheet tooltip alert progress breadcrumb scroll-area collapsible
```
