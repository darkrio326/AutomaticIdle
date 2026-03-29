# CHANGELOG

本文件记录 `docs/project` 维度下的文档与流程变更。

格式约定：
- 日期：`YYYY-MM-DD`
- 时间：`YYYY-MM-DD HH:mm +0800`
- 变更分类：新增 / 变更 / 修复 / 归档

## [Unreleased]

### 变更
- [YYYY-MM-DD HH:mm +0800] 在此记录本轮文档结构、流程口径、模板引用路径等调整。
- [2026-03-29 18:12 +0800] ITER-006：新增列表式流程编辑器（`FlowEditor.vue`）与流程状态管理（`flowStore.ts`），支持步骤新增/删除、配方选择、执行次数修改与模拟触发。
- [2026-03-29 17:59 +0800] ITER-005：搭建 Vue 3 + TypeScript + Pinia + Vite 工程骨架；确立 core / stores / components / services 四层分离；现有 core 文件类型检查无报错。
- [2026-03-29 17:48 +0800] ITER-004：新建 `src/core/upgradeSystem.ts`，实现升级条件校验、升级购买与升级前后收益对比（基于 `simulateFlow()`）。
- [2026-03-29 17:37 +0800] ITER-003：新建 `src/core/expSystem.ts`，实现 `calcRequiredExp` / `calcLevelFromTotalExp` / `applyExpGains` 三个纯函数，经验升级系统可独立调用。
- [2026-03-29 17:26 +0800] ITER-002：新建 `src/core/simulator.ts`，实现 `simulateFlow()`，含技能/升级加速、时间下限兜底、金币统计、瓶颈检测，TypeScript 类型检查无报错。
- [2026-03-29 17:15 +0800] ITER-001：`src/core/types.ts` 新增 `GameConfig` 接口；将 `OrderConfig.rewards` 改为可选字段；`src/config/resources.json` 修正 `gold.sellPrice` 为 `-1`（不可卖）。
- [2026-03-29 16:58 +0800] 小修改：标准化格式化 `docs/design/` 下四份需求文档（draft.md / data-model.md / simulator-design.md / state-flow.md），统一标题层级、列表符号、代码块，移除 Apple 专有 `•` 列表与 `⸻` 分隔符。
- [2026-03-29 16:46 +0800] 小修改：优化 `README.md` 的"主要系统"与"Roadmap"章节层级，避免混合列表导致的渲染歧义。
- [2026-03-29 16:41 +0800] 小修改：格式化 `README.md`，统一 Markdown 标题层级、列表样式、代码块与公式展示，移除非标准分隔符与不一致缩进。
- [2026-03-29 16:30 +0800] 小修改：按标准模板统一格式化 `docs/process/iteration-idea-backlog.md`，修正 IDEA-003 至 IDEA-015 的标题层级、列表符号与条目排版一致性。
### 新增
- [YYYY-MM-DD HH:mm +0800] 在此记录本轮新增文档或新增章节。

### 修复
- [YYYY-MM-DD HH:mm +0800] 在此记录本轮修复的文档错误、引用错误、流程冲突。

## [vX.Y.Z] - YYYY-MM-DD

### 变更
- [YYYY-MM-DD HH:mm +0800] 示例条目：版本发布前的文档收口说明。
