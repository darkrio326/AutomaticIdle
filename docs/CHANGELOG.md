# CHANGELOG

本文件记录 `docs/project` 维度下的文档与流程变更。

格式约定：
- 日期：`YYYY-MM-DD`
- 时间：`YYYY-MM-DD HH:mm +0800`
- 变更分类：新增 / 变更 / 修复 / 归档

## [Unreleased]

### 变更
- [YYYY-MM-DD HH:mm +0800] 在此记录本轮文档结构、流程口径、模板引用路径等调整。
- [2026-03-30 09:45 +0800] 小修改：在迭代想法池新增 IDEA-028（基于 prototype 原型优化工程 UI），用于承接原型到工程界面的对齐落地。
- [2026-03-30 09:35 +0800] 小修改：在迭代想法池新增 IDEA-017 至 IDEA-027（runtime 拆分方案），用于承接 IDEA-016 的执行拆分。
- [2026-03-30 09:20 +0800] 小修改：在迭代想法池新增 IDEA-016（实时运行态与动态资源反馈），并更新 backlog 文档日期。
- [2026-03-30 10:40 +0800] ITER-015/016/017：新建 `src/core/runtimeEngine.ts`，实现 RuntimeEngine 类（rAF tick 循环、步骤推进器、单步动作执行器、资源/EXP 结算、GPS 滑动窗口），待生效流程切换框架已就位。
- [2026-03-30 10:10 +0800] ITER-014：新建 `src/core/runtimeTypes.ts`，定义 RuntimeStatus / RuntimeState / createInitialRuntimeState，覆盖引擎控制、流程状态、步骤执行、玩家状态副本、GPS 统计摘要字段。
- [2026-03-30 09:08 +0800] ITER-013：新增离线收益基础版，基于最后存档时间进行有限时长补发，启动时结算资源与经验并防止重复领取。
- [2026-03-30 07:25 +0800] ITER-012：新增本地存档与恢复能力，支持流程与玩家状态自动保存、启动恢复、版本兜底。
- [2026-03-30 07:22 +0800] ITER-011：新增订单系统轻量版，支持订单展示、提交校验、需求扣减、奖励发放与完成状态管理。
- [2026-03-30 07:16 +0800] ITER-010：新增技能面板与 EXP 可视化，应用模拟结果时同步结算经验并触发技能升级展示。
- [2026-03-30 07:12 +0800] ITER-009：新增升级面板与购买流程，支持可购状态展示、升级执行与升级前后收益对比（时间/金币/GPS）。
- [2026-03-30 07:09 +0800] ITER-008：新增库存结算能力（预览与应用分离），支持将模拟结果应用到库存，并在库存不足时阻止应用并提示错误。
- [2026-03-29 18:26 +0800] ITER-007：新增独立模拟结果面板（`SimResultPanel.vue`），展示核心指标、资源/经验净变化及基于瓶颈步骤的轻量优化建议；`FlowEditor.vue` 职责收口为编辑与触发。
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
