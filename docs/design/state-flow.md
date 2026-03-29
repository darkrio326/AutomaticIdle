# 状态流设计

## 单向数据流

```text
用户修改流程
→ FlowStore 更新
→ 调用 simulator
→ 产出 SimulationResult
→ 页面展示结果
```

## 运行时状态分层

### 配置层

- resources
- recipes
- skills
- upgrades
- orders

### 玩家状态层

- inventory
- skills
- upgrades
- activeFlow

### 计算结果层

- simulationResult
- bottleneck
- gps

## 约束

- 组件不直接计算流程结果
- 组件不直接修改配置
- 模拟器只接收输入并返回结果，不写 store
- store 负责协调，不负责重数值计算
