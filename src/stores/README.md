# stores/
#
# Pinia store 层：负责协调 core 层与 UI 层之间的状态管理。
# 架构约束：
#   - store 调用 core 层函数，不自行实现重数值逻辑
#   - 组件只读取 store 暴露的 state / getters，不直接访问 core
#
# 后续迭代规划：
#   - gameStore.ts   — 玩家状态（库存、技能、升级）
#   - flowStore.ts   — 当前流程定义与模拟结果
#   - configStore.ts — 加载 JSON 配置，提供 GameConfig
