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

### ITER-021 UI 收敛（参考 Prototype 对齐）
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 4
- 类型：能力增强
- 目标：参考 prototype theme.css 主题变量体系，建立工程全局样式基线并对齐页面信息层次。
- 改动范围：
  - 新建 `src/style.css`（全局 CSS 变量体系 + reset + 基础组件样式）
  - 修改 `src/main.ts`（引入 style.css）
  - 修改 `src/App.vue`（header 布局 + card 层次）
- 未改动范围：各面板组件（依赖全局 section 样式提升）
- 完成内容：
  - `src/style.css`：引入 CSS 自定义变量（--background/--foreground/--primary/--accent/--border/--radius 等）参考 prototype 语义设计
  - 全局 button/select/input/section/ul 样式统一
  - App.vue header 区域 + subtitle 展示
  - 每个 section 卡片化（白底、border、阴影、圆角）
  - 类型检查通过；npm run build 成功（53 modules，CSS 3.88KB）
- 未完成内容：暗色主题未实现（可后续迭代）
- 测试情况：类型检查通过；构建通过
- 风险与注意事项：展示类改动不影响逻辑层，回滚只需移除 style.css 并还原 main.ts 导入
- 回滚方式：回滚上述 3 个文件改动即可
- 结论：IDEA-028 完成，Phase 4 闭环，v0.1 全量 ITER 已落地。
- 下一步建议：执行 v0.1 综合验收，完成后出 v0.1-RELEASE.md。

### ITER-020 资源平滑变化 + 实时 GPS 刷新
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 3
- 类型：能力增强
- 目标：实现资源平滑更新和实时 GPS 展示。
- 改动范围：
  - 修改 `src/stores/runtimeStore.ts`（新增 liveInventory 字段，每帧同步）
  - 修改 `src/components/SimResultPanel.vue`（实时摘要区、实时库存展示）
- 未改动范围：其他文件
- 完成内容：
  - runtimeStore 新增 `liveInventory` 字段，每帧从 engine playerState 投影，不触发持久化
  - SimResultPanel 展示"实时 GPS" + "循环次数"实时摘要区
  - 运行中库存展示切换为 liveInventory（每帧更新），停止后恢复 flowStore.inventoryEntries
  - 库存条目改为内联标签样式展示
  - 静态模拟提示文案更新，区分"静态模拟"与"实时运行"语义
  - 类型检查通过；npm run build 成功（51 modules）
- 未完成内容：无
- 测试情况：类型检查通过；构建通过
- 风险与注意事项：liveInventory 每帧展开拷贝，对大库存对象有微小内存开销，当前规模可忽略
- 回滚方式：回滚上述两个文件改动即可
- 结论：IDEA-025 + IDEA-026 完成，资源实时反馈与 GPS 展示已就位。
- 下一步建议：进入 ITER-021（UI 收敛，参考 prototype 对齐）。

### ITER-019 步骤高亮与进度条组件
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 3
- 类型：能力增强
- 目标：实现当前执行步骤高亮 + 进度条展示。
- 改动范围：
  - 修改 `src/App.vue`（添加 onMounted 初始化引擎）
  - 修改 `src/components/FlowEditor.vue`（运行控制按键、步骤高亮、进度条）
- 未改动范围：引擎层和 stores 层
- 完成内容：
  - App.vue `onMounted` 调用 `runtimeStore.initEngine()`
  - FlowEditor 新增运行控制区：⯈ 开始运行 / ⏸ 暂停 / ⏹ 停止 / ⯈ 继续 四个按丫按状态条件渲染
  - 步骤列表当前步骤添加 `step-active` 高亮样式
  - 当前步骤展示进度条：指示当前 repeat / 总 repeat 与百分比
  - 步骤编辑操作（新增/删除/改配方/改次数）后通知 runtimeStore.notifyFlowChanged()
  - 待生效提示文案展示
  - 类型检查通过
- 未完成内容：无
- 测试情况：类型检查通过
- 风险与注意事项：进度条百分比使用 recipe.timeSeconds 简化计算（不含加速加成），视觉目的可容忍
- 回滚方式：回滚上述两个文件改动即可
- 结论：IDEA-024 完成，步骤高亮与进度条已就位。
- 下一步建议：进入 ITER-020（资源平滑 + 实时 GPS 刷新）。

### ITER-018 RuntimeStore 与待生效流程切换
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：建立 RuntimeStore，实现待生效流程切换，抓通引擎层与 Vue 响应式状态层的连接。
- 改动范围：新建 `src/stores/runtimeStore.ts`
- 未改动范围：`flowStore.ts`、`src/core/*.ts`、组件层
- 完成内容：
  - `useRuntimeStore` Pinia Store：持有 RuntimeEngine 实例（模块级，不放 Pinia state）
  - `initEngine()`：从 flowStore 取初始流程/玩家状态创建引擎实例
  - `start()` / `pause()` / `resume()` / `stop()` 控制接口
  - `notifyFlowChanged()`：运行中写入 pendingFlow，idle 时直接替换
  - `notifyConfigChanged()`：升级后同步最新 GameConfig 到引擎
  - `_onEngineTick()`：每帧将引擎状态投影到 Pinia 响应式字段
  - `_syncPlayerStateBack()`：每 2s 回写 playerState 到 flowStore 并持久化
  - `stepProgressRatio` getter：进度条 0~1 比例
  - 类型检查通过
- 未完成内容：当前进度条百分比使用 recipe.timeSeconds 简化计算，未反映加速变量（进度条视觉可容忍）
- 测试情况：类型检查通过
- 风险与注意事项：_syncPlayerStateBack 每 2s 触发一次持久化，引擎擅毁时最多丢失 2s 收益；引擎持有 playerState 副本，需避免外部共享引用
- 回滚方式：删除 `src/stores/runtimeStore.ts` 即可（未修改其他文件）
- 结论：IDEA-022 + IDEA-023 完成，Phase 2 闭环。
- 下一步建议：进入 ITER-019（步骤高亮 + 进度条 UI）。

### ITER-017 运行时资源与 EXP 结算
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：实现单步动作完成后将资源和 EXP 变化确实写入 RuntimeState.playerState。
- 改动范围：`src/core/runtimeEngine.ts`（executeOneRepeat、advanceStep 中的结算逻辑）
- 未改动范围：其他所有文件
- 完成内容：
  - `executeOneRepeat()`：消耗输入资源、产出输出资源、结算 EXP 并调用 `applyExpGains()`（含启动升级）
  - 资源写入 `state.playerState.inventory`；技能升级写入 `state.playerState.skills`
  - 返回本次产出的货币量用于 GPS 窗口统计
  - 类型检查通过
- 未完成内容：无
- 测试情况：类型检查通过；逻辑已与 simulator.ts 对齐校验
- 风险与注意事项：playerState 为引用可写操作，外部不应共享同一对象；EXP 升级已内嵌，技能升级即时生效
- 回滚方式：回滚 `src/core/runtimeEngine.ts` 即可
- 结论：IDEA-021 完成，Phase 1 全量资源/EXP 结算已就位。
- 下一步建议：进入 ITER-018（RuntimeStore + 待生效流程切换）。

### ITER-016 步骤推进器 + 单步动作执行器
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：实现步骤推进器与单步动作执行器，达到自动循环执行流程的能力。
- 改动范围：`src/core/runtimeEngine.ts`
- 未改动范围：其他所有文件
- 完成内容：
  - `calcActualStepTime()`：与 simulator.ts 一致的技能+升级加速公式
  - `executeOneRepeat()`：单步动作原子执行，不负责循环控制
  - `advanceStep()`：基于 deltaMs 推进 stepProgress/repeatProgress，单帧内支持跨多次 repeat 和跨步骤
  - 步骤切换时检查 pendingFlow 并应用（待生效机制已慿入）
  - 流程末尾自动回绕＋loopCount++
  - 安全阀：单帧最多 200 次迭代防止占用
  - 类型检查通过
- 未完成内容：无
- 测试情况：类型检查通过
- 风险与注意事项：极端帧率下跨步骤迭代有安全阀保护。deltaMs 小于当前步骤需求时不存在跨步。
- 回滚方式：回滚 `src/core/runtimeEngine.ts` 即可
- 结论：IDEA-019 + IDEA-020 完成，步骤自动推进与循环已就位。
- 下一步建议：进入 ITER-017（运行时资源与 EXP 结算）。

### ITER-015 Tick 时钟驱动器
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：实现基于 requestAnimationFrame + deltaTime 的时钟驱动器。
- 改动范围：新建 `src/core/runtimeEngine.ts`
- 未改动范围：其他所有文件
- 完成内容：
  - `RuntimeEngine` 类：`start()` / `pause()` / `resume()` / `stop()` 四种控制方法
  - `_tick(now)`：基于 performance.now() 计算 deltaMs，推进步骤，推进 GPS 山示窗口
  - resume() 重置 lastTickAt 避免恢复时补算暂停期 deltaTime
  - GPS 5s 滑动窗口半重置（不跳变）
  - `onTick(cb)` 注册回调，每帧广播状态变更到外部 store
  - `updateConfig()` / `replaceState()` 支持外部更新配置和状态
  - 类型检查通过
- 未完成内容：无
- 测试情况：类型检查通过
- 风险与注意事项：需浏览器环境运行，src/env.d.ts 已内置 requestAnimationFrame 类型
- 回滚方式：回滚 `src/core/runtimeEngine.ts` 即可
- 结论：IDEA-018 完成，Tick 引擎基础已就位。
- 下一步建议：进入 ITER-016（步骤推进器 + 单步执行器）。

### ITER-014 RuntimeState 数据模型
- 日期：2026-03-30
- 所属版本：v0.1
- 所属阶段：Phase 1
- 类型：能力增强
- 目标：定义 runtime 引擎所需全量运行时状态类型，为 Tick 驱动器与 RuntimeStore 建立稳定边界。
- 改动范围：
  - 新建 `src/core/runtimeTypes.ts`
- 未改动范围：所有现有文件（纯新增）
- 完成内容：
  - 定义 `RuntimeStatus`（idle/running/paused）
  - 定义 `RuntimeState` 接口，覆盖引擎控制（status/lastTickAt）、流程状态（activeFlow/pendingFlow）、步骤执行（stepIndex/stepProgress/repeatProgress/loopCount）、玩家状态副本（playerState）、GPS 统计摘要（gps/goldInWindow/gpsWindowMs）
  - 导出 `createInitialRuntimeState(playerState)` 工厂函数
  - `vue-tsc --noEmit` 无报错
- 未完成内容：无
- 测试情况：类型检查通过
- 风险与注意事项：playerState 为运行时可写副本，需由 runtimeStore 与 flowStore 同步边界，后续 ITER-018 明确
- 回滚方式：删除 `src/core/runtimeTypes.ts` 即可
- 结论：IDEA-017 完成，runtime 引擎地基已立。
- 下一步建议：进入 ITER-015（Tick 时钟驱动器）。

### ITER-013 离线收益基础版
- 日期：2026-03-30
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-013，实现离线收益的基础补发闭环。
- 改动范围：
  - 修改 `src/services/saveService.ts`
  - 修改 `src/stores/flowStore.ts`
  - 修改 `src/components/FlowEditor.vue`
- 未改动范围：`src/core/*.ts`、`src/config/*.json`、订单与升级组件
- 完成内容：
  - 存档结构新增 `lastSavedAt`，用于离线时长计算
  - 启动恢复时按“离线时长上限 4 小时”进行简化离线收益结算
  - 离线收益同时补发资源与经验，并应用技能升级逻辑
  - 结算后立即写回存档，避免刷新反复领取同一段离线收益
  - 新增离线结算提示文案，告知离线时长、结算上限与补发轮次
  - 类型检查通过：`saveService.ts`、`flowStore.ts`、`FlowEditor.vue` 无报错
- 未完成内容：未实现按技能成长动态重算离线多轮效率（当前为简化固定轮次模型）
- 测试情况：手动校验离线恢复路径、结算上限路径、刷新后不重复领取路径
- 风险与注意事项：离线收益采用简化模型，长离线下与实时逐轮模拟可能有偏差
- 回滚方式：回滚上述 3 个文件改动即可
- 结论：IDEA-013 完成，放置属性基本闭环形成。
- 下一步建议：进入 IDEA-014（流程模板与预设方案）。

### ITER-012 本地存档与恢复
- 日期：2026-03-30
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-012，实现本地存档、初始化恢复与基础自动保存。
- 改动范围：
  - 新建 `src/services/saveService.ts`
  - 修改 `src/stores/flowStore.ts`
- 未改动范围：`src/core/*.ts`、`src/config/*.json`、各组件渲染逻辑
- 完成内容：
  - 新增存档服务：`loadSaveSnapshot` / `saveSnapshot` / `clearSaveSnapshot`
  - 新增 store 初始化恢复：启动时优先加载本地快照，恢复流程与玩家状态
  - 新增自动保存：步骤编辑、结算、升级购买、订单提交后自动持久化
  - 持久化范围覆盖：flowName、steps、playerState、completedOrderIds、unlockedRecipeIds
  - 兼容兜底：存档损坏或版本不匹配时自动回退默认初始状态
  - 类型检查通过：`saveService.ts`、`flowStore.ts` 无报错
- 未完成内容：未实现多版本迁移策略与存档导入导出（后续可扩展）
- 测试情况：手动验证保存路径与恢复路径（刷新后状态可恢复）
- 风险与注意事项：当前使用 localStorage，容量与跨端同步能力有限；后续若接云端需新增同步策略
- 回滚方式：回滚上述 2 个文件改动即可
- 结论：IDEA-012 完成，原型具备可持续试玩基础。
- 下一步建议：进入 IDEA-013（离线收益基础版）。

### ITER-011 订单系统轻量版
- 日期：2026-03-30
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-011，实现订单提交、奖励发放与完成状态管理。
- 改动范围：
  - 新建 `src/components/OrderPanel.vue`
  - 修改 `src/stores/flowStore.ts`
  - 修改 `src/components/FlowEditor.vue`
- 未改动范围：`src/core/*.ts`、`src/config/orders.json`、`src/components/SimResultPanel.vue`
- 完成内容：
  - 新增订单面板：展示订单需求、奖励、解锁信息、提交按钮
  - 新增可提交校验：库存不足与已完成状态均有明确原因提示
  - 新增订单提交流程：扣除需求物资、发放奖励、记录完成订单
  - 新增 recipe 解锁处理：对 unlock type=recipe 的配置执行启用逻辑
  - 提交后状态即时刷新，已完成订单不可重复提交
  - 类型检查通过：`OrderPanel.vue`、`flowStore.ts`、`FlowEditor.vue` 无报错
- 未完成内容：未实现订单链式进度引导与奖励动画（后续可增强）
- 测试情况：手动验证可提交/不可提交/重复提交阻断路径，库存与状态变化符合预期
- 风险与注意事项：当前订单完成状态仅存在内存中，刷新后不会保留（后续 IDEA-012 存档接入）
- 回滚方式：回滚上述 3 个文件改动即可
- 结论：IDEA-011 完成，订单目标机制已接入主循环。
- 下一步建议：进入 IDEA-012（本地存档与恢复）。

### ITER-010 技能面板与 EXP 可视化
- 日期：2026-03-30
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-010，提供技能成长可视化，并把 EXP 结算接入状态流。
- 改动范围：
  - 新建 `src/components/SkillPanel.vue`
  - 修改 `src/stores/flowStore.ts`
  - 修改 `src/components/FlowEditor.vue`
- 未改动范围：`src/core/*.ts` 算法实现、`src/config/*.json`、`src/components/SimResultPanel.vue`
- 完成内容：
  - 新增技能面板：展示技能等级、当前经验/所需经验、升级进度百分比、效率加成
  - 在 `applySimulationResult()` 中接入 EXP 结算，应用资源结果时同步应用 `expDelta`
  - 经验结算复用 `applyExpGains`，保持 core 逻辑复用与一致性
  - 技能数据由 store getter 统一组装，组件仅负责展示
  - 类型检查通过：`SkillPanel.vue`、`flowStore.ts`、`FlowEditor.vue` 无报错
- 未完成内容：未实现技能详情页与历史经验曲线（后续可增强）
- 测试情况：手动验证模拟后应用结果可提升技能经验并触发升级，面板数据同步更新
- 风险与注意事项：当前经验结算绑定“应用结果”动作，后续若引入自动轮询模拟需复核结算时机
- 回滚方式：回滚上述 3 个文件改动即可
- 结论：IDEA-010 完成，经验系统从隐藏计算升级为可视化成长反馈。
- 下一步建议：进入 IDEA-011（订单系统轻量版）。

### ITER-009 升级面板与购买流程
- 日期：2026-03-30
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-009，实现升级列表展示、购买交互与升级前后收益对比。
- 改动范围：
  - 新建 `src/components/UpgradePanel.vue`
  - 修改 `src/stores/flowStore.ts`
  - 修改 `src/components/FlowEditor.vue`
- 未改动范围：`src/core/*.ts`、`src/config/*.json`、`src/components/SimResultPanel.vue`
- 完成内容：
  - 新增升级面板：展示升级名称、当前等级、消耗、可购状态
  - 新增升级购买流程：调用 `purchaseUpgrade`，成功后同步库存和升级等级
  - 新增升级前后收益对比：展示 totalTime / totalGoldGained / goldPerSecond 的前后值与 delta
  - 升级失败原因可见：资源不足、技能不足、达上限等
  - 购买后可自动刷新当前流程模拟结果，保证反馈实时
  - 类型检查通过：`UpgradePanel.vue`、`flowStore.ts`、`FlowEditor.vue` 无报错
- 未完成内容：未实现批量升级与多升级组合对比（后续可扩展）
- 测试情况：手动验证升级可购/不可购路径、对比查看路径、购买后数值刷新路径，均符合预期
- 风险与注意事项：当前收益对比为单次升级视角，不代表长期最优策略；后续可结合多轮模拟提升建议质量
- 回滚方式：回滚上述 3 个文件改动即可
- 结论：IDEA-009 完成，金币/物品投入路径已形成操作闭环。
- 下一步建议：进入 IDEA-010（技能面板与 EXP 可视化）。

### ITER-008 资源库存与状态结算
- 日期：2026-03-30
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-008，建立“模拟预览 + 结果应用到库存”的状态闭环。
- 改动范围：
  - 修改 `src/stores/flowStore.ts`
  - 修改 `src/components/SimResultPanel.vue`
- 未改动范围：`src/core/*.ts`、`src/config/*.json`、`src/components/FlowEditor.vue`
- 完成内容：
  - 新增库存可应用校验逻辑，避免资源应用后出现负库存
  - 新增 `applySimulationResult()`：将 `resourceDelta` 应用到 `playerState.inventory`
  - 预览与结算拆分：运行模拟不自动改库存，点击按钮才结算
  - 结果面板新增当前库存展示与“应用本轮结果到库存”操作
  - 库存不足时给出可读提示并阻止应用
  - 类型检查通过：`flowStore.ts`、`SimResultPanel.vue` 无报错
- 未完成内容：未接入技能经验实时结算与库存持久化（后续 IDEA-010 / IDEA-012）
- 测试情况：手动验证预览-应用主路径、库存不足阻断路径，行为符合预期
- 风险与注意事项：当前库存校验在 store 层实现，后续若引入多来源结算需抽离通用结算服务
- 回滚方式：回滚上述 2 个文件改动即可
- 结论：IDEA-008 完成，原型从“收益计算器”升级为“有状态流程原型”。
- 下一步建议：进入 IDEA-009（升级面板与购买流程）。

### ITER-007 模拟结果面板
- 日期：2026-03-29
- 所属版本：MVP / v0.1
- 所属阶段：Phase 2
- 类型：能力增强
- 目标：完成并验收 IDEA-007，提供独立的模拟结果面板，提升流程优化反馈可读性。
- 改动范围：
  - 新建 `src/components/SimResultPanel.vue`
  - 修改 `src/components/FlowEditor.vue`
- 未改动范围：`src/core/*.ts`、`src/stores/flowStore.ts`、`src/config/*.json`
- 完成内容：
  - 结果展示从流程编辑器拆分为独立组件，职责边界更清晰
  - 展示核心指标：总耗时、总金币、每秒金币、瓶颈步骤
  - 展示资源净变化与经验净变化列表
  - 新增轻量优化建议：根据瓶颈步骤映射对应 `recipe_time` 升级方向
  - 空结果与错误状态可见，避免空白页面
  - 类型检查通过：`SimResultPanel.vue`、`FlowEditor.vue` 无报错
- 未完成内容：未提供图表化展示与多轮结果对比（后续可增强）
- 测试情况：手动验证运行模拟后数据渲染、无结果状态、错误信息显示，表现符合预期
- 风险与注意事项：优化建议为启发式规则，不代表全局最优解；后续可结合升级收益对比进一步精细化
- 回滚方式：回滚上述 2 个文件改动即可
- 结论：IDEA-007 完成，结果反馈链路建立。
- 下一步建议：进入 IDEA-008（资源库存与状态结算）。

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
