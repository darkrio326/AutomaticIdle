# 模拟器设计

## 1. 模拟器职责

模拟器只负责：

- 读取流程定义
- 根据玩家状态和配置执行步骤
- 计算耗时、资源变化、经验变化、收益
- 返回稳定的结果对象

模拟器不负责：

- UI 展示
- 存档
- 动画
- 订单提交
- 升级购买

## 2. 模拟器输入

```typescript
simulateFlow(
  flow: FlowDefinition,
  playerState: PlayerState,
  config: GameConfig
): SimulationResult
```

其中 `GameConfig` 可以理解为所有配置文件加载后的聚合对象。

```typescript
export interface GameConfig {
  resources: Record<string, ResourceConfig>;
  recipes: Record<string, RecipeConfig>;
  skills: Record<string, SkillConfig>;
  upgrades: Record<string, UpgradeConfig>;
  orders: Record<string, OrderConfig>;
}
```

## 3. 模拟器输出

必须固定返回：

- 总耗时
- 总金币收益
- 每秒金币
- 每步结果
- 资源变化
- 经验变化
- 瓶颈步骤

## 4. 执行顺序

### 单轮执行逻辑

```text
for 每个流程步骤:
  取到 recipe
  重复执行 repeat 次:
    1. 校验技能等级要求
    2. 校验输入资源是否足够
    3. 计算当前实际耗时
    4. 扣除输入资源
    5. 增加输出资源
    6. 增加经验
    7. 记录步骤结果
```

## 5. 时间计算规则

### 基础公式

```text
finalTime = baseTime × skillMultiplier × upgradeMultiplier
```

其中：

```text
skillMultiplier = 1 - ((skillLevel - 1) × timeReductionPerLevel)
upgradeMultiplier = 1 - (upgradeLevel × effectPerLevel)
```

为了避免时间变成负数，需要加下限：

```text
finalTime = max(0.1, finalTime)
```

## 6. EXP 升级规则

每个动作执行后立即增加 EXP。模拟器第一版可以只统计 `expDelta`，不在单轮中实时升级。这样简单很多。

也就是说：

- 第一版模拟器只算"本轮获得多少经验"
- 等真正接入游戏状态时，再在外层统一结算升级

这是一个很重要的简化。

## 7. 瓶颈定义

第一版建议最简单：

> 总耗时最高的 recipe，就是瓶颈步骤

也就是遍历 `stepResults`，找 `totalTime` 最大的那个。

## 8. MVP 约束

第一版模拟器明确不做：

- 并行执行
- 条件分支
- 随机暴击
- 随机掉落
- 中途升级重新计算
- 订单自动插入流程
