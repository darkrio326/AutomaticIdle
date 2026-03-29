# components/
#
# Vue 单文件组件层：只负责展示与用户交互，不直接调用 core 层。
# 架构约束：
#   - 从 store 读取数据，通过 store action 触发逻辑
#   - 不在组件内写业务计算，只做渲染与事件派发
#
# 后续迭代规划：
#   - FlowEditor.vue     — 列表式流程编辑器（IDEA-006）
#   - SimResultPanel.vue — 模拟结果展示面板（IDEA-007）
#   - UpgradePanel.vue   — 升级列表与购买交互（IDEA-009）
#   - InventoryPanel.vue — 资源库存展示（IDEA-008）
