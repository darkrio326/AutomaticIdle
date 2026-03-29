# services/
#
# 服务层：负责副作用操作（JSON 配置加载、localStorage 存档读写等）。
# 架构约束：
#   - 不包含业务逻辑，只做 IO 封装
#   - core 层不依赖此目录
#
# 后续迭代规划：
#   - configLoader.ts — 从 src/config/*.json 组装 GameConfig
#   - saveService.ts  — localStorage 存档的读写与版本迁移
