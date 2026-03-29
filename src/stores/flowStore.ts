import { defineStore } from 'pinia';
import resourcesArray from '@/config/resources.json';
import recipesArray from '@/config/recipes.json';
import skillsArray from '@/config/skills.json';
import upgradesArray from '@/config/upgrades.json';
import ordersArray from '@/config/orders.json';
import { simulateFlow } from '@/core/simulator';
import {
  canPurchaseUpgrade,
  compareFlowBeforeAfterUpgrade,
  purchaseUpgrade,
} from '@/core/upgradeSystem';
import { applyExpGains, calcRequiredExp } from '@/core/expSystem';
import { loadSaveSnapshot, saveSnapshot } from '@/services/saveService';
import type {
  FlowDefinition,
  FlowStep,
  GameConfig,
  OrderConfig,
  PlayerState,
  RecipeConfig,
  ResourceConfig,
  SimulationResult,
  SkillConfig,
  UpgradeConfig,
} from '@/core/types';

interface FlowStepItem {
  uid: number;
  recipeId: string;
  repeat: number;
}

interface UpgradeComparisonView {
  upgradeId: string;
  before: {
    totalTime: number;
    totalGoldGained: number;
    goldPerSecond: number;
  };
  after: {
    totalTime: number;
    totalGoldGained: number;
    goldPerSecond: number;
  };
  delta: {
    totalTime: number;
    totalGoldGained: number;
    goldPerSecond: number;
  };
}

function canSubmitOrderRequirements(
  inventory: Record<string, number>,
  requirements: Array<{ resourceId: string; amount: number }>,
): { ok: boolean; reason?: string } {
  for (const req of requirements) {
    const current = inventory[req.resourceId] ?? 0;
    if (current < req.amount) {
      return {
        ok: false,
        reason: `资源不足：${req.resourceId} 需要 ${req.amount}，当前 ${current}`,
      };
    }
  }
  return { ok: true };
}

function canApplyResourceDelta(
  inventory: Record<string, number>,
  delta: Record<string, number>,
): { ok: boolean; reason?: string } {
  for (const [resourceId, change] of Object.entries(delta)) {
    const nextAmount = (inventory[resourceId] ?? 0) + change;
    if (nextAmount < 0) {
      return {
        ok: false,
        reason: `库存不足：${resourceId} 需要至少 ${Math.abs(change)}，当前 ${inventory[resourceId] ?? 0}`,
      };
    }
  }
  return { ok: true };
}

function toRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items) {
    result[item.id] = item;
  }
  return result;
}

function buildGameConfig(): GameConfig {
  return {
    resources: toRecord(resourcesArray as ResourceConfig[]),
    recipes: toRecord(recipesArray as RecipeConfig[]),
    skills: toRecord(skillsArray as SkillConfig[]),
    upgrades: toRecord(upgradesArray as UpgradeConfig[]),
    orders: toRecord(ordersArray as OrderConfig[]),
  };
}

function buildInitialPlayerState(): PlayerState {
  return {
    inventory: {
      gold: 0,
      iron_ore: 0,
      iron_ingot: 0,
      iron_sword: 0,
    },
    skills: {
      mining: { skillId: 'mining', level: 1, exp: 0 },
      smelting: { skillId: 'smelting', level: 1, exp: 0 },
      smithing: { skillId: 'smithing', level: 1, exp: 0 },
    },
    upgrades: {
      upgrade_mining_speed: { upgradeId: 'upgrade_mining_speed', level: 0 },
      upgrade_smelting_speed: { upgradeId: 'upgrade_smelting_speed', level: 0 },
      upgrade_smithing_speed: { upgradeId: 'upgrade_smithing_speed', level: 0 },
    },
  };
}

let stepUidSeed = 1;

function buildInitialState() {
  const gameConfig = buildGameConfig();
  const snapshot = loadSaveSnapshot();

  if (!snapshot) {
    return {
      flowName: '默认流程',
      steps: [
        {
          uid: stepUidSeed++,
          recipeId: 'mine_iron',
          repeat: 10,
        },
      ] as FlowStepItem[],
      result: null as SimulationResult | null,
      errorMessage: '',
      orderMessage: '',
      upgradeMessage: '',
      upgradeComparison: null as UpgradeComparisonView | null,
      completedOrderIds: [] as string[],
      playerState: buildInitialPlayerState(),
      gameConfig,
    };
  }

  for (const recipeId of snapshot.unlockedRecipeIds ?? []) {
    if (gameConfig.recipes[recipeId]) {
      gameConfig.recipes[recipeId].enabled = true;
    }
  }

  const restoredSteps = snapshot.steps
    .filter((s) => typeof s.recipeId === 'string' && typeof s.repeat === 'number')
    .map((s) => ({
      uid: stepUidSeed++,
      recipeId: s.recipeId,
      repeat: Math.max(1, Math.floor(s.repeat)),
    }));

  return {
    flowName: snapshot.flowName || '默认流程',
    steps:
      restoredSteps.length > 0
        ? restoredSteps
        : [
            {
              uid: stepUidSeed++,
              recipeId: 'mine_iron',
              repeat: 10,
            },
          ],
    result: null as SimulationResult | null,
    errorMessage: '',
    orderMessage: '',
    upgradeMessage: '',
    upgradeComparison: null as UpgradeComparisonView | null,
    completedOrderIds: Array.isArray(snapshot.completedOrderIds) ? snapshot.completedOrderIds : [],
    playerState: snapshot.playerState,
    gameConfig,
  };
}

export const useFlowStore = defineStore('flow', {
  state: () => buildInitialState(),
  getters: {
    recipeOptions(state): RecipeConfig[] {
      return Object.values(state.gameConfig.recipes).filter((r) => r.enabled !== false);
    },
    inventoryEntries(state): Array<[string, number]> {
      return Object.entries(state.playerState.inventory).sort(([a], [b]) => a.localeCompare(b));
    },
    flowDefinition(state): FlowDefinition {
      const steps: FlowStep[] = state.steps.map((s) => ({
        recipeId: s.recipeId,
        repeat: s.repeat,
      }));
      return {
        id: 'flow-default',
        name: state.flowName,
        steps,
      };
    },
    canApplyResult(state): boolean {
      if (!state.result) return false;
      return canApplyResourceDelta(state.playerState.inventory, state.result.resourceDelta).ok;
    },
    upgradeItems(state): Array<{
      id: string;
      name: string;
      currentLevel: number;
      maxLevel: number;
      costs: UpgradeConfig['costs'];
      canPurchase: boolean;
      reason?: string;
    }> {
      return Object.values(state.gameConfig.upgrades).map((upgrade) => {
        const currentLevel = state.playerState.upgrades[upgrade.id]?.level ?? 0;
        const check = canPurchaseUpgrade(state.playerState, upgrade, state.gameConfig);
        return {
          id: upgrade.id,
          name: upgrade.name,
          currentLevel,
          maxLevel: upgrade.maxLevel,
          costs: upgrade.costs,
          canPurchase: check.ok,
          reason: check.reason,
        };
      });
    },
    skillItems(state): Array<{
      id: string;
      name: string;
      level: number;
      exp: number;
      requiredExp: number;
      progressPercent: number;
      timeBonusPercent: number;
    }> {
      return Object.values(state.gameConfig.skills).map((skillConfig) => {
        const skillState = state.playerState.skills[skillConfig.id] ?? {
          skillId: skillConfig.id,
          level: skillConfig.baseLevel,
          exp: 0,
        };

        const isMax = skillState.level >= skillConfig.maxLevel;
        const requiredExp = isMax ? 0 : calcRequiredExp(skillState.level, skillConfig.expFormula);
        const progressPercent = isMax
          ? 100
          : requiredExp > 0
            ? Math.min(100, (skillState.exp / requiredExp) * 100)
            : 0;
        const timeBonusPercent = Math.max(
          0,
          (skillState.level - 1) * skillConfig.timeReductionPerLevel * 100,
        );

        return {
          id: skillConfig.id,
          name: skillConfig.name,
          level: skillState.level,
          exp: skillState.exp,
          requiredExp,
          progressPercent,
          timeBonusPercent,
        };
      });
    },
    orderItems(state): Array<{
      id: string;
      name: string;
      requirements: OrderConfig['requirements'];
      rewards: NonNullable<OrderConfig['rewards']>;
      unlocks: NonNullable<OrderConfig['unlocks']>;
      completed: boolean;
      canSubmit: boolean;
      reason?: string;
    }> {
      return Object.values(state.gameConfig.orders)
        .filter((o) => o.enabled !== false)
        .map((order) => {
          const completed = state.completedOrderIds.includes(order.id);
          if (completed) {
            return {
              id: order.id,
              name: order.name,
              requirements: order.requirements,
              rewards: order.rewards ?? [],
              unlocks: order.unlocks ?? [],
              completed,
              canSubmit: false,
              reason: '订单已完成',
            };
          }

          const check = canSubmitOrderRequirements(state.playerState.inventory, order.requirements);
          return {
            id: order.id,
            name: order.name,
            requirements: order.requirements,
            rewards: order.rewards ?? [],
            unlocks: order.unlocks ?? [],
            completed,
            canSubmit: check.ok,
            reason: check.reason,
          };
        });
    },
  },
  actions: {
    persistState(): void {
      const unlockedRecipeIds = Object.values(this.gameConfig.recipes)
        .filter((r) => r.enabled !== false)
        .map((r) => r.id);

      saveSnapshot({
        version: 1,
        flowName: this.flowName,
        steps: this.steps.map((s) => ({ recipeId: s.recipeId, repeat: s.repeat })),
        playerState: this.playerState,
        completedOrderIds: [...this.completedOrderIds],
        unlockedRecipeIds,
      });
    },
    addStep(): void {
      const fallbackRecipeId = this.recipeOptions[0]?.id ?? '';
      this.steps.push({
        uid: stepUidSeed++,
        recipeId: fallbackRecipeId,
        repeat: 1,
      });
      this.persistState();
    },
    removeStep(uid: number): void {
      this.steps = this.steps.filter((s) => s.uid !== uid);
      this.persistState();
    },
    updateStepRecipe(uid: number, recipeId: string): void {
      const step = this.steps.find((s) => s.uid === uid);
      if (!step) return;
      step.recipeId = recipeId;
      this.persistState();
    },
    updateStepRepeat(uid: number, repeat: number): void {
      const step = this.steps.find((s) => s.uid === uid);
      if (!step) return;
      step.repeat = Math.max(1, Math.floor(repeat));
      this.persistState();
    },
    runSimulation(): void {
      this.errorMessage = '';
      this.result = null;

      if (this.steps.length === 0) {
        this.errorMessage = '请至少添加一个流程步骤。';
        return;
      }

      if (this.steps.some((s) => !s.recipeId)) {
        this.errorMessage = '存在未选择配方的步骤。';
        return;
      }

      try {
        this.result = simulateFlow(this.flowDefinition, this.playerState, this.gameConfig);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : '模拟失败';
      }
    },
    applySimulationResult(): void {
      this.errorMessage = '';

      if (!this.result) {
        this.errorMessage = '请先运行模拟，再应用结果。';
        return;
      }

      const check = canApplyResourceDelta(this.playerState.inventory, this.result.resourceDelta);
      if (!check.ok) {
        this.errorMessage = check.reason ?? '库存不足，无法应用本轮结果。';
        return;
      }

      for (const [resourceId, change] of Object.entries(this.result.resourceDelta)) {
        this.playerState.inventory[resourceId] = (this.playerState.inventory[resourceId] ?? 0) + change;
      }

      this.playerState.skills = applyExpGains(
        this.playerState.skills,
        this.result.expDelta,
        this.gameConfig.skills,
      );
      this.persistState();
    },
    buyUpgrade(upgradeId: string): void {
      this.upgradeMessage = '';

      const purchaseResult = purchaseUpgrade(this.playerState, upgradeId, this.gameConfig);
      if (!purchaseResult.success) {
        this.upgradeMessage = purchaseResult.reason ?? '升级购买失败';
        return;
      }

      this.playerState = purchaseResult.nextPlayerState;
      this.upgradeMessage = `升级成功：${upgradeId}`;
      this.persistState();

      if (this.result) {
        this.runSimulation();
      }
    },
    previewUpgradeComparison(upgradeId: string): void {
      this.upgradeMessage = '';
      this.upgradeComparison = null;

      try {
        const comparison = compareFlowBeforeAfterUpgrade(
          this.flowDefinition,
          this.playerState,
          upgradeId,
          this.gameConfig,
        );

        this.upgradeComparison = {
          upgradeId: comparison.upgradeId,
          before: {
            totalTime: comparison.before.totalTime,
            totalGoldGained: comparison.before.totalGoldGained,
            goldPerSecond: comparison.before.goldPerSecond,
          },
          after: {
            totalTime: comparison.after.totalTime,
            totalGoldGained: comparison.after.totalGoldGained,
            goldPerSecond: comparison.after.goldPerSecond,
          },
          delta: comparison.delta,
        };
      } catch (error) {
        this.upgradeMessage = error instanceof Error ? error.message : '无法完成升级收益对比';
      }
    },
    submitOrder(orderId: string): void {
      this.orderMessage = '';

      if (this.completedOrderIds.includes(orderId)) {
        this.orderMessage = `订单已完成：${orderId}`;
        return;
      }

      const order = this.gameConfig.orders[orderId];
      if (!order || order.enabled === false) {
        this.orderMessage = `订单不存在或未启用：${orderId}`;
        return;
      }

      const check = canSubmitOrderRequirements(this.playerState.inventory, order.requirements);
      if (!check.ok) {
        this.orderMessage = check.reason ?? '资源不足，无法提交订单';
        return;
      }

      for (const req of order.requirements) {
        this.playerState.inventory[req.resourceId] =
          (this.playerState.inventory[req.resourceId] ?? 0) - req.amount;
      }

      for (const reward of order.rewards ?? []) {
        this.playerState.inventory[reward.resourceId] =
          (this.playerState.inventory[reward.resourceId] ?? 0) + reward.amount;
      }

      for (const unlock of order.unlocks ?? []) {
        if (unlock.type === 'recipe' && this.gameConfig.recipes[unlock.id]) {
          this.gameConfig.recipes[unlock.id].enabled = true;
        }
      }

      this.completedOrderIds.push(orderId);
      this.orderMessage = `订单提交成功：${order.name}`;
      this.persistState();
    },
  },
});
