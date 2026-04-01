import { defineStore } from 'pinia';
import resourcesArray from '@/config/resources.json';
import recipesArray from '@/config/recipes.json';
import sellsArray from '@/config/sells.json';
import skillsArray from '@/config/skills.json';
import buildingsObj from '@/config/buildings.json';
import toolsObj from '@/config/tools.json';
import { simulateFlow } from '@/core/simulator';
import { applyExpGains, calcRequiredExp } from '@/core/expSystem';
import { loadSaveSnapshot, saveSnapshot } from '@/services/saveService';
import { useBuildingStore } from './buildingStore';
import { useToolStore } from './toolStore';
import { useOrderStore } from './orderStore';
import { useRuntimeStore } from './runtimeStore';
import type {
  FlowDefinition,
  FlowStep,
  GameConfig,
  PlayerState,
  RecipeConfig,
  ResourceConfig,
  SimulationResult,
  SkillConfig,
  BuildingConfig,
  ToolConfig,
} from '@/core/types';

interface FlowStepItem {
  uid: number;
  recipeId: string;
  repeat: number;
}

interface OfflineSettlementView {
  elapsedSeconds: number;
  appliedSeconds: number;
  cycles: number;
  resourceDelta: Record<string, number>;
  expDelta: Record<string, number>;
}

type FlowStepDraft = { recipeId: string; repeat: number };

const OFFLINE_MAX_SECONDS = 4 * 60 * 60;

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

export function clonePlayerState(playerState: PlayerState): PlayerState {
  // purchasedTools 可能是 Set（正常情形）、string[]（兼容）或 {} (JSON 反序列化后的 Set)
  const raw = playerState.purchasedTools;
  const purchasedTools =
    raw instanceof Set
      ? new Set<string>(raw)
      : Array.isArray(raw)
        ? new Set<string>(raw)
        : new Set<string>();
  return {
    inventory: { ...playerState.inventory },
    skills: Object.fromEntries(
      Object.entries(playerState.skills).map(([id, skill]) => [id, { ...skill }]),
    ),
    purchasedTools,
  };
}

function multiplyRecord(input: Record<string, number>, multiplier: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = value * multiplier;
  }
  return result;
}

export function getFlowValidationError(
  steps: FlowStepDraft[],
  gameConfig: GameConfig,
): string {
  if (steps.length === 0) return '';

  const hasNonSellStep = steps.some((step) => {
    const recipe = gameConfig.recipes[step.recipeId];
    return recipe != null && recipe.category !== 'sell';
  });

  if (!hasNonSellStep) {
    return '流程不能只包含售卖步骤，至少需要一个采集或加工步骤。';
  }

  return '';
}

function settleOfflineProgress(
  flowName: string,
  steps: FlowStepItem[],
  playerState: PlayerState,
  gameConfig: GameConfig,
  elapsedSeconds: number,
): OfflineSettlementView | null {
  if (steps.length === 0) return null;

  const flow: FlowDefinition = {
    id: 'flow-default',
    name: flowName,
    steps: steps.map((s) => ({ recipeId: s.recipeId, repeat: s.repeat })),
  };

  const singleResult = simulateFlow(flow, playerState, gameConfig);
  if (singleResult.totalTime <= 0) return null;

  const appliedSeconds = Math.min(elapsedSeconds, OFFLINE_MAX_SECONDS);
  let cycles = Math.floor(appliedSeconds / singleResult.totalTime);
  if (cycles <= 0) return null;

  while (cycles > 0) {
    const resourceDelta = multiplyRecord(singleResult.resourceDelta, cycles);
    const check = canApplyResourceDelta(playerState.inventory, resourceDelta);
    if (check.ok) {
      return {
        elapsedSeconds,
        appliedSeconds,
        cycles,
        resourceDelta,
        expDelta: multiplyRecord(singleResult.expDelta, cycles),
      };
    }
    cycles -= 1;
  }

  return null;
}

function calcDisplayRecipeTimeSeconds(
  recipe: RecipeConfig,
  playerState: PlayerState,
  gameConfig: GameConfig,
): number {
  const toolStore = useToolStore();

  // 计算技能加速
  let skillMultiplier = 1;
  if (recipe.requiredSkillId != null) {
    const skillConfig = gameConfig.skills[recipe.requiredSkillId];
    const skillState = playerState.skills[recipe.requiredSkillId];
    if (skillConfig != null && skillState != null) {
      skillMultiplier =
        1 - (skillState.level - 1) * skillConfig.timeReductionPerLevel;
    }
  }

  // 计算工具加速（只取最高 tier 工具，叠加升级等级）
  let toolMultiplier = 1;
  const bestTool = toolStore.getHighestTierToolForRecipe(recipe.id, gameConfig);
  if (bestTool) {
    toolMultiplier = bestTool.timeMultiplier;
  }

  return Math.max(0, recipe.timeSeconds * skillMultiplier * toolMultiplier);
}

function buildGameConfig(): GameConfig {
  // 合并 recipes 和 sells 为统一的配方列表
  const allRecipes = [
    ...recipesArray,
    ...sellsArray,
  ] as RecipeConfig[];

  return {
    resources: toRecord(resourcesArray as ResourceConfig[]),
    recipes: toRecord(allRecipes),
    skills: toRecord(skillsArray as SkillConfig[]),
    buildings: buildingsObj as Record<string, BuildingConfig>,
    tools: toolsObj as Record<string, ToolConfig>,
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
    purchasedTools: new Set(),
  };
}

let stepUidSeed = 1;
let uiMessageTimer: ReturnType<typeof setTimeout> | null = null;

function pushUiMessage(target: { errorMessage: string }, message: string, ttlMs = 2500): void {
  target.errorMessage = message;
  if (uiMessageTimer) {
    clearTimeout(uiMessageTimer);
    uiMessageTimer = null;
  }
  uiMessageTimer = setTimeout(() => {
    if (target.errorMessage === message) {
      target.errorMessage = '';
    }
  }, ttlMs);
}

function buildInitialState() {
  const gameConfig = buildGameConfig();
  const snapshot = loadSaveSnapshot();
  const now = Date.now();

  if (!snapshot) {
    return {
      flowName: '默认流程',
      steps: [] as FlowStepItem[],
      result: null as SimulationResult | null,
      errorMessage: '',
      offlineMessage: '',
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

  const invalidFlowMessage = getFlowValidationError(restoredSteps, gameConfig);
  const safeSteps = invalidFlowMessage ? [] : restoredSteps;
  const restoredPlayerState = clonePlayerState(snapshot.playerState);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - (typeof snapshot.lastSavedAt === 'number' ? snapshot.lastSavedAt : now)) / 1000),
  );

  let offlineMessage = invalidFlowMessage
    ? '检测到旧存档仅包含售卖步骤，已自动清空该流程；请至少保留一个采集或加工步骤。'
    : '';
  const settlement = settleOfflineProgress(
    snapshot.flowName || '默认流程',
    safeSteps,
    restoredPlayerState,
    gameConfig,
    elapsedSeconds,
  );

  if (settlement) {
    for (const [resourceId, change] of Object.entries(settlement.resourceDelta)) {
      restoredPlayerState.inventory[resourceId] =
        (restoredPlayerState.inventory[resourceId] ?? 0) + change;
    }

    restoredPlayerState.skills = applyExpGains(
      restoredPlayerState.skills,
      settlement.expDelta,
      gameConfig.skills,
    );

    const elapsedMinutes = Math.floor(settlement.elapsedSeconds / 60);
    const appliedMinutes = Math.floor(settlement.appliedSeconds / 60);
    const settlementMessage = `离线 ${elapsedMinutes} 分钟（按上限结算 ${appliedMinutes} 分钟），已补发 ${settlement.cycles} 轮流程收益。`;
    offlineMessage = offlineMessage
      ? `${offlineMessage} ${settlementMessage}`
      : settlementMessage;
  }

  const unlockedRecipeIds = Object.values(gameConfig.recipes)
    .filter((r) => r.enabled !== false)
    .map((r) => r.id);

  saveSnapshot({
    version: 1,
    flowName: snapshot.flowName || '默认流程',
    steps: safeSteps.map((s) => ({ recipeId: s.recipeId, repeat: s.repeat })),
    playerState: restoredPlayerState,
    unlockedRecipeIds,
    purchasedBuildingIds: snapshot.purchasedBuildingIds,
    purchasedToolIds: snapshot.purchasedToolIds,
    orderSlots: snapshot.orderSlots,
    lastSavedAt: now,
  });

  return {
    flowName: snapshot.flowName || '默认流程',
    steps: safeSteps,
    result: null as SimulationResult | null,
    errorMessage: '',
    offlineMessage,
    playerState: restoredPlayerState,
    gameConfig,
  };
}

export const useFlowStore = defineStore('flow', {
  state: () => buildInitialState(),

  getters: {
    recipeOptions(state): RecipeConfig[] {
      const buildingStore = useBuildingStore();
      const enabledRecipes = Object.values(state.gameConfig.recipes).filter((r) => {
        // 默认启用的配方直接可见，显式关闭的配方需要建筑解锁。
        const unlockedRecipeIds = buildingStore.getUnlockedRecipeIds(state.gameConfig);
        if (r.enabled === false) {
          return unlockedRecipeIds.includes(r.id);
        }
        return true;
      });
      return enabledRecipes;
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
    flowValidationError(state): string {
      return getFlowValidationError(state.steps, state.gameConfig);
    },
    displayGps(state): number {
      let totalGold = 0;
      let totalTime = 0;

      for (const step of state.steps) {
        const recipe = state.gameConfig.recipes[step.recipeId];
        if (!recipe) continue;

        const repeat = Math.max(1, Math.floor(step.repeat));
        totalTime +=
          calcDisplayRecipeTimeSeconds(recipe, state.playerState, state.gameConfig) * repeat;

        for (const output of recipe.outputs) {
          const rc = state.gameConfig.resources[output.resourceId];
          if (rc?.type === 'currency') {
            totalGold += output.amount * repeat;
          }
        }
      }

      return totalTime > 0 ? totalGold / totalTime : 0;
    },
    canApplyResult(state): boolean {
      if (!state.result) return false;
      return canApplyResourceDelta(state.playerState.inventory, state.result.resourceDelta).ok;
    },
    skillItems(state): Array<{
      id: string;
      name: string;
      level: number;
      exp: number;
      requiredExp: number;
      progressPercent: number;
      skillBonusPercent: number;
      toolBonusPercent: number;
      applicableTools: Array<{ toolId: string; name: string; tier: number; timeMultiplier: number }>;
      combinedBonusPercent: number;
      recipeBonuses: Array<{ recipeId: string; recipeName: string; combinedBonusPercent: number }>;
    }> {
      const toolStore = useToolStore();
      const buildingStore = useBuildingStore();
      const unlockedRecipeIds = new Set(buildingStore.getUnlockedRecipeIds(state.gameConfig));
      
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
        const skillBonusPercent = Math.max(
          0,
          (skillState.level - 1) * skillConfig.timeReductionPerLevel * 100,
        );

        // 获取该技能对应的配方，并收集所有适用的工具
        const recipesForSkill = Object.values(state.gameConfig.recipes)
          .filter((recipe) => {
            const matchedSkill =
              recipe.requiredSkillId === skillConfig.id
              || recipe.expGains.some((gain) => gain.skillId === skillConfig.id);
            if (!matchedSkill) return false;
            if (recipe.enabled === false) {
              return unlockedRecipeIds.has(recipe.id);
            }
            return true;
          });
        
        // 收集所有应用到这些配方的工具
        const applicableToolsSet = new Map<string, { toolId: string; name: string; tier: number; timeMultiplier: number }>();
        for (const recipe of recipesForSkill) {
          const bestTool = toolStore.getHighestTierToolForRecipe(recipe.id, state.gameConfig);
          if (bestTool) {
            // 使用 tier 作为 key 来避免重复，取最高 tier 的工具
            const existing = applicableToolsSet.get(String(bestTool.tier));
            if (!existing || bestTool.tier >= (existing.tier ?? 0)) {
              applicableToolsSet.set(String(bestTool.tier), {
                toolId: bestTool.toolId,
                name: state.gameConfig.tools?.[bestTool.toolId]?.name ?? bestTool.toolId,
                tier: bestTool.tier,
                timeMultiplier: bestTool.timeMultiplier,
              });
            }
          }
        }

        const applicableTools = Array.from(applicableToolsSet.values())
          .sort((a, b) => b.tier - a.tier);

        // 计算技能和工具叠加后的总加速（1 - skillMultiplier * toolMultiplier 相对于基础时间的减速）
        const skillMultiplier = 1 - skillBonusPercent / 100;

        const recipeBonuses = recipesForSkill.map((recipe) => {
          const bestTool = toolStore.getHighestTierToolForRecipe(recipe.id, state.gameConfig);
          const recipeToolMultiplier = bestTool?.timeMultiplier ?? 1;
          const recipeCombinedMultiplier = skillMultiplier * recipeToolMultiplier;

          return {
            recipeId: recipe.id,
            recipeName: recipe.name,
            combinedBonusPercent: Math.max(0, (1 - recipeCombinedMultiplier) * 100),
          };
        }).sort((a, b) => b.combinedBonusPercent - a.combinedBonusPercent);

        let toolMultiplier = 1;
        if (applicableTools.length > 0) {
          // 使用最高 tier 工具的效果
          toolMultiplier = applicableTools[0].timeMultiplier;
        }
        const toolBonusPercent = Math.max(0, (1 - toolMultiplier) * 100);
        const combinedMultiplier = skillMultiplier * toolMultiplier;
        const combinedBonusPercent = Math.max(0, (1 - combinedMultiplier) * 100);

        return {
          id: skillConfig.id,
          name: skillConfig.name,
          level: skillState.level,
          exp: skillState.exp,
          requiredExp,
          progressPercent,
          skillBonusPercent,
          toolBonusPercent,
          applicableTools,
          combinedBonusPercent,
          recipeBonuses,
        };
      });
    },
  },
  actions: {
    persistState(): void {
      const buildingStore = useBuildingStore();
      const toolStore = useToolStore();
      const orderStore = useOrderStore();
      const unlockedRecipeIds = Object.values(this.gameConfig.recipes)
        .filter((r) => r.enabled !== false)
        .map((r) => r.id);

      saveSnapshot({
        version: 1,
        flowName: this.flowName,
        steps: this.steps.map((s) => ({ recipeId: s.recipeId, repeat: s.repeat })),
        playerState: this.playerState,
        unlockedRecipeIds,
        purchasedBuildingIds: buildingStore.getPurchasedBuildingIds,
        purchasedToolIds: toolStore.getPurchasedToolIds,
        toolLevels: { ...toolStore.toolLevels },
        orderSlots: orderStore.getSnapshotSlots,
        lastSavedAt: Date.now(),
      });
    },
    addStep(recipeId?: string): boolean {
      const fallbackRecipeId = this.recipeOptions[0]?.id ?? '';
      const nextStep = {
        uid: stepUidSeed++,
        recipeId: recipeId ?? fallbackRecipeId,
        repeat: 1,
      };
      const nextSteps = [...this.steps, nextStep];
      const validationError = getFlowValidationError(nextSteps, this.gameConfig);
      if (validationError) {
        pushUiMessage(this, validationError, 3000);
        return false;
      }
      this.steps = nextSteps;
      this.persistState();
      return true;
    },
    removeStep(uid: number): void {
      const nextSteps = this.steps.filter((s) => s.uid !== uid);
      const validationError = getFlowValidationError(nextSteps, this.gameConfig);
      if (validationError) {
        pushUiMessage(this, validationError, 3000);
        return;
      }
      this.steps = nextSteps;
      this.persistState();
    },
    replaceSteps(steps: Array<{ recipeId: string; repeat: number }>): void {
      const nextSteps = steps.map((s) => ({
        uid: stepUidSeed++,
        recipeId: s.recipeId,
        repeat: Math.max(1, Math.floor(s.repeat)),
      }));
      const validationError = getFlowValidationError(nextSteps, this.gameConfig);
      if (validationError) {
        pushUiMessage(this, validationError, 3000);
        return;
      }
      this.steps = nextSteps;
      this.persistState();
    },
    updateStepRecipe(uid: number, recipeId: string): void {
      const step = this.steps.find((s) => s.uid === uid);
      if (!step) return;
      const nextSteps = this.steps.map((item) =>
        item.uid === uid ? { ...item, recipeId } : item,
      );
      const validationError = getFlowValidationError(nextSteps, this.gameConfig);
      if (validationError) {
        pushUiMessage(this, validationError, 3000);
        return;
      }
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

      const validationError = getFlowValidationError(this.steps, this.gameConfig);
      if (validationError) {
        this.errorMessage = validationError;
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
    submitOrder(instanceId: string): void {
      const orderStore = useOrderStore();
      const runtimeStore = useRuntimeStore();
      const order = orderStore.getOrderByInstanceId(instanceId);
      if (!order) {
        pushUiMessage(this, '订单提交失败：订单不存在或已过期', 3000);
        return;
      }

      const check = canSubmitOrderRequirements(this.playerState.inventory, order.requirements);
      if (!check.ok) {
        pushUiMessage(this, `订单提交失败：${check.reason ?? '资源不足，无法提交订单'}`, 3000);
        return;
      }

      for (const req of order.requirements) {
        this.playerState.inventory[req.resourceId] =
          (this.playerState.inventory[req.resourceId] ?? 0) - req.amount;
      }

      for (const reward of order.rewards) {
        this.playerState.inventory[reward.resourceId] =
          (this.playerState.inventory[reward.resourceId] ?? 0) + reward.amount;
      }

      // 运行中提交订单时，立刻把结算后的库存同步到引擎，避免被旧 runtime 状态回写覆盖。
      runtimeStore.syncPlayerStateFromFlowStore();

      const rewardText = order.rewards
        .map((r) => `${this.gameConfig.resources[r.resourceId]?.name ?? r.resourceId} +${r.amount}`)
        .join(' / ');
      pushUiMessage(this, `订单完成：${order.name}（奖励：${rewardText}）`, 3000);

      orderStore.completeOrder(instanceId);
      this.persistState();
    },

    deleteOrder(instanceId: string): void {
      const DELETE_COST = 10;
      const gold = this.playerState.inventory['gold'] ?? 0;
      if (gold < DELETE_COST) {
        pushUiMessage(this, `订单删除失败：金币不足（需 ${DELETE_COST}，有 ${gold}）`, 3000);
        return;
      }
      const orderStore = useOrderStore();
      this.playerState.inventory['gold'] = (this.playerState.inventory['gold'] ?? 0) - DELETE_COST;
      const runtimeStore = useRuntimeStore();
      runtimeStore.syncPlayerStateFromFlowStore();
      orderStore.deleteOrder(instanceId);
      this.persistState();
    },

    refreshOrder(instanceId: string): void {
      const REFRESH_COST = 25;
      const gold = this.playerState.inventory['gold'] ?? 0;
      if (gold < REFRESH_COST) {
        pushUiMessage(this, `订单刷新失败：金币不足（需 ${REFRESH_COST}，有 ${gold}）`, 3000);
        return;
      }
      const orderStore = useOrderStore();
      const slotIndex = orderStore.slots.findIndex((s) => s.order?.instanceId === instanceId);
      if (slotIndex === -1) {
        pushUiMessage(this, '订单刷新失败：订单不存在', 2000);
        return;
      }
      this.playerState.inventory['gold'] = (this.playerState.inventory['gold'] ?? 0) - REFRESH_COST;
      const runtimeStore = useRuntimeStore();
      runtimeStore.syncPlayerStateFromFlowStore();
      orderStore.refreshOrder(instanceId, this.gameConfig);
      pushUiMessage(this, `已刷新订单（消耗 ${REFRESH_COST} 金币）`, 2000);
      this.persistState();
    },

    initOrdersFromSnapshot(): void {
      const snapshot = loadSaveSnapshot();
      const orderStore = useOrderStore();
      if (snapshot?.orderSlots) {
        orderStore.restoreFromSnapshot(snapshot.orderSlots);
      }
    },

    /**
     * 从保存快照中恢复已购建筑
     */
    initBuildingsFromSnapshot(): void {
      const snapshot = loadSaveSnapshot();
      const buildingStore = useBuildingStore();
      if (snapshot?.purchasedBuildingIds) {
        buildingStore.restorePurchasedBuildings(snapshot.purchasedBuildingIds);
      }
    },

    /**
     * 购买建筑
     */
    purchaseBuilding(buildingId: string): void {
      this.errorMessage = '';
      const buildingStore = useBuildingStore();

      const check = buildingStore.canPurchaseBuilding(buildingId, this.playerState, this.gameConfig);
      if (!check.canBuy) {
        pushUiMessage(this, `建筑购买失败：${check.reason ?? '无法购买此建筑'}`, 3000);
        return;
      }

      const result = buildingStore.purchaseBuilding(buildingId, this.playerState, this.gameConfig);
      if (!result.success) {
        pushUiMessage(this, `建筑购买失败：${result.reason ?? '购买失败'}`, 3000);
        return;
      }

      // 解锁建筑对应的配方
      const building = this.gameConfig.buildings?.[buildingId];
      if (building?.unlock.recipes) {
        for (const recipeId of building.unlock.recipes) {
          if (this.gameConfig.recipes[recipeId]) {
            this.gameConfig.recipes[recipeId].enabled = true;
          }
        }
      }

      pushUiMessage(this, `建筑购买成功：${building?.name ?? buildingId}`, 3000);

      this.persistState();
    },

    /**
     * 清空已购建筑状态
     */
    clearPurchasedBuildings(): void {
      const buildingStore = useBuildingStore();
      buildingStore.clearPurchasedBuildings();
      this.persistState();
    },

    /**
     * 从保存快照中恢复已购工具
     */
    initToolsFromSnapshot(): void {
      const snapshot = loadSaveSnapshot();
      const toolStore = useToolStore();
      if (snapshot?.purchasedToolIds) {
        toolStore.restorePurchasedTools(snapshot.purchasedToolIds);
        // 同步回 playerState，确保引擎和离线结算能正确读取工具加速
        this.playerState.purchasedTools = new Set<string>(snapshot.purchasedToolIds);
      }
      if (snapshot?.toolLevels) {
        toolStore.restoreToolLevels(snapshot.toolLevels);
      }
    },

    /**
     * 购买工具
     */
    purchaseTool(toolId: string): void {
      this.errorMessage = '';
      const toolStore = useToolStore();

      const check = toolStore.canPurchaseTool(toolId, this.playerState, this.gameConfig);
      if (!check.canBuy) {
        pushUiMessage(this, `工具购买失败：${check.reason ?? '无法购买此工具'}`, 3000);
        return;
      }

      const result = toolStore.purchaseTool(toolId, this.playerState, this.gameConfig);
      if (!result.success) {
        pushUiMessage(this, `工具购买失败：${result.reason ?? '购买失败'}`, 3000);
        return;
      }

      // 同步到 playerState，确保引擎即时感知新工具
      if (!this.playerState.purchasedTools) {
        this.playerState.purchasedTools = new Set<string>();
      }
      this.playerState.purchasedTools.add(toolId);

      pushUiMessage(this, `工具购买成功：${this.gameConfig.tools?.[toolId]?.name ?? toolId}`, 3000);
      this.persistState();
    },

    /**
     * 清空已购工具状态
     */
    clearPurchasedTools(): void {
      const toolStore = useToolStore();
      toolStore.clearPurchasedTools();
      this.persistState();
    },

    /**
     * 升级工具
     */
    upgradeTool(toolId: string): void {
      const toolStore = useToolStore();
      const runtimeStore = useRuntimeStore();

      const check = toolStore.canUpgradeTool(toolId, this.playerState, this.gameConfig);
      if (!check.canUpgrade) {
        pushUiMessage(this, `工具升级失败：${check.reason ?? '无法升级此工具'}`, 3000);
        return;
      }

      const result = toolStore.upgradeTool(toolId, this.playerState, this.gameConfig);
      if (!result.success) {
        pushUiMessage(this, `工具升级失败：${result.reason ?? '升级失败'}`, 3000);
        return;
      }

      runtimeStore.syncPlayerStateFromFlowStore();
      const toolName = this.gameConfig.tools?.[toolId]?.name ?? toolId;
      const newLevel = toolStore.toolLevels[toolId] ?? 1;
      const maxLevel = this.gameConfig.tools?.[toolId]?.upgrade?.maxLevel ?? 5;
      pushUiMessage(this, `工具升级成功：${toolName} Lv.${newLevel}/${maxLevel}`, 3000);
      this.persistState();
    },
  },
});
