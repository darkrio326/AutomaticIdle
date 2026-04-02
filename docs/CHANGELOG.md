# CHANGELOG

本文件记录 `docs/project` 维度下的文档与流程变更。

格式约定：
- 日期：`YYYY-MM-DD`
- 时间：`YYYY-MM-DD HH:mm +0800`
- 变更分类：新增 / 变更 / 修复 / 归档

## [Unreleased]

### 变更
- [2026-04-02 +0800] 小修改（广告位部署）：`scripts/deploy-oss.sh` 现输出 `VITE_ENABLE_ADSENSE` 当前值，便于部署时确认广告是否随本次生产包一并启用；`README.md` 同步补充构建/部署侧广告开关用法。
- [2026-04-02 +0800] 小修改（广告位判定）：桌面端 AdSense 增加 `MutationObserver` 监听 `data-ad-status`、子节点与 iframe 渲染结果；当返回 `unfilled` 或超时仍未真正填充内容时自动折叠，减少误判与空白占位。
- [2026-04-02 +0800] 小修改（广告位开关）：为桌面端 AdSense 增加 `VITE_ENABLE_ADSENSE` 环境开关，默认开启；关闭时组件不再注入广告位容器，便于灰度、回滚或本地临时停投。
- [2026-04-02 +0800] 小修改（广告位容灾）：桌面端 AdSense 新增加载超时自检，若脚本失败或广告内容在限定时间内未真正渲染，则自动折叠底部广告区，避免页面底部长期留空。
- [2026-04-02 +0800] 小修改（工程类型）：新增 `src/vite-env.d.ts`，补齐 `import.meta.env` 与 `VITE_ENABLE_ADSENSE` 的类型声明，消除编辑器对广告组件的环境变量报错。
- [2026-04-02 +0800] 小修改（广告位）：落地桌面端 AdSense Banner v1。新增 `src/components/AdBanner.vue` 负责生产环境脚本懒加载、广告槽初始化与 dev 占位预览；`src/pages/PlayPage.vue` 改为页面内底部流式挂载，仅 PC 端显示，不再遮挡主操作区。
- [2026-04-02 +0800] 小修改（广告位清理）：移除 `index.html` 中原有全局 fixed AdSense 底栏、内联样式与全局 `adsbygoogle.push({})` 调用，改为由页面组件按需初始化，避免所有页面共享同一固定广告容器。
- [2026-04-02 +0800] 小修改（资源）：将当前站点 logo 从 `public/favicon.svg` 转换导出为 `public/favicon.png`（128x128），用于需要 PNG 资源的场景（如平台兼容或素材投放）。
- [2026-04-02 +0800] 小修改（新手引导样式）：将“知道了”按钮从引导卡片底部独立行调整到标题文案右侧同一行展示，避免按钮另起一行打断阅读；移动端保留“去流程页开始搭建”主按钮。
- [2026-04-02 +0800] 小修改（新手引导）：新手引导卡片新增“知道了”按钮（当次会话可手动隐藏）；引导不再因新增步骤立即消失，而是仅在满足“步骤齐全（采集+加工+售卖）或金币已增长”后进入 3 秒倒计时自动隐藏。刷新页面后若仍未达成上述条件，引导会再次出现。
- [2026-04-02 +0800] 新增功能（新手引导）：新增空存档新手引导模块 `src/components/NewPlayerGuide.vue`。当检测到首次进入且流程为空时，移动端会在首页最上方展示引导卡片并提供“一键跳转流程页”按钮；PC 端会在运行面板最上方展示同口径引导，明确给出“采矿 -> 熔炼 -> 出售”的最小起步步骤，降低首屏看不懂直接退出的风险。
- [2026-04-02 +0800] 小修改（埋点）：在 `index.html` 的 `</body>` 前新增 Cloudflare Web Analytics 脚本（token: `dd6da431116845df97c2e5222743a060`），用于页面访问统计。
- [2026-04-02 +0800] 小修改（文档）：更新根目录 `README.md`，将当前实现状态文案从 v0.2 调整为 v0.3，并补充公开试玩地址 `https://idle.darkrio326.top`。
- [2026-04-02 +0800] 小修改（UI）：欢迎页版本文案从 `v0.2 · Early Access` 更新为 `v0.3 · Early Access`（`WelcomePage.vue`），与当前发布版本保持一致。
- [2026-04-02 +0800] 小修改（文档）：根目录 `versions/` 新增 `v0.3-RELEASE.md`，同步 `docs/versions/v0.3-RELEASE.md` 的发布门禁内容，便于在根目录版本文档集中查阅。
- [2026-04-02 +0800] 小修改（UI）：资源库存模块中的“建筑维护费”数值改为红色显示（`StatusPanel.vue` 在维护费行复用 `economy-value-negative` 口径），与负向经济压力提示保持一致。
- [2026-04-02 +0800] 小修改（UI）：`debug=1` 时中间列的“运行面板 + 调试面板”新增可拖拽分隔条，支持上下拖动动态调整两区高度（`PlayPage.vue`）。默认按 68/32 分配并设置最小高度约束，避免任一区域被压缩到不可用。
- [2026-04-02 +0800] 小修改（bugfix/类型）：修复 `flowStore.ts` 中订单完成埋点使用 `order.id` 导致的 TypeScript 报错（`ActiveOrder` 不含 `id` 字段）。改为使用 `order.instanceId`，与 `ActiveOrder` 定义保持一致。
- [2026-04-02 +0800] 小修改（UI）：`debug=1` 时调试面板从左下角悬浮改为挂载在运行面板下方显示。`PlayPage.vue` 将 `DebugPanel` 嵌入中间运行列底部；`DebugPanel.vue` 新增 `embedded` 模式并调整为容器内布局，保留 `debug=1` 显示开关不变。
- [2026-04-02 +0800] 小修改（移动端优化）：针对 `PlayPage.vue` / `StatusPanel.vue` / `ExecutionView.vue` 做一轮移动端密度与触控优化。包括顶部导航触控高度与安全区细调、滚动容器惯性与边界行为优化、状态面板在手机端的卡片间距与字号压缩、库存网格在 900px 下改为双列（480px 以下回退单列）、执行视图卡片与底部状态区间距收敛，整体减少首屏拥挤并提升可读性。
- [2026-04-02 +0800] 小修改（UI）：恢复运行面板中步骤耗时行的居中展示（`ExecutionView.vue` 的 `.exec-step-time` 调整为块级满宽居中），并将建筑维护费金额改为红色强调显示（`BuildingPanel.vue` 新增 `building-maintenance-amount`）。
- [2026-04-02 +0800] 小修改（UI）：运行面板与流程编辑区中的“`xxs/次`”支持点击切换显示“加成后耗时”。`ExecutionView.vue` 与 `FlowEditor.vue` 新增点击切换逻辑，默认显示基础耗时，点击后展示按技能/工具/技术点计算后的实际耗时；`flowStore.ts` 导出 `calcDisplayRecipeTimeSeconds` 供组件复用统一口径。
- [2026-04-02 +0800] 小修改（bugfix/UI）：修复资源面板中金币库存显示出现小数并持续抖动的问题。`StatusPanel.vue` 新增库存格式化口径：金币统一按整数（向下取整）展示，非金币资源保持原有数值显示策略，避免维护费连续扣减带来的小数噪声影响阅读。
- [2026-04-02 +0800] 新增功能（埋点）：补齐前端行为埋点 v1。新增 `src/services/analyticsService.ts`，按会话聚合并本地持久化关键事件与停留时长；已接入欢迎页/游戏页/运行时与核心操作行为，覆盖 `landing_view`、`click_start_game`、`game_enter`、`first_flow_edit`、`run_start`、`resource_blocked`、`tool_upgrade`、`building_unlock`、`order_complete`、`prestige_confirm`，并提供 `getAnalyticsSummary()` 输出开始点击、进入人数、平均停留时长、有效操作人数与漏斗统计口径。
- [2026-04-02 +0800] 小修改（规划）：在 `docs/process/iteration-idea-backlog.md` 新增 IDEA-046「前端埋点与关键行为漏斗」，补充当前版本埋点规划（事件字典、指标口径、实施切片与验收门禁），覆盖 `landing_view`、`click_start_game`、`game_enter`、`first_flow_edit`、`run_start`、`resource_blocked`、`tool_upgrade`、`building_unlock`、`order_complete`、`prestige_confirm` 等核心事件。
- [2026-04-01 +0800] 小修改（UI）：技能卡底部文案从“叠加后总加成”统一调整为“当前总加成”，为后续继续叠加技术点加成保留更稳定的展示口径；本次仅改文案，不改现有计算逻辑。
- [2026-04-01 +0800] 小修改（UI）：`StatusPanel.vue` 的资源库存基础显示顺序移除 `iron_sword`，避免游戏开局在未拥有铁匠铺、铁剑数量也为 0 的情况下提前展示铁剑资源；铁剑改为仅在建筑解锁后或库存实际出现时再显示。
- [2026-04-01 +0800] 小修改（UI）：技能卡口径调整为“上方显示技能自身耗时减免，下方显示叠加工具后的总加成”；`toolStore.ts` 现统一返回已计入工具升级等级的实际倍率，`StatusPanel.vue` / `SkillPanel.vue` 的工具项也改为显示真实的 `-x% 耗时`，为后续继续叠加技术点加成预留统一口径。
- [2026-04-01 +0800] 小修改（UI）：`ToolPanel.vue` 的“加速效果”展示改为同步叠加工具升级等级带来的额外效率，不再固定显示基础值；升级工具后，如铁镐的“开采铁矿”徽标会立即从基础 `-10%` 更新为对应的实际加成数值。
- [2026-04-01 +0800] v0.3.0 计划调整：将 IDEA-042“技术点重开循环”从后置项改为当前版本范围，并在 `docs/versions/v0.3-plan.md` 中补充 Prestige 口径说明；技术点公式定为 `techPointGain = floor(6 * log2(bestStableGps / 5 + 1))`，其中 `bestStableGps` 明确取“当前轮次历史最高稳定收益”而非瞬时显示收益，重生后总技术点与全局效率预览文案要求同步写入。
- [2026-04-01 +0800] v0.3.0 计划续审：将 IDEA-045“导入导出加密存档字符串”评审为 ACCEPTED，并正式纳入 `docs/versions/v0.3-plan.md`；版本主题、In Scope、Phase 2、ITER-034 与门禁要求同步补充存档容灾范围。
- [2026-04-01 +0800] backlog 新增 IDEA-045：补充“导入导出加密存档字符串”需求，用于手动备份、迁移与本地存档丢失兜底，条目已按标准模板写入 `docs/process/iteration-idea-backlog.md`。
- [2026-04-01 +0800] 文档评审：`docs/process/iteration-idea-backlog.md` 按 v0.2 实际交付回填 IDEA-014、IDEA-029 ~ IDEA-037 的状态与已落地产物，并对 IDEA-038 ~ IDEA-044 更新评审结论（ACCEPTED / SPLIT / DEFERRED）；`docs/versions/v0.3-plan.md` 重写为 v0.3.0 审后执行版，收口范围到 runtime 可观测性、收益历史、经济压力 v1、订单增强 v1 与调优脚本。
- [2026-04-01 +0800] 公开发布前整理：新增 `.gitignore`、`.env.example`、`LICENSE_TODO.md`；公共化重写根目录 `README.md`；`scripts/deploy-oss.sh` 改为从 `.env` / `.env.local` 或显式环境变量读取部署目标，不再内置默认 OSS bucket/endpoint，且将 `DELETE_REMOTE` 默认值收紧为关闭。
- [2026-04-01 +0800] 文档分层：`docs/README.md` 新增公开建议；`docs/design/*.md`、`docs/process/*.md`、`docs/prototype/README.md`、`docs/versions/v0.3-plan.md` 增加 `TODO: review before making repo public` 标记；`docs/versions/v0.2-ANNOUNCEMENT.md` 的克隆地址改为占位符；`.vscode/tasks.json` 移除私人部署与固定发布包检查任务，仅保留通用开发/构建/打包任务。

### 新增
- [2026-03-30 +0800] 版本规划：新增 `docs/versions/v0.3-plan.md`，整理 v0.3 候选范围（必选/应选/观察项）、推荐切片（ITER-031 ~ ITER-037）、风险控制与候选门禁。
- [2026-03-30 +0800] 更新根目录 `README.md`：补充"快速开始"命令、新增"v0.2 已实现功能"总表、Roadmap 从 Phase 列表改为版本状态表格（v0.1 ✅ / v0.2 ✅ / v0.3 🔜 / v1.0 💡）。
- [2026-03-30 +0800] 新增 `docs/versions/v0.2-ANNOUNCEMENT.md`：玩家向的简版发布公告，说明各新功能与体验改善要点，附 v0.3 预告。

### 变更
- [2026-03-31 +0800] 新增脚本（部署）：新增 `scripts/deploy-oss.sh` 与 npm 命令 `deploy:oss` / `deploy:oss:no-build`，支持一键构建并发布到阿里云 OSS；脚本使用 `ossutil sync` 完成增量上传与远端清理，并支持 `OSS_BUCKET` / `OSS_ENDPOINT` / `RUN_BUILD` / `DELETE_REMOTE` / `OSS_PREFIX` / `DRY_RUN` 环境变量。
- [2026-03-31 +0800] 新增功能 + 小修改（UI）：(1) **分隔符**：建筑/工具费用展示从"/"改为"+"。(2) **工具升级系统**：`tools.json` 各工具新增 `upgrade` 配置（`maxLevel=5`、`costPerLevel`、`efficiencyPerLevel`）；T1 工具每级提升 1% 效率，T2/T3 提升 2%；`types.ts` 添加 `ToolUpgradeConfig`；`toolStore.ts` 新增 `toolLevels` 状态、`canUpgradeTool`/`upgradeTool`/`restoreToolLevels` 方法；`runtimeEngine.ts` 在计算 timeMultiplier 时叠加升级等级加成；`runtimeTypes.ts` 添加 `toolLevels` 字段；`runtimeStore.ts` 在 `initEngine` 与 `syncPlayerStateFromFlowStore` 时同步 toolLevels 至引擎；`flowStore.ts` 新增 `upgradeTool` action 并在持久化/恢复时携带 toolLevels；`saveService.ts` 新增 `toolLevels` 存档字段；`ToolPanel.vue` 展示升级等级条、消耗与升级按钮。(3) **订单刷新**：活跃订单新增"刷新"按钮（消耗 25 金币），立即生成新订单；`orderStore.ts` 新增 `refreshOrder`，`flowStore.ts` 新增 `refreshOrder`。(4) **删除/丢弃订单需消耗金币**：删除（已过期）/丢弃（活跃）订单各扣 10 金币，不足时提示失败；按钮文案标注费用。
- [2026-03-31 +0800] 小修改（UI）：修复右侧“资源库存”部分卡片在窄宽度下数字与速率文本被遮挡的问题。`StatusPanel.vue` 库存网格改为 `minmax(0, 1fr)`，卡片内容允许换行并自适应字号（`clamp`），在较窄视口下自动切为单列；`PlayPage.vue` 右侧面板补充 `overflow-x: hidden` 防止横向溢出裁切。
- [2026-03-30 +0800] 小修改（UI + 订单）：移除 `PlayPage.vue` 全局悬浮提示，购买建筑/工具与订单提交提示改为显示在对应卡片区下方（建筑区、工具区、订单区）；`flowStore.ts` 统一提示前缀（建筑/工具/订单）并补充订单完成成功提示文案。同步扩展 `ordersTemplate.json`：新增更多订单模板（含铁剑需求订单），并为模板增加 `titlePool`，订单标题改为故事化随机文案；`orderStore.ts` 生成订单时优先使用故事化标题。
- [2026-03-30 +0800] 小修改（bugfix）：修复“完成订单未增加金币”问题。原因是运行中订单奖励先写入 `flowStore.playerState`，随后被 runtime 的定时回写旧状态覆盖。修复：`runtimeStore.ts` 新增 `syncPlayerStateFromFlowStore()`，`flowStore.submitOrder()` 在结算需求/奖励后立即同步引擎库存，确保金币与资源增减即时生效且不会回退。
- [2026-03-30 +0800] 小修改（UI）：`FlowEditor.vue` 新增上下分栏拖拽（split handle），流程步骤区与添加步骤区均改为独立滚动容器；支持动态调整两区高度并设置最小高度约束，避免任一区块被压缩到不可用。
- [2026-03-30 +0800] 小修改（bugfix）：`StatusPanel.vue` 资源库存展示从固定 `RESOURCE_ORDER` 改为动态合并（基础顺序 + 建筑已解锁资源 + 库存已出现资源），修复购买建筑后新解锁资源未显示的问题（即使当前数量为 0 也展示）。
- [2026-03-30 +0800] 小修改（UI）：`FlowEditor.vue` 流程步骤区补充滚动约束（`min-height: 0` + `step-card` 禁止压缩），修复步骤过多时卡片被挤压问题；同时将“添加步骤 + 自动运行状态”收口为底部固定操作区，长流程滚动时顶部模板区和底部操作区保持可用。
- [2026-03-30 +0800] 文档同步：`docs/versions/v0.2-plan.md` 回填 v0.2 实际执行结果（ITER-022 ~ ITER-029 标记 DONE，ITER-030 标记 DEFERRED），新增 `docs/versions/v0.2-RELEASE.md` 发布说明与门禁结论。
- [2026-03-30 +0800] 小修改（UI）：① `BuildingPanel.vue` / `ToolPanel.vue` 清理亮色降级变量，统一改用暗色主题已有变量（按钮、标签、已购态卡片），修复未购/已购卡片与按钮在暗色主题下发白、发灰、文字难以辨认的问题；② `ExecutionView.vue` / `FlowEditor.vue` 统一进度条主色为 `indigo`，并将 `< 1s` 快速配方进度条改为“整条填满 + 流动高光”样式；③ `PlayPage.vue` 新增居中的全局浮层消息，`flowStore.ts` 购买工具成功提示 2.5s 后自动消失；④ 同步刷新 `dist/` 构建产物。
- [2026-03-30 +0800] 小修改（bugfix + UI）：① `buildingStore.ts` / `toolStore.ts` 修复 reason 文本中资源 ID 未本地化问题（如 `iron_ingot 不足` → `铁锭 不足`），改为使用 `gameConfig.resources?.[id]?.name`；② `BuildingPanel.vue` 修复未购建筑卡片 `building-disabled(0.5)` 与按钮 `:disabled(0.5)` 叠加导致按钮近乎不可见（合成约 0.25 透明度）的问题，改为卡片 opacity 0.65，移除按钮额外 opacity；③ `StatusPanel.vue` 订单模块默认改为展开（`ref(false)` → `ref(true)`）并统一标题为 `div.section-header`，移除残留 `button` 包裹。— commit c87bf29
- [2026-03-31 +0800] 修复（clonePlayerState 崩溃 + 工具效果不生效）：`clonePlayerState` 对 JSON 反序列化的 `purchasedTools: {}` 调用 `new Set({})` 抛出 `TypeError: object is not iterable`；同时 `initToolsFromSnapshot` 只写 `toolStore` 未回写 `playerState.purchasedTools`，导致 runtimeEngine 运行时读不到工具，工具加速不生效。修复：① `clonePlayerState` 加 `instanceof Set / Array.isArray` 三路判断，降级为空 Set 而非崩溃；② `initToolsFromSnapshot` 在写 `toolStore` 后同步赋值 `playerState.purchasedTools`；③ `purchaseTool` 成功后同步 `playerState.purchasedTools.add(toolId)`。
`purchasedTools: Set<string>` 经 `JSON.parse(JSON.stringify(...))` 序列化后变为普通对象 `{}`，导致 `runtimeEngine.ts` 里 `calcActualStepTime` 对其 `for...of` 迭代时抛出 `TypeError: {} is not iterable`，引擎 RAF 链在第一帧即断裂，而 `runtimeStore.status` 已被设为 `"running"` 故 UI 持续显示"运行中"但引擎实际死亡。修复：`flowStore.ts` 中 `clonePlayerState` 改为 `export`；`runtimeStore.ts` 的 `initEngine` / `_syncFlowToEngine` / `_syncPlayerStateBack` 三处均改用 `clonePlayerState`（正确重建 Set）替代 `JSON.parse(JSON.stringify(...))`；`runtimeEngine.ts` `calcActualStepTime` 增加 `instanceof Set` 安全守卫。
- [2026-03-31 +0800] 小修改（UX）：`FlowEditor.vue` 步骤卡片移除冗余的配方 `<select>` 下拉框（配方已通过左侧徽标展示，新增步骤通过底部增加按钮操作），同步删除 `onRecipeChange` 函数。
- [2026-03-31 +0800] 小修改（UX）：`FlowEditor.vue` 离线收益提示改为全屏遮罩弹窗（`showOfflineModal` ref + `onMounted` 触发），含"确认"按钮关闭，替换原有黄色横幅。
- [2026-03-31 +0800] 小修改（bugfix）：`StatusPanel.vue` CSS `.skill-total-bonus` 缺少闭合 `}`，导致 Sass 编译报 unclosed block 错误，已补全。
- [2026-03-31 +0800] 小修改（bugfix）：`src/core/simulator.ts` 移除遗留的 `upgradeMultiplier` 循环（引用已删除的 `config.upgrades`），消除运行时 `Cannot convert undefined or null to object` 崩溃。
- [2026-03-31 +0800] **ITER-029** 流程模板（v0.2 Phase 5）：新建 `src/stores/flowTemplateStore.ts`（最多 5 套模板、localStorage 持久化、saveTemplate/deleteTemplate/getTemplate）；`flowStore` 新增 `replaceSteps()` action；`FlowEditor.vue` 头部新增模板栏（下拉选择、载入、删除、行内命名保存、x/5 容量提示）。类型检查通过。
- [2026-03-31 +0800] 小修改（bugfix）：`StatusPanel.vue` CSS 区块中游离的 `margin-bottom: 6px; }` 导致 Unexpected } 编译错误，已删除。 动态订单系统（v0.2 Phase 4）：新建 `src/stores/orderStore.ts`（3 插槽、加权随机生成、有效期倒计时、Submit→10s / Delete→120s / Expire→30s 冷却）；`types.ts` 新增 OrderTemplate / ActiveOrder 接口；`saveService.ts` 新增 OrderSlotSnapshot，SaveSnapshot 添加 orderSlots?；`flowStore.ts` 移除静态订单体系（ordersArray、orderItems getter、旧 submitOrder、completedOrderIds），接入 orderStore 的 submitOrder / deleteOrder / initOrdersFromSnapshot；`StatusPanel.vue` 订单区重写为三槽位卡片 UI（稀有度徽标、需求/奖励/倒计时、提交+丢弃）；`App.vue` 补齐 initBuildingsFromSnapshot / initToolsFromSnapshot / initOrdersFromSnapshot / orderStore.startTick() 调用（顺带修复刷新后建筑/工具状态丢失的存量 bug）。类型检查通过。
- [2026-03-30 +0800] **ITER-026** 工具 UI 面板（v0.2 Phase 3）：新建 `ToolPanel.vue`，展示工具 tier 徽标、费用、加速效果（配方名 + 速度百分比）、已购状态及购买按钮；`StatusPanel.vue` 集成 ToolPanel；修复 `runtimeEngine.ts` 中残留的 `upgradeMultiplier` 循环（config.upgrades 已删除，运行时 crash 修复），改写为工具倍率逻辑（遍历 purchasedTools 取最高 tier）；修复 `tools.json` `iron_pickaxe.cost` 字段。类型检查通过。
- [2026-03-30 +0800] 小修改：`src/config/tools.json` 补全 `iron_pickaxe.cost` 字段（`iron_ingot: 10`），原字段缺失导致铁镐无法正常被购买逻辑识别。
- [2026-03-30 +0800] **ITER-024** 建筑 UI 面板（v0.2 Phase 2）：新建 `BuildingPanel.vue`，展示建筑列表、费用验证、购买交互、解锁内容标签；`StatusPanel.vue` 集成 BuildingPanel，移除升级系统 UI 与 upgradeMultiplier 残留逻辑，技能卡片扩展工具信息与综合效率加成显示；`SkillPanel.vue` 更新为使用 skillBonusPercent / applicableTools / combinedBonusPercent；CSS 移除升级系统样式，新增工具信息样式类。类型检查通过。
- [2026-03-30 +0800] **v0.2 Tool System** 工具系统完整实现：新建 `src/stores/toolStore.ts` Pinia Store，implements 工具购买与状态管理；`ToolConfig` interface 添加可选 `tier` 字段（用于同配方多工具时选取最高级别）；`PlayerState` 新增 `purchasedTools?: Set<string>` 字段，`SaveSnapshot` 新增 `purchasedToolIds?: string[]` 字段；`calcDisplayRecipeTimeSeconds` 更新为计算技能 + 工具的叠加加速（只取最高 tier 工具）；`flowStore` 添加 `purchaseTool / initToolsFromSnapshot / clearPurchasedTools` actions，`persistState` 同步保存已购工具ID；`SkillPanel.vue` 扩展显示该技能对应配方的适配工具及总体效率加成。类型检查通过。
- [2026-03-30 +0800] **v0.2 Cleanup** 清理升级系统（v0.1 金币消耗制被工具系统替代）：删除 `src/config/upgrades.json`、`src/core/upgradeSystem.ts`；`src/core/types.ts` 删除 UpgradeConfig / UpgradeState / UpgradeTargetType 接口，PlayerState 移除 upgrades 字段，GameConfig 移除 upgrades 字段；`src/stores/flowStore.ts` 移除 upgradesArray 导入、UpgradeComparisonView 接口、calcDisplayRecipeTimeSeconds 中升级加速逻辑、buildGameConfig 中 upgrades 配置、buildInitialPlayerState 中升级初始化、upgradeItems getter、buyUpgrade / previewUpgradeComparison action；删除 `src/components/UpgradePanel.vue` 组件；clonePlayerState 函数简化为仅包含 inventory / skills。类型检查通过。
- [2026-03-30 +0800] **ITER-023** 建筑 Store + 引擎接入（v0.2 Phase 2）：新建 `src/stores/buildingStore.ts` Pinia Store，实现购买建筑、解锁配方/资源的状态管理；`SaveSnapshot` 新增 `purchasedBuildingIds?` 字段；`flowStore` 集成建筑状态的恢复与保存，`recipeOptions` getter 扩展为检查配方的 enabled 状态与建筑解锁双重条件；新增 `purchaseBuilding / initBuildingsFromSnapshot / clearPurchasedBuildings` 三个 action。类型检查通过。
- [2026-03-30 +0800] **ITER-022** 数据层扩展（v0.2 Phase 1）：`src/core/types.ts` 新增 BuildingConfig / ToolConfig / BuildingUnlock / ToolEffect 接口；GameConfig 新增可选字段 `buildings?` 和 `tools?`。`src/stores/flowStore.ts` 导入 buildings.json / tools.json / sells.json，buildGameConfig 函数合并 sells 配方数组到 recipes 列表，配置文件格式转换为统一的 Record<string, Config> 供 GameConfig 使用。类型检查通过。
- [2026-03-30 +0800] 版本规划：新建 `docs/versions/v0.2-plan.md`，规划 v0.2 版本（建筑解锁系统 + 工具链系统 + 动态订单系统 + 数据层扩展），包含 ITER-022～ITER-030（含可选 Phase 5）。
- [2026-03-30 +0800] 版本收口：`docs/versions/v0.1-plan.md` 文档状态更新为 Released；ITER 表新增状态列（全量 DONE）；结尾追加完结说明，记录实际交付物与计划外新增的配置文件。
- [2026-03-30 +0800] 小修改：`docs/process/iteration-idea-backlog.md` 中 IDEA-016 状态从 NEW 更新为 DONE（全部子任务 IDEA-017~028 均已落地）。
- [2026-03-30 +0800] 小修改（bugfix）：`src/config/buildings.json` 修复 `coal_mine.unlock.resources` 字段错误（`copper_ore` → `coal_ore`），煤矿井现在正确解锁煤矿资源。
- [2026-03-30 +0800] 小修改（bugfix）：`src/config/tools.json` 修复 `steel_anvil.effects` 配方 ID 错误（`forge_sword` → `craft_iron_sword`），钢铁锻造台加速效果现在正确指向铁剑锻造配方。
- [2026-03-30 20:10 +0800] 小修改：修复流程进度条起点非零、进度异常（不到头就重置）的问题。根因：`runtimeStore._onEngineTick` 用 `recipe.timeSeconds * 1000` 作进度条总时长，未计入技能/升级加速，导致实际耗时与总时长不匹配；0 秒步骤（如出售）更因总时长为 0 而进度条完全失效。修复方案：在 `RuntimeState` 新增 `currentRepeatTotalMs` 字段，由引擎 `advanceStep` 在每次 repeat 开始时直接写入含加速的精确耗时，store 改为直接读取该值，消除重算偏差。
- [2026-03-30 19:35 +0800] 小修改：修复刷新后先进入“资源不足待机”的体验问题。`App.vue` 在 `initEngine()` 后立即调用 `runtimeStore.start()`，页面刷新时自动从第一个流程步骤继续运行（有步骤时），避免停留在误导性待机提示。
- [2026-03-30 19:20 +0800] 小修改：修复“整体暂停”下编辑流程会自动恢复运行的问题。`runtimeStore.ts` 中 `notifyFlowChanged()` 调整为在 `paused` 状态与 `running` 一样写入 `pendingFlow`，不触发自动 `start()`，确保页面暂停后保持整体静止，点击“整体继续”后再统一恢复。
- [2026-03-30 19:05 +0800] 小修改：配方展示区域整合。`FlowEditor.vue` 移除独立“配方速览”大区，将配方详情（消耗/产出/卖价）整合到“添加步骤”按钮的悬停提示中，减少占位并保留快速查看能力。
- [2026-03-30 18:50 +0800] 小修改：流程编辑区新增“配方速览”面板。`FlowEditor.vue` 在添加步骤区下方增加配方卡片列表，支持鼠标悬停显示配方详情（消耗、产出、卖价），用于快速查阅配方信息。
- [2026-03-30 18:35 +0800] 小修改：流程编辑区“添加步骤”区域重构为三类分组展示。`FlowEditor.vue` 按配方类别拆分为「采集 / 加工 / 出售」三个按钮组，保留原有新增步骤行为并优化分组层次，提升快速组流程效率。
- [2026-03-30 18:20 +0800] 小修改：收益展示口径统一为“流程理论值（无 0.1s 下限）”。新增 `flowStore.displayGps`，中间执行区实时收益与右侧金币 `(+x/s)` 统一改为该值；`StatusPanel.vue` 的流程时间估算也移除 `0.1s` 下限，修复“4 秒产出 8 金币应显示 2.00 G/s”场景下的展示偏差。
- [2026-03-30 18:05 +0800] 小修改：修复“金币库存变化”与“实时收益”不一致。`StatusPanel.vue` 在运行/暂停状态下将金币速率改为直接使用引擎 `runtimeStore.gps`（与中间实时收益同源），并收紧整数取整阈值，避免 `1.99` 被显示成 `2/s`。
- [2026-03-30 17:55 +0800] 小修改：debug 暂停改为“页面整体暂停/继续”。`ExecutionView.vue` 将 debug 按钮从“暂停显示”调整为调用 `runtimeStore.pause/resume` 的全局运行控制，暂停后整页状态统一静止；`FlowEditor.vue` 同步支持 paused 状态展示（步骤高亮/进度条保留、状态文案显示“已暂停（页面整体）”），继续后整体恢复。
- [2026-03-30 17:45 +0800] 小修改：库存变化口径改为“整流程平均速率”。`StatusPanel.vue` 不再按实时采样计算 `+-xxx/s`，改为基于当前完整流程的总净产出/总耗时计算理论平均值；资源只要参与了当前流程就显示速率，净变化为 0 也显示 `0/s`（如“两次采矿 + 一次熔炼”下铁矿显示 `0/s`、铁锭显示 `+1/s`，未参与资源不显示）。
- [2026-03-30 17:35 +0800] 小修改：执行区 debug 行新增“暂停显示/继续显示”按钮。`ExecutionView.vue` 增加展示快照冻结机制，点击“暂停显示”后中间执行区当前状态（步骤、进度、收益、状态、循环数）保持不变，便于演示截图；再次点击恢复实时显示，不影响引擎实际运行。
- [2026-03-30 17:20 +0800] 小修改：库存变化速率改为整秒窗口统计并做整数优先显示。`StatusPanel.vue` 由短周期平滑改为 1 秒统计窗口，`+-xxx/s` 在接近整数时按整数展示（如采矿稳定显示 `+1/s`），减少非必要小数显示。
- [2026-03-30 17:10 +0800] 小修改：中间执行区“当前步骤”卡片新增配方明细展示。`ExecutionView.vue` 增加当前步骤的“消耗/产出”行，按配方实时显示资源与数量（如采矿显示产出铁矿、熔炼显示消耗铁矿并产出铁锭），支持多资源项并沿用暗色主题样式。
- [2026-03-30 17:00 +0800] 小修改：库存变化速率显示防闪烁优化。`StatusPanel.vue` 将库存 `+-xxx/s` 从逐帧瞬时计算改为固定采样窗口（400ms）+ 平滑（EMA）+ 显隐阈值（hysteresis），并将显示精度调整为 1 位小数，减少 `1/s` 抖动与闪烁。
- [2026-03-30 16:50 +0800] 小修改：清档与库存反馈优化。`flowStore.ts` 调整初始化策略，清空存档后不再注入默认步骤，左侧流程编辑区保持空流程；`StatusPanel.vue` 在库存数字旁新增变化速率显示（仅变化时显示 `+-xxx/s`）；`runtimeEngine.ts` 在输入资源扣减处增加非负保护，确保库存不会出现负数，并继续在资源不足时阻止对应步骤执行（如铁矿为 0 时熔炼不会执行）。
- [2026-03-30 16:35 +0800] 小修改：循环计数口径与调试入口优化。`runtimeEngine.ts` 调整 `loopCount` 计算，仅在完整跑完一轮流程时 +1（修正 pendingFlow 切换场景的误计数）；`ExecutionView.vue` 在中部执行区下方新增 debug 行与“清空存档”按钮（调用 `clearSaveSnapshot` 并刷新页面），用于快速回归测试；同时将待机文案更新为“添加步骤后将自动运行”。
- [2026-03-30 16:20 +0800] 运行控制小修改：流程编辑改为自动运行模式。`FlowEditor.vue` 移除手动「开始/暂停/停止」按钮，新增自动运行状态提示；`runtimeStore.ts` 在 `notifyFlowChanged()` 中实现“有步骤即自动启动、空流程即停机”；`runtimeEngine.ts` 新增输入资源校验，当前步骤资源不足时自动停机。行为口径：系统不再依赖手动暂停/停止，只有流程为空或资源不足时停机。
- [2026-03-30 16:00 +0800] 运行时特性优化：① 流程步骤修改实时生效（步骤边界连续）——修改 `runtimeEngine.ts` `advanceStep()`，pendingFlow 生效时不再重置 stepIndex 为 0，而是沿用 "当前步 +1" 的下一步逻辑，实现添加/删除步骤后在当前步运行完毕时立即感知变更，不等整个 loop 结束；② GPS 改用静态公式——删除 5 秒滑动窗口（`GPS_WINDOW_MS`），新增 `calcStaticGps()` 函数（总流程金币产出 / 总流程耗时，含技能/升级加速），在每帧 tick 中实时更新 `state.gps`，GPS 展示即时、稳定，不受滑动窗口冷启动延迟影响。
- [2026-03-30 14:30 +0800] UI 对齐原型（IDEA-028）：参照 `docs/prototype` 暗色视觉稿，将工程界面从亮色单列布局重构为三列全屏暗色布局。具体改动：① `style.css` 替换为暗色 CSS 变量体系；② `App.vue` 改为三列 flex 布局（流程编辑区 | 执行视图 | 状态面板）；③ `FlowEditor.vue` 重写为暗色卡片式步骤列表，内嵌运行控制按钮；④ 新建 `ExecutionView.vue`（实时执行中区，含收益/进度/装饰动画）；⑤ 新建 `StatusPanel.vue`（右侧整合库存/技能/升级/订单四区）。技术栈不变：Vue 3 + Pinia + 原生 CSS，无新增依赖。
- [YYYY-MM-DD HH:mm +0800] 在此记录本轮文档结构、流程口径、模板引用路径等调整。
- [2026-03-30 09:45 +0800] 小修改：在迭代想法池新增 IDEA-028（基于 prototype 原型优化工程 UI），用于承接原型到工程界面的对齐落地。
- [2026-03-30 09:35 +0800] 小修改：在迭代想法池新增 IDEA-017 至 IDEA-027（runtime 拆分方案），用于承接 IDEA-016 的执行拆分。
- [2026-03-30 09:20 +0800] 小修改：在迭代想法池新增 IDEA-016（实时运行态与动态资源反馈），并更新 backlog 文档日期。
- [2026-03-30 12:00 +0800] ITER-021：新建 `src/style.css`（全局主题变量 + reset + 组件基础样式），修改 main.ts 引入、App.vue 增加 header 布局；CSS 参考 prototype theme.css 语义设计。
- [2026-03-30 11:30 +0800] ITER-019/020：修改 App.vue（initEngine）、FlowEditor.vue（运行控制按键、步骤高亮、进度条）、runtimeStore（liveInventory）、SimResultPanel（实时 GPS 摘要、实时库存展示）；构建通过（51 modules）。
- [2026-03-30 11:00 +0800] ITER-018：新建 `src/stores/runtimeStore.ts`，建立 RuntimeStore Pinia 层，实现 initEngine/start/pause/resume/stop/notifyFlowChanged/notifyConfigChanged 控制接口，每帧将引擎状态投影到 Vue 响应式字段。
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
