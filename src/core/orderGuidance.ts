import type { ActiveOrder, GameConfig, OrderTemplate, RecipeConfig } from './types';

export interface OrderContext {
  inventory: Record<string, number>;
  flowOutputIds: Set<string>;
  enabledRecipes: RecipeConfig[];
}

export interface OrderGuidanceView {
  tone: 'ready' | 'flow' | 'suggestion' | 'locked';
  text: string;
  isHighValue: boolean;
  rewardMultiple: number;
  valueLabel: string;
}

function dedupeChain(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function findRecipeChain(
  targetResourceId: string,
  recipes: RecipeConfig[],
  visiting = new Set<string>(),
): string[] {
  if (visiting.has(targetResourceId)) return [];
  visiting.add(targetResourceId);

  const recipe = recipes.find((item) =>
    item.category !== 'sell' && item.outputs.some((output) => output.resourceId === targetResourceId),
  );
  if (!recipe) return [];

  const chain: string[] = [];
  for (const input of recipe.inputs) {
    chain.push(...findRecipeChain(input.resourceId, recipes, new Set(visiting)));
  }
  chain.push(recipe.name);
  return dedupeChain(chain);
}

function calcRewardMultiple(
  requirements: Array<{ resourceId: string; amount: number }>,
  rewards: Array<{ resourceId: string; amount: number }>,
  config: GameConfig,
): number {
  const baselineValue = requirements.reduce((sum, item) => {
    const sellPrice = config.resources[item.resourceId]?.sellPrice ?? 0;
    return sum + Math.max(0, sellPrice) * item.amount;
  }, 0);

  const rewardGold = rewards.reduce((sum, item) => {
    if (item.resourceId !== 'gold') return sum;
    return sum + item.amount;
  }, 0);

  return rewardGold / Math.max(1, baselineValue);
}

export function getBiasedTemplateWeight(
  template: OrderTemplate,
  context: OrderContext,
): number {
  let multiplier = 1;

  for (const requirement of template.requirementPool) {
    const minAmount = requirement.min;
    const inFlow = context.flowOutputIds.has(requirement.resourceId);
    const inInventory = (context.inventory[requirement.resourceId] ?? 0) >= minAmount;
    const craftable = context.enabledRecipes.some((recipe) =>
      recipe.outputs.some((output) => output.resourceId === requirement.resourceId),
    );

    if (inFlow) {
      multiplier *= 2.5;
    } else if (inInventory) {
      multiplier *= 1.9;
    } else if (craftable) {
      multiplier *= 1.3;
    } else {
      multiplier *= 0.3;
    }
  }

  if (template.highValue && multiplier > 0.5) {
    multiplier *= 1.2;
  }

  return Math.max(1, template.weight * multiplier);
}

export function buildOrderGuidance(
  order: ActiveOrder,
  config: GameConfig,
  context: OrderContext,
  template?: OrderTemplate,
): OrderGuidanceView {
  const rewardMultiple = calcRewardMultiple(order.requirements, order.rewards, config);
  const isHighValue = Boolean(template?.highValue) || order.rarity === 'rare' || rewardMultiple >= 1.65;
  const valueLabel = isHighValue
    ? rewardMultiple >= 1
      ? `高价值 x${rewardMultiple.toFixed(1)}`
      : '高价值'
    : '';

  const missing = order.requirements.filter((item) =>
    (context.inventory[item.resourceId] ?? 0) < item.amount,
  );

  if (missing.length === 0) {
    return {
      tone: 'ready',
      text: '库存已满足，可直接提交。',
      isHighValue,
      rewardMultiple,
      valueLabel,
    };
  }

  const mainMissing = missing[0];
  const resourceName = config.resources[mainMissing.resourceId]?.name ?? mainMissing.resourceId;
  const flowMatched = context.flowOutputIds.has(mainMissing.resourceId);
  const craftable = context.enabledRecipes.some((recipe) =>
    recipe.outputs.some((output) => output.resourceId === mainMissing.resourceId),
  );

  if (flowMatched) {
    return {
      tone: 'flow',
      text: `当前流程已覆盖${resourceName}，继续运行可补齐订单。`,
      isHighValue,
      rewardMultiple,
      valueLabel,
    };
  }

  if (craftable) {
    const chain = findRecipeChain(mainMissing.resourceId, context.enabledRecipes);
    return {
      tone: 'suggestion',
      text: chain.length > 0
        ? `建议切到 ${chain.join(' -> ')} 链路补货。`
        : `建议补生产 ${resourceName} 后再回头提交。`,
      isHighValue,
      rewardMultiple,
      valueLabel,
    };
  }

  return {
    tone: 'locked',
    text: `当前阶段还无法稳定生产${resourceName}，建议先解锁对应建筑或配方。`,
    isHighValue,
    rewardMultiple,
    valueLabel,
  };
}