## 问题原因（当前仓库的实际情况）
- [(dashboard)/layout.tsx](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/layout.tsx#L101-L108) 外层是 `min-h-screen`，body 默认可滚动；只要 dashboard 子布局高度控制不严，就会把滚动“回传”到 body，导致左侧菜单也跟着页面一起滚。
- [(dashboard)/dashboard/layout.tsx](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/dashboard/layout.tsx#L71-L112) 外层使用 `min-h-[calc(100dvh-68px)]`，但内部又额外插入了一个 `lg:hidden` 的移动端顶部条（L73-L86）。这会让总高度在小屏时 > `100dvh-68px`，于是 body 出现滚动条。
- [(dashboard)/projects/[projectId]/layout.tsx](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/projects/%5BprojectId%5D/layout.tsx#L95-L103) 同样使用 `min-h-[calc(100dvh-68px)]`；并且 [(project-sidebar.tsx)](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/projects/%5BprojectId%5D/project-sidebar.tsx#L90-L128) 在横向两列布局里额外返回一个移动端顶部条 `div + aside`，容易破坏“只有 main 滚动”的约束。

## 目标（全局一致的滚动策略）
- Dashboard 区域：页面本身不滚动（body 不出现滚动条）。
- 只有内容区滚动：通常是 `<main className="overflow-y-auto">`（侧边栏需要独立滚动时再保留 sidebar 内部的 `overflow-y-auto`）。
- 关键约束：滚动容器祖先链路的高度必须是“确定的 height”，不要依赖 `min-height`。

## 实施方案（我将直接按此改代码）
### 1) 修复 /dashboard 的布局高度计算
- 修改文件：[(dashboard)/dashboard/layout.tsx](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/dashboard/layout.tsx#L71-L112)
- 改法：把外层从 `min-h-[calc(100dvh-68px)]` 调整为“固定高度 + 内部两段式布局”。推荐结构：
  - 外层：`h-[calc(100dvh-68px)] overflow-hidden flex flex-col`
  - 移动端顶部条：保持在外层第一行（不参与滚动）
  - 两列主体容器：`flex-1 overflow-hidden flex`
  - `<main>` 保留 `overflow-y-auto`
  - `<nav>` 保留 `overflow-y-auto`（仅侧边栏内部滚动）

### 2) 修复 /projects/[projectId] 的侧边栏返回结构
- 修改文件：
  - [(dashboard)/projects/[projectId]/layout.tsx](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/projects/%5BprojectId%5D/layout.tsx#L95-L103)
  - [(project-sidebar.tsx)](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/projects/%5BprojectId%5D/project-sidebar.tsx#L90-L128)
- 改法：把移动端顶部条从 `ProjectSidebar` 里移出，放到 layout 里，让 layout 明确变成：
  - 外层：`h-[calc(100dvh-68px)] overflow-hidden flex flex-col`
  - 第一行：移动端顶部条（只在小屏显示）
  - 第二行：`flex-1 overflow-hidden flex`，内部仅 `aside/main` 两列
  - `ProjectSidebar` 组件只返回 `<aside>`（避免在横向 flex 行里多塞一个块级元素）

### 3) 统一 Dashboard 路由组的“禁止 body 滚动”策略（可选但推荐）
- 修改文件：[(dashboard)/layout.tsx](file:///Users/victor/Desktop/项目/TMS/contexa/app/(dashboard)/layout.tsx#L101-L108)
- 改法：在该 route group 的最外层容器增加 `overflow-hidden`，并确保 children 自己提供滚动容器。
- 说明：只影响 dashboard 区域，不会影响登录页等需要 body 滚动的页面。

## 验证方式（改完我会做）
- 桌面端：长列表/长表格页面只滚动 main，侧边栏不随页面滚动；侧边栏内部菜单超长时自身可滚。
- 移动端：确认不会因为顶部条额外高度导致 body 出现滚动条；抽屉式侧栏打开/关闭不影响主滚动。

## 交付物
- 只改布局相关文件，保证“仅内容区滚动”的体验在 /dashboard 与 /projects/* 下全局一致。