import { defineStore } from 'pinia';
import type { GameConfig, PlayerState, BuildingConfig } from '@/core/types';

export const useBuildingStore = defineStore('building', {
  state: () => ({
    /** 已购建筑集合（buildingId 集合） */
    purchasedBuildings: new Set<string>(),
  }),

  getters: {
    /**
     * 获取所有已购建筑 ID
     */
    getPurchasedBuildingIds(): string[] {
      return Array.from(this.purchasedBuildings);
    },

    /**
     * 获取所有已解锁的配方 ID
     */
    getUnlockedRecipeIds(): (gameConfig: GameConfig) => string[] {
      return (gameConfig: GameConfig) => {
        const recipeIds = new Set<string>();
        for (const buildingId of this.purchasedBuildings) {
          const building = gameConfig.buildings?.[buildingId];
          if (building?.unlock.recipes) {
            building.unlock.recipes.forEach((rid) => recipeIds.add(rid));
          }
        }
        return Array.from(recipeIds);
      };
    },

    /**
     * 获取所有已解锁的资源 ID
     */
    getUnlockedResourceIds(): (gameConfig: GameConfig) => string[] {
      return (gameConfig: GameConfig) => {
        const resourceIds = new Set<string>();
        for (const buildingId of this.purchasedBuildings) {
          const building = gameConfig.buildings?.[buildingId];
          if (building?.unlock.resources) {
            building.unlock.resources.forEach((rid) => resourceIds.add(rid));
          }
        }
        return Array.from(resourceIds);
      };
    },

    /**
     * 检查指定配方是否已解锁
     */
    isRecipeUnlocked(): (
      recipeId: string,
      gameConfig: GameConfig
    ) => boolean {
      return (recipeId: string, gameConfig: GameConfig) => {
        return this.getUnlockedRecipeIds(gameConfig).includes(recipeId);
      };
    },

    /**
     * 检查指定资源是否已解锁
     */
    isResourceUnlocked(): (
      resourceId: string,
      gameConfig: GameConfig
    ) => boolean {
      return (resourceId: string, gameConfig: GameConfig) => {
        return this.getUnlockedResourceIds(gameConfig).includes(resourceId);
      };
    },
  },

  actions: {
    /**
     * 检查是否可以购买指定建筑
     */
    canPurchaseBuilding(
      buildingId: string,
      playerState: PlayerState,
      gameConfig: GameConfig
    ): { canBuy: boolean; reason?: string } {
      // 检查建筑是否已购
      if (this.purchasedBuildings.has(buildingId)) {
        return {
          canBuy: false,
          reason: '该建筑已购',
        };
      }

      const building = gameConfig.buildings?.[buildingId];
      if (!building) {
        return {
          canBuy: false,
          reason: '建筑不存在',
        };
      }

      // 检查资源是否足够
      for (const [resourceId, amount] of Object.entries(building.cost)) {
        const current = playerState.inventory[resourceId] ?? 0;
        if (current < amount) {
          return {
            canBuy: false,
            reason: `${resourceId} 不足（需 ${amount}，有 ${current}）`,
          };
        }
      }

      return { canBuy: true };
    },

    /**
     * 购买建筑（扣除资源、标记为已购）
     */
    purchaseBuilding(
      buildingId: string,
      playerState: PlayerState,
      gameConfig: GameConfig
    ): { success: boolean; reason?: string } {
      const check = this.canPurchaseBuilding(buildingId, playerState, gameConfig);
      if (!check.canBuy) {
        return {
          success: false,
          reason: check.reason,
        };
      }

      const building = gameConfig.buildings![buildingId];

      // 扣除资源
      for (const [resourceId, amount] of Object.entries(building.cost)) {
        playerState.inventory[resourceId] = (playerState.inventory[resourceId] ?? 0) - amount;
      }

      // 标记为已购
      this.purchasedBuildings.add(buildingId);

      return { success: true };
    },

    /**
     * 恢复已购建筑状态（从存档加载）
     */
    restorePurchasedBuildings(buildingIds: string[]) {
      this.purchasedBuildings = new Set(buildingIds);
    },

    /**
     * 清空已购建筑
     */
    clearPurchasedBuildings() {
      this.purchasedBuildings.clear();
    },
  },
});
