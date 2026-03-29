import type {
  FlowDefinition,
  PlayerState,
  GameConfig,
  SimulationResult,
  SimulationStepResult,
} from './types';

function addDelta(record: Record<string, number>, key: string, amount: number): void {
  record[key] = (record[key] ?? 0) + amount;
}

export function simulateFlow(
  flow: FlowDefinition,
  playerState: PlayerState,
  config: GameConfig,
): SimulationResult {
  const resourceDelta: Record<string, number> = {};
  const expDelta: Record<string, number> = {};
  const stepResults: SimulationStepResult[] = [];

  for (const step of flow.steps) {
    const recipe = config.recipes[step.recipeId];
    if (!recipe) {
      throw new Error(`Recipe not found: ${step.recipeId}`);
    }

    // 技能等级要求校验
    if (recipe.requiredSkillId != null && recipe.requiredSkillLevel != null) {
      const skillState = playerState.skills[recipe.requiredSkillId];
      const currentLevel = skillState?.level ?? 0;
      if (currentLevel < recipe.requiredSkillLevel) {
        throw new Error(
          `技能等级不足：${recipe.id} 需要 ${recipe.requiredSkillId} Lv${recipe.requiredSkillLevel}，当前 Lv${currentLevel}`,
        );
      }
    }

    // 技能加速倍率：skillMultiplier = 1 - (level - 1) × timeReductionPerLevel
    let skillMultiplier = 1;
    if (recipe.requiredSkillId != null) {
      const skillConfig = config.skills[recipe.requiredSkillId];
      const skillState = playerState.skills[recipe.requiredSkillId];
      if (skillConfig != null && skillState != null) {
        skillMultiplier = 1 - (skillState.level - 1) * skillConfig.timeReductionPerLevel;
      }
    }

    // 升级加速倍率：遍历所有 recipe_time 升级，找目标为本 recipe 的条目
    let upgradeMultiplier = 1;
    for (const upgradeConfig of Object.values(config.upgrades)) {
      if (upgradeConfig.targetType === 'recipe_time' && upgradeConfig.targetId === recipe.id) {
        const upgradeState = playerState.upgrades[upgradeConfig.id];
        if (upgradeState != null && upgradeState.level > 0) {
          upgradeMultiplier *= 1 - upgradeState.level * upgradeConfig.effectPerLevel;
        }
      }
    }

    // finalTime = max(0.1, baseTime × skillMultiplier × upgradeMultiplier)
    const singleTime = Math.max(0.1, recipe.timeSeconds * skillMultiplier * upgradeMultiplier);
    const stepTotalTime = singleTime * step.repeat;

    const stepResourceDelta: Record<string, number> = {};
    const stepExpDelta: Record<string, number> = {};

    for (let i = 0; i < step.repeat; i++) {
      for (const input of recipe.inputs) {
        addDelta(stepResourceDelta, input.resourceId, -input.amount);
      }
      for (const output of recipe.outputs) {
        addDelta(stepResourceDelta, output.resourceId, output.amount);
      }
      for (const gain of recipe.expGains) {
        addDelta(stepExpDelta, gain.skillId, gain.amount);
      }
    }

    for (const [k, v] of Object.entries(stepResourceDelta)) {
      addDelta(resourceDelta, k, v);
    }
    for (const [k, v] of Object.entries(stepExpDelta)) {
      addDelta(expDelta, k, v);
    }

    stepResults.push({
      recipeId: recipe.id,
      totalExecutions: step.repeat,
      totalTime: stepTotalTime,
      resourceDelta: stepResourceDelta,
      expDelta: stepExpDelta,
    });
  }

  const totalTime = stepResults.reduce((sum, s) => sum + s.totalTime, 0);

  // 金币收益 = 所有 currency 类资源的正向净变化之和
  let totalGoldGained = 0;
  for (const [resourceId, delta] of Object.entries(resourceDelta)) {
    const resourceConfig = config.resources[resourceId];
    if (resourceConfig?.type === 'currency' && delta > 0) {
      totalGoldGained += delta;
    }
  }

  const goldPerSecond = totalTime > 0 ? totalGoldGained / totalTime : 0;

  // 最终库存 = 初始库存 + 本轮资源净变化
  const finalInventory: Record<string, number> = { ...playerState.inventory };
  for (const [resourceId, delta] of Object.entries(resourceDelta)) {
    finalInventory[resourceId] = (finalInventory[resourceId] ?? 0) + delta;
  }

  // 瓶颈步骤 = totalTime 最大的步骤
  let bottleneckRecipeId: string | undefined;
  let maxStepTime = 0;
  for (const s of stepResults) {
    if (s.totalTime > maxStepTime) {
      maxStepTime = s.totalTime;
      bottleneckRecipeId = s.recipeId;
    }
  }

  return {
    totalTime,
    totalGoldGained,
    goldPerSecond,
    finalInventory,
    resourceDelta,
    expDelta,
    stepResults,
    bottleneckRecipeId,
  };
}
