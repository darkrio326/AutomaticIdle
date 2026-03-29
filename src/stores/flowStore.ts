import { defineStore } from 'pinia';
import resourcesArray from '@/config/resources.json';
import recipesArray from '@/config/recipes.json';
import skillsArray from '@/config/skills.json';
import upgradesArray from '@/config/upgrades.json';
import ordersArray from '@/config/orders.json';
import { simulateFlow } from '@/core/simulator';
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

export const useFlowStore = defineStore('flow', {
  state: () => ({
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
    playerState: buildInitialPlayerState(),
    gameConfig: buildGameConfig(),
  }),
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
  },
  actions: {
    addStep(): void {
      const fallbackRecipeId = this.recipeOptions[0]?.id ?? '';
      this.steps.push({
        uid: stepUidSeed++,
        recipeId: fallbackRecipeId,
        repeat: 1,
      });
    },
    removeStep(uid: number): void {
      this.steps = this.steps.filter((s) => s.uid !== uid);
    },
    updateStepRecipe(uid: number, recipeId: string): void {
      const step = this.steps.find((s) => s.uid === uid);
      if (!step) return;
      step.recipeId = recipeId;
    },
    updateStepRepeat(uid: number, repeat: number): void {
      const step = this.steps.find((s) => s.uid === uid);
      if (!step) return;
      step.repeat = Math.max(1, Math.floor(repeat));
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
    },
  },
});
