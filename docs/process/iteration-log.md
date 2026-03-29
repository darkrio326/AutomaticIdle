# 迭代日志

更新日期：2026-03-29

## 记录规则

- 每轮迭代都记录
- 记录事实，不写愿景
- 记录执行后的真实结果，不记录执行前计划
- 至少包含目标、范围、完成度、测试、风险、回滚

## 条目模板

```markdown
### ITER-XXX 标题
- 日期：YYYY-MM-DD
- 所属版本：vX.Y.Z
- 所属阶段：Phase N
- 类型：重构 / 测试 / 文档 / 治理 / 能力增强 / Bugfix
- 目标：
- 改动范围：
- 未改动范围：
- 完成内容：
- 未完成内容：
- 测试情况：
- 风险与注意事项：
- 回滚方式：
- 结论：
- 下一步建议：
```

## 与迭代工作流模板的边界

- `迭代工作流`：执行前流程与门禁
- 本模板：执行后记录与追溯
- 若执行前计划与实际不一致，以本模板中的“实际结果”为准，并在条目中说明偏差

## 关联要求

每条日志应可追溯到：
- 版本计划
- 相关代码/文档变更
- CHANGELOG 条目

---

## 迭代记录

### ITER-006 列表式流程编辑器
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-006，实现最小可用的列表式流程编辑器，支持编辑流程并触发模拟计算。
- 改动范围：
  - 新建 `src/stores/flowStore.ts`
  - 新建 `src/components/FlowEditor.vue`
  - 修改 `src/App.vue`
- 未改动范围：`src/core/*.ts`、`src/config/*.json`、`src/services/*`、`src/stores/*` 其他文件
- 完成内容：
  - 支持步骤新增、删除、配方选择、执行次数修改（repeat >= 1）
  - 支持一键运行模拟，并展示核心结果：总耗时、总金币、每秒金币、瓶颈步骤
  - 使用 Pinia store 承载流程状态，组件只做渲染与事件派发
  - 模拟调用复用 `simulateFlow()`，未将计算逻辑写入组件层
  - 类型检查通过：`FlowEditor.vue`、`flowStore.ts`、`App.vue` 无报错
- 未完成内容：
  - 未实现步骤顺序调整（本轮未纳入范围）
  - 未实现流程持久化存档（后续 IDEA-012）
- 测试情况：手动验证增删改与运行模拟主路径，结果和错误提示均可反馈
- 风险与注意事项：当前 playerState 为本地默认初始值，后续接入库存状态时需与 IDEA-008 统一
- 回滚方式：回滚上述 3 个文件改动即可
- 结论：IDEA-006 完成，流程可编辑能力已形成。
- 下一步建议：进入 IDEA-007（模拟结果面板）。

### ITER-005 Vue 工程骨架搭建
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：完成并验收 IDEA-005，建立 Vue 3 + TypeScript + Pinia + Vite 工程脚手架，确立四层分离架构边界。
- 改动范围：
  - 新建 `package.json`、`vite.config.ts`、`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`index.html`
  - 新建 `src/main.ts`（Vue + Pinia 初始化）、`src/App.vue`（根组件骨架）
  - 新建 `src/stores/`、`src/components/`、`src/services/` 目录，各含架构说明 README
- 未改动范围：`src/core/*.ts`（全部零改动）、`src/config/*.json`
- 完成内容：
  - 四层架构目录全部到位（core / stores / components / services）
  - `tsconfig.app.json`：`moduleResolution: bundler`、`@/*` alias，与现有 core 文件完全兼容
  - `App.vue` 为纯骨架，不引入任何 core 逻辑，架构边界清晰
  - `src/core/*.ts` 及 `src/main.ts` 类型检查全部无报错
- 未完成内容：依赖包尚未安装（`npm install`，需在本地执行）
- 测试情况：VSCode 类型检查通过，工程配置结构符合 Vue 官方脚手架惯例
- 风险与注意事项：首次 `npm install` 后可能需要重启 VSCode TS 服务器以识别新依赖
- 回滚方式：删除本次新建的所有文件；`src/core/` 不受任何影响
- 结论：IDEA-005 完成，工程骨架就位，可直接进入 UI 层迭代。
- 下一步建议：进入 IDEA-006（列表式流程编辑器）。

### ITER-004 升级系统接入模拟器
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：完成并验收 IDEA-004，实现金币/物品驱动的升级购买与升级前后收益对比能力。
- 改动范围：
  - `src/core/upgradeSystem.ts`（新建）：`canPurchaseUpgrade` / `purchaseUpgrade` / `compareFlowBeforeAfterUpgrade`
- 未改动范围：`src/core/simulator.ts`、`src/core/expSystem.ts`、`src/core/types.ts`、所有 JSON 配置
- 完成内容：
  - 新增升级条件校验：等级上限、技能等级门槛、资源成本校验
  - 新增升级购买：扣减 inventory 成本并提升对应 upgrade 等级
  - 新增收益对比：基于 `simulateFlow()` 输出 upgrade 前后 `totalTime` / `totalGoldGained` / `goldPerSecond` 差值
  - 失败路径可读：升级不存在、资源不足、技能不足、已达上限均返回明确原因
  - TypeScript 类型检查无报错
- 未完成内容：无自动化测试（测试框架尚未接入）
- 测试情况：人工验收逻辑路径（可购买、不可购买、购买后收益对比），结果符合预期
- 风险与注意事项：当前对比函数按“购买一次升级后立即模拟一轮”建模，尚未覆盖多次连续升级与批量购买策略
- 回滚方式：删除 `src/core/upgradeSystem.ts`
- 结论：IDEA-004 完成，升级系统已与模拟器形成可验证闭环。
- 下一步建议：进入 IDEA-005（Vue 项目初始化与基础工程骨架）。

### ITER-003 经验值系统实现
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：完成并验收 IDEA-003，新建纯 TypeScript EXP 工具模块，提供技能升级计算能力，供后续游戏循环调用。
- 改动范围：
  - `src/core/expSystem.ts`（新建）：`calcRequiredExp` / `calcLevelFromTotalExp` / `applyExpGains`
- 未改动范围：`src/core/simulator.ts`（设计约定第一版不在单轮内实时升级）、`src/core/types.ts`、所有 JSON 配置
- 完成内容：
  - `calcRequiredExp(level, formula)` → `floor(base × level^exponent)`，与 skills.json expFormula 完全对应
  - `calcLevelFromTotalExp(totalExp, skillConfig)` → 从累计总经验反推等级与剩余经验，用于存档读取
  - `applyExpGains(skillStates, expDelta, skillConfigs)` → 不可变更新，含逐级消耗循环与 maxLevel 上限
  - TypeScript 类型检查无报错，零 Vue/DOM 依赖
- 未完成内容：无自动化测试（Vitest 框架尚未接入）
- 测试情况：人工推导验收——mining Lv1 exp=0 加 50 exp，升至 Lv3 剩余 exp=12（10+28=38，50-38=12）；`calcRequiredExp(1)=10`、`calcRequiredExp(2)=28`，与公式吻合
- 风险与注意事项：maxLevel 达到后多余经验清零，后续若需保留溢出经验需调整；`applyExpGains` 对 skillConfigs 中不存在的 skillId 静默跳过，调用方需确保配置完整
- 回滚方式：删除 `src/core/expSystem.ts`
- 结论：IDEA-003 完成，EXP 成长系统可独立调用，为 IDEA-004 升级系统和后续游戏循环做好接口。
- 下一步建议：进入 IDEA-004（升级系统接入模拟器）。

### ITER-002 流程模拟器基础版实现
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：完成并验收 IDEA-002，实现纯 TypeScript 单轮流程模拟器 `simulateFlow()`，验证核心玩法逻辑可跑通。
- 改动范围：
  - `src/core/simulator.ts`（新建）：实现 `simulateFlow(flow, playerState, config): SimulationResult`
- 未改动范围：`src/core/types.ts`、所有 `src/config/*.json`、UI 层、Store 层
- 完成内容：
  - `simulateFlow()` 完整实现，覆盖所有 `SimulationResult` 字段
  - 技能加速：`skillMultiplier = 1 - (level-1) × timeReductionPerLevel`
  - 升级加速：遍历 `recipe_time` 升级，`upgradeMultiplier = Π(1 - level × effectPerLevel)`
  - 时间下限兜底：`finalTime = max(0.1, baseTime × skillMultiplier × upgradeMultiplier)`
  - 金币统计：识别 `currency` 类资源正向变化之和
  - 瓶颈检测：`stepResults` 中 `totalTime` 最大的步骤
  - 技能等级不满足时抛出明确错误
  - TypeScript 类型检查无报错
- 未完成内容：无自动化测试（Vitest 框架尚未接入）
- 测试情况：人工推导样例验收（mine×10→smelt×5→sell×5，totalTime=20.5s，gold=40，gps≈1.95），逻辑与设计文档一致
- 风险与注意事项：`sell` 类 recipe `timeSeconds=0` 会命中 `max(0.1, 0)=0.1` 下限，属预期行为；后续接实时循环时需注意 sell 步骤时间语义
- 回滚方式：删除 `src/core/simulator.ts`
- 结论：IDEA-002 完成，模拟器可独立运行，为 IDEA-003/004 接入经验与升级系统做好基础。
- 下一步建议：进入 IDEA-003（经验值系统接入模拟器）。

### ITER-001 核心数据模型定义完成
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：完成并验收 IDEA-001，确保 `src/core/types.ts` 与 5 份 `src/config/*.json` 完全自洽，为后续模拟器开发建立统一数据边界。
- 改动范围：
  - `src/core/types.ts`：新增 `GameConfig` 接口；将 `OrderConfig.rewards` 改为可选字段
  - `src/config/resources.json`：修正 `gold.sellPrice` 从 `0` 改为 `-1`（不可卖语义）
- 未改动范围：其余 config JSON、backlog 其他 IDEA、所有文档
- 完成内容：
  - 评审发现 3 个问题并全部修复
  - `GameConfig` 接口已添加，覆盖 resources / recipes / skills / upgrades / orders 五个维度
  - `OrderConfig.rewards` 改为可选，与 orders.json 实际结构保持一致（`order_ingot_01` 仅有 unlocks，无 rewards）
  - `gold.sellPrice = -1`，与 data-model.md 中"不可卖"语义约定对齐
- 未完成内容：无
- 测试情况：人工核查 types.ts 接口完整性与 JSON 字段覆盖，未接入自动化测试（MVP 阶段暂缺测试框架）
- 风险与注意事项：后续若添加新资源/配方，需同步维护 JSON 与对应 TypeScript 类型注释
- 回滚方式：git revert ITER-001 涉及的两个文件变更
- 结论：IDEA-001 完成，数据模型地基稳定，可开始 IDEA-002 流程模拟器。
- 下一步建议：进入 IDEA-002（流程模拟器基础版），实现 `simulateFlow()` 函数。
