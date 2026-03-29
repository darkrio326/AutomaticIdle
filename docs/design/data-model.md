# 数据模型设计

把设计草案里的抽象概念，变成稳定的配置结构。

## 1. resources.json

定义资源本身，不带玩法逻辑。

### 字段建议

- id：唯一标识
- name：显示名
- type：currency | raw | intermediate | product
- sellPrice：默认卖价，没有价值 = 0，-1 表示不可卖
- description：可选

### 示例

```json
[
  {
    "id": "gold",
    "name": "金币",
    "type": "currency",
    "sellPrice": -1,
    "description": "通用货币"
  },
  {
    "id": "iron_ore",
    "name": "铁矿",
    "type": "raw",
    "sellPrice": 1,
    "description": "基础矿物原料"
  },
  {
    "id": "iron_ingot",
    "name": "铁锭",
    "type": "intermediate",
    "sellPrice": 8,
    "description": "由铁矿熔炼而成"
  },
  {
    "id": "iron_sword",
    "name": "铁剑",
    "type": "product",
    "sellPrice": 100,
    "description": "基础成品武器"
  }
]
```

## 2. recipes.json

定义动作和配方。这是最核心的配置文件。

### 字段建议

- id
- name
- category：gather | craft | sell
- timeSeconds
- inputs
- outputs
- expGains
- requiredSkillId：可选
- requiredSkillLevel：可选
- enabled：可选，方便后面解锁

### 示例

```json
[
  {
    "id": "mine_iron",
    "name": "采矿",
    "category": "gather",
    "timeSeconds": 1,
    "inputs": [],
    "outputs": [
      { "resourceId": "iron_ore", "amount": 1 }
    ],
    "expGains": [
      { "skillId": "mining", "amount": 1 }
    ],
    "enabled": true
  },
  {
    "id": "smelt_iron",
    "name": "熔炼铁锭",
    "category": "craft",
    "timeSeconds": 2,
    "inputs": [
      { "resourceId": "iron_ore", "amount": 2 }
    ],
    "outputs": [
      { "resourceId": "iron_ingot", "amount": 1 }
    ],
    "expGains": [
      { "skillId": "smelting", "amount": 2 }
    ],
    "requiredSkillId": "smelting",
    "requiredSkillLevel": 1,
    "enabled": true
  },
  {
    "id": "craft_iron_sword",
    "name": "锻造铁剑",
    "category": "craft",
    "timeSeconds": 4,
    "inputs": [
      { "resourceId": "iron_ingot", "amount": 5 }
    ],
    "outputs": [
      { "resourceId": "iron_sword", "amount": 1 }
    ],
    "expGains": [
      { "skillId": "smithing", "amount": 5 }
    ],
    "requiredSkillId": "smithing",
    "requiredSkillLevel": 1,
    "enabled": true
  },
  {
    "id": "sell_iron_ingot",
    "name": "出售铁锭",
    "category": "sell",
    "timeSeconds": 0,
    "inputs": [
      { "resourceId": "iron_ingot", "amount": 1 }
    ],
    "outputs": [
      { "resourceId": "gold", "amount": 8 }
    ],
    "expGains": [],
    "enabled": true
  },
  {
    "id": "sell_iron_sword",
    "name": "出售铁剑",
    "category": "sell",
    "timeSeconds": 0,
    "inputs": [
      { "resourceId": "iron_sword", "amount": 1 }
    ],
    "outputs": [
      { "resourceId": "gold", "amount": 100 }
    ],
    "expGains": [],
    "enabled": true
  }
]
```

## 3. skills.json

定义技能成长规则。

### 字段建议

- id
- name
- baseLevel
- expFormula
- timeReductionPerLevel
- maxLevel

为了第一版简单，建议先不要把公式写成字符串解释器。先固定一套公式，配置只放参数。

### 示例

```json
[
  {
    "id": "mining",
    "name": "采矿",
    "baseLevel": 1,
    "timeReductionPerLevel": 0.02,
    "maxLevel": 50,
    "expFormula": {
      "base": 10,
      "exponent": 1.5
    }
  },
  {
    "id": "smelting",
    "name": "熔炼",
    "baseLevel": 1,
    "timeReductionPerLevel": 0.02,
    "maxLevel": 50,
    "expFormula": {
      "base": 10,
      "exponent": 1.5
    }
  },
  {
    "id": "smithing",
    "name": "锻造",
    "baseLevel": 1,
    "timeReductionPerLevel": 0.02,
    "maxLevel": 50,
    "expFormula": {
      "base": 10,
      "exponent": 1.5
    }
  }
]
```

## 4. upgrades.json

定义金币/材料升级。

### 字段建议

- id
- name
- targetType：recipe_time | sell_bonus | unlock
- targetId
- maxLevel
- costs
- effectPerLevel
- requiredSkillId：可选
- requiredSkillLevel：可选

### 示例

```json
[
  {
    "id": "upgrade_mining_speed",
    "name": "矿镐升级",
    "targetType": "recipe_time",
    "targetId": "mine_iron",
    "maxLevel": 10,
    "costs": [
      { "resourceId": "gold", "amount": 200 }
    ],
    "effectPerLevel": 0.1
  },
  {
    "id": "upgrade_smelting_speed",
    "name": "熔炉升级",
    "targetType": "recipe_time",
    "targetId": "smelt_iron",
    "maxLevel": 10,
    "costs": [
      { "resourceId": "gold", "amount": 300 },
      { "resourceId": "iron_ingot", "amount": 5 }
    ],
    "effectPerLevel": 0.15
  },
  {
    "id": "upgrade_smithing_speed",
    "name": "锻造台升级",
    "targetType": "recipe_time",
    "targetId": "craft_iron_sword",
    "maxLevel": 10,
    "costs": [
      { "resourceId": "gold", "amount": 500 },
      { "resourceId": "iron_sword", "amount": 1 }
    ],
    "effectPerLevel": 0.12
  }
]
```

## 5. orders.json

定义订单目标和奖励。

### 字段建议

- id
- name
- requirements
- rewards
- unlocks
- enabled

### 示例

```json
[
  {
    "id": "order_ingot_01",
    "name": "给铁匠铺的铁锭订单",
    "requirements": [
      { "resourceId": "iron_ingot", "amount": 10 }
    ],
    "unlocks": [
      { "type": "recipe", "id": "craft_iron_sword" }
    ],
    "enabled": true
  },
  {
    "id": "order_sword_01",
    "name": "迈尔斯想要一只铁剑",
    "requirements": [
      { "resourceId": "iron_sword", "amount": 2 }
    ],
    "rewards": [
      { "resourceId": "gold", "amount": 500 }
    ],
    "enabled": true
  }
]
```