import type { FlowDefinition, GameConfig, PlayerState, SimulationResult, UpgradeConfig } from './types';
import { simulateFlow } from './simulator';

export interface UpgradePurchaseResult {
  success: boolean;
  reason?: string;
  nextPlayerState: PlayerState;
}

export interface UpgradeComparisonResult {
  upgradeId: string;
  before: SimulationResult;
  after: SimulationResult;
  delta: {
    totalTime: number;
    totalGoldGained: number;
    goldPerSecond: number;
  };
}

function clonePlayerState(playerState: PlayerState): PlayerState {
  return {
    inventory: { ...playerState.inventory },
    skills: { ...playerState.skills },
    upgrades: { ...playerState.upgrades },
  };
}

function getCurrentUpgradeLevel(playerState: PlayerState, upgradeId: string): number {
  return playerState.upgrades[upgradeId]?.level ?? 0;
}

function validateUpgradeRequirements(
  playerState: PlayerState,
  upgradeConfig: UpgradeConfig,
  config: GameConfig,
): string | undefined {
  const currentLevel = getCurrentUpgradeLevel(playerState, upgradeConfig.id);
  if (currentLevel >= upgradeConfig.maxLevel) {
    return `升级已达上限：${upgradeConfig.id} Lv${upgradeConfig.maxLevel}`;
  }

  if (upgradeConfig.requiredSkillId != null && upgradeConfig.requiredSkillLevel != null) {
    const currentSkillLevel = playerState.skills[upgradeConfig.requiredSkillId]?.level ?? 0;
    if (currentSkillLevel < upgradeConfig.requiredSkillLevel) {
      return `技能等级不足：${upgradeConfig.requiredSkillId} 需要 Lv${upgradeConfig.requiredSkillLevel}，当前 Lv${currentSkillLevel}`;
    }
  }

  for (const cost of upgradeConfig.costs) {
    const current = playerState.inventory[cost.resourceId] ?? 0;
    if (current < cost.amount) {
      const resourceName = config.resources[cost.resourceId]?.name ?? cost.resourceId;
      return `资源不足：${resourceName} 需要 ${cost.amount}，当前 ${current}`;
    }
  }

  return undefined;
}

export function canPurchaseUpgrade(
  playerState: PlayerState,
  upgradeConfig: UpgradeConfig,
  config: GameConfig,
): { ok: boolean; reason?: string } {
  const reason = validateUpgradeRequirements(playerState, upgradeConfig, config);
  if (reason != null) {
    return { ok: false, reason };
  }
  return { ok: true };
}

export function purchaseUpgrade(
  playerState: PlayerState,
  upgradeId: string,
  config: GameConfig,
): UpgradePurchaseResult {
  const upgradeConfig = config.upgrades[upgradeId];
  if (upgradeConfig == null) {
    return {
      success: false,
      reason: `Upgrade not found: ${upgradeId}`,
      nextPlayerState: clonePlayerState(playerState),
    };
  }

  const reason = validateUpgradeRequirements(playerState, upgradeConfig, config);
  if (reason != null) {
    return {
      success: false,
      reason,
      nextPlayerState: clonePlayerState(playerState),
    };
  }

  const nextPlayerState = clonePlayerState(playerState);
  for (const cost of upgradeConfig.costs) {
    nextPlayerState.inventory[cost.resourceId] =
      (nextPlayerState.inventory[cost.resourceId] ?? 0) - cost.amount;
  }

  const currentLevel = getCurrentUpgradeLevel(nextPlayerState, upgradeId);
  nextPlayerState.upgrades[upgradeId] = {
    upgradeId,
    level: currentLevel + 1,
  };

  return {
    success: true,
    nextPlayerState,
  };
}

export function compareFlowBeforeAfterUpgrade(
  flow: FlowDefinition,
  playerState: PlayerState,
  upgradeId: string,
  config: GameConfig,
): UpgradeComparisonResult {
  const before = simulateFlow(flow, playerState, config);

  const purchaseResult = purchaseUpgrade(playerState, upgradeId, config);
  if (!purchaseResult.success) {
    throw new Error(purchaseResult.reason ?? `Upgrade purchase failed: ${upgradeId}`);
  }

  const after = simulateFlow(flow, purchaseResult.nextPlayerState, config);

  return {
    upgradeId,
    before,
    after,
    delta: {
      totalTime: after.totalTime - before.totalTime,
      totalGoldGained: after.totalGoldGained - before.totalGoldGained,
      goldPerSecond: after.goldPerSecond - before.goldPerSecond,
    },
  };
}
