import { defineStore } from 'pinia';
import type { GameConfig, PlayerState } from '@/core/types';

export const useToolStore = defineStore('tool', {
  state: () => ({
    /** 已购工具集合（toolId 集合） */
    purchasedTools: new Set<string>(),
    /** 各工具升级等级（toolId → 当前等级，未升级为 0） */
    toolLevels: {} as Record<string, number>,
  }),

  getters: {
    /**
     * 获取所有已购工具 ID
     */
    getPurchasedToolIds(): string[] {
      return Array.from(this.purchasedTools);
    },

    /**
     * 获取对指定配方有效的已购工具中的最高 tier 工具
     */
    getHighestTierToolForRecipe(): (
      recipeId: string,
      gameConfig: GameConfig
    ) => { toolId: string; tier: number; timeMultiplier: number } | null {
      return (recipeId: string, gameConfig: GameConfig) => {
        let bestTool: { toolId: string; tier: number; timeMultiplier: number } | null = null;

        for (const toolId of this.purchasedTools) {
          const toolConfig = gameConfig.tools?.[toolId];
          if (!toolConfig) continue;

          const effect = toolConfig.effects[recipeId];
          if (!effect) continue;

          const tier = toolConfig.tier ?? 0;
          const upgradeLevel = this.toolLevels[toolId] ?? 0;
          const efficiencyPerLevel = toolConfig.upgrade?.efficiencyPerLevel ?? 0;
          const actualTimeMultiplier = Math.max(
            0.1,
            effect.timeMultiplier - upgradeLevel * efficiencyPerLevel,
          );

          if (!bestTool || tier > bestTool.tier) {
            bestTool = {
              toolId,
              tier,
              timeMultiplier: actualTimeMultiplier,
            };
          }
        }

        return bestTool;
      };
    },

    /**
     * 获取对指定配方有效的所有已购工具（用于显示）
     */
    getApplicableToolsForRecipe(): (
      recipeId: string,
      gameConfig: GameConfig
    ) => Array<{ toolId: string; name: string; tier: number; timeMultiplier: number }> {
      return (recipeId: string, gameConfig: GameConfig) => {
        const tools: Array<{ toolId: string; name: string; tier: number; timeMultiplier: number }> = [];

        for (const toolId of this.purchasedTools) {
          const toolConfig = gameConfig.tools?.[toolId];
          if (!toolConfig) continue;

          const effect = toolConfig.effects[recipeId];
          if (!effect) continue;

          const upgradeLevel = this.toolLevels[toolId] ?? 0;
          const efficiencyPerLevel = toolConfig.upgrade?.efficiencyPerLevel ?? 0;
          const actualTimeMultiplier = Math.max(
            0.1,
            effect.timeMultiplier - upgradeLevel * efficiencyPerLevel,
          );

          tools.push({
            toolId,
            name: toolConfig.name,
            tier: toolConfig.tier ?? 0,
            timeMultiplier: actualTimeMultiplier,
          });
        }

        // 按 tier 降序排序
        tools.sort((a, b) => b.tier - a.tier);
        return tools;
      };
    },
  },

  actions: {
    /**
     * 检查是否可以购买指定工具
     */
    canPurchaseTool(
      toolId: string,
      playerState: PlayerState,
      gameConfig: GameConfig
    ): { canBuy: boolean; reason?: string } {
      // 检查工具是否已购
      if (this.purchasedTools.has(toolId)) {
        return {
          canBuy: false,
          reason: '该工具已购',
        };
      }

      const toolConfig = gameConfig.tools?.[toolId];
      if (!toolConfig) {
        return {
          canBuy: false,
          reason: '工具不存在',
        };
      }

      // 检查资源是否足够
      for (const [resourceId, amount] of Object.entries(toolConfig.cost)) {
        const current = playerState.inventory[resourceId] ?? 0;
        if (current < amount) {
          return {
            canBuy: false,
            reason: `${gameConfig.resources?.[resourceId]?.name ?? resourceId} 不足（需 ${amount}，有 ${current}）`,
          };
        }
      }

      return { canBuy: true };
    },

    /**
     * 购买工具（扣除资源、标记为已购）
     */
    purchaseTool(
      toolId: string,
      playerState: PlayerState,
      gameConfig: GameConfig
    ): { success: boolean; reason?: string } {
      const check = this.canPurchaseTool(toolId, playerState, gameConfig);
      if (!check.canBuy) {
        return {
          success: false,
          reason: check.reason,
        };
      }

      const toolConfig = gameConfig.tools![toolId];

      // 扣除资源
      for (const [resourceId, amount] of Object.entries(toolConfig.cost)) {
        playerState.inventory[resourceId] = (playerState.inventory[resourceId] ?? 0) - amount;
      }

      // 标记为已购
      this.purchasedTools.add(toolId);

      return { success: true };
    },

    /**
     * 恢复已购工具状态（从存档加载）
     */
    restorePurchasedTools(toolIds: string[]) {
      this.purchasedTools = new Set(toolIds);
    },

    /**
     * 恢复工具升级等级（从存档加载）
     */
    restoreToolLevels(levels: Record<string, number>) {
      this.toolLevels = { ...levels };
    },

    /**
     * 检查指定工具是否可以升级
     */
    canUpgradeTool(
      toolId: string,
      playerState: PlayerState,
      gameConfig: GameConfig
    ): { canUpgrade: boolean; reason?: string } {
      if (!this.purchasedTools.has(toolId)) {
        return { canUpgrade: false, reason: '工具未购买' };
      }
      const toolConfig = gameConfig.tools?.[toolId];
      if (!toolConfig?.upgrade) {
        return { canUpgrade: false, reason: '该工具不支持升级' };
      }
      const currentLevel = this.toolLevels[toolId] ?? 0;
      if (currentLevel >= toolConfig.upgrade.maxLevel) {
        return { canUpgrade: false, reason: '已达满级' };
      }
      for (const [resourceId, amount] of Object.entries(toolConfig.upgrade.costPerLevel)) {
        const current = playerState.inventory[resourceId] ?? 0;
        if (current < amount) {
          return {
            canUpgrade: false,
            reason: `${gameConfig.resources?.[resourceId]?.name ?? resourceId} 不足（需 ${amount}，有 ${current}）`,
          };
        }
      }
      return { canUpgrade: true };
    },

    /**
     * 升级工具（扣除资源、等级 +1）
     */
    upgradeTool(
      toolId: string,
      playerState: PlayerState,
      gameConfig: GameConfig
    ): { success: boolean; reason?: string } {
      const check = this.canUpgradeTool(toolId, playerState, gameConfig);
      if (!check.canUpgrade) {
        return { success: false, reason: check.reason };
      }
      const toolConfig = gameConfig.tools![toolId];
      for (const [resourceId, amount] of Object.entries(toolConfig.upgrade!.costPerLevel)) {
        playerState.inventory[resourceId] = (playerState.inventory[resourceId] ?? 0) - amount;
      }
      this.toolLevels[toolId] = (this.toolLevels[toolId] ?? 0) + 1;
      return { success: true };
    },

    /**
     * 清空已购工具状态
     */
    clearPurchasedTools() {
      this.purchasedTools.clear();
      this.toolLevels = {};
    },
  },
});
