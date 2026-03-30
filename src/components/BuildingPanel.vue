<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import { useBuildingStore } from '@/stores/buildingStore';

const flowStore = useFlowStore();
const buildingStore = useBuildingStore();

interface BuildingItem {
  id: string;
  name: string;
  cost: Record<string, number>;
  isPurchased: boolean;
  canPurchase: boolean;
  reason?: string;
  unlockedRecipes: string[];
  unlockedResources: string[];
}

const buildingItems = computed((): BuildingItem[] => {
  const buildings = flowStore.gameConfig.buildings;
  if (!buildings) return [];

  return Object.entries(buildings).map(([buildingId, buildingConfig]) => {
    const isPurchased = buildingStore.purchasedBuildings.has(buildingId);
    
    const check = isPurchased
      ? { canBuy: false, reason: '已购' }
      : buildingStore.canPurchaseBuilding(buildingId, flowStore.playerState, flowStore.gameConfig);

    const unlockedRecipes = (buildingConfig.unlock.recipes ?? [])
      .map((id) => flowStore.gameConfig.recipes[id]?.name ?? id);
    
    const unlockedResources = (buildingConfig.unlock.resources ?? [])
      .map((id) => flowStore.gameConfig.resources[id]?.name ?? id);

    return {
      id: buildingId,
      name: buildingConfig.name,
      cost: buildingConfig.cost,
      isPurchased,
      canPurchase: check.canBuy && !isPurchased,
      reason: check.reason,
      unlockedRecipes,
      unlockedResources,
    };
  });
});

function formatCost(costs: Record<string, number>): string {
  return Object.entries(costs)
    .map(([resourceId, amount]) => {
      const name = flowStore.gameConfig.resources[resourceId]?.name ?? resourceId;
      return `${name} ×${amount}`;
    })
    .join(' / ');
}

function handlePurchaseBuilding(buildingId: string): void {
  flowStore.purchaseBuilding(buildingId);
}
</script>

<template>
  <section class="panel-section">
    <div class="section-header">
      <span class="section-icon">🏛️</span>
      <h3 class="section-title">建筑系统</h3>
    </div>
    <p v-if="flowStore.errorMessage" class="msg-error">{{ flowStore.errorMessage }}</p>
    <div class="buildings-list">
      <div
        v-for="building in buildingItems"
        :key="building.id"
        class="building-card"
        :class="{ 'building-purchased': building.isPurchased, 'building-disabled': !building.canPurchase && !building.isPurchased }"
      >
        <div class="building-header">
          <div class="building-name">{{ building.name }}</div>
          <div v-if="building.isPurchased" class="building-status-badge">✓ 已购</div>
        </div>

        <div class="building-cost">
          {{ formatCost(building.cost) }}
        </div>

        <!-- 解锁信息 -->
        <div v-if="building.unlockedRecipes.length > 0" class="building-unlocks">
          <div class="unlock-label">解锁配方:</div>
          <div class="unlock-list">
            <span v-for="recipe in building.unlockedRecipes" :key="recipe" class="unlock-item">
              {{ recipe }}
            </span>
          </div>
        </div>

        <div v-if="building.unlockedResources.length > 0" class="building-unlocks">
          <div class="unlock-label">解锁资源:</div>
          <div class="unlock-list">
            <span v-for="resource in building.unlockedResources" :key="resource" class="unlock-item">
              {{ resource }}
            </span>
          </div>
        </div>

        <!-- 购买按钮 -->
        <button
          v-if="!building.isPurchased"
          class="btn-purchase"
          :class="{ 'btn-purchase-ready': building.canPurchase }"
          :disabled="!building.canPurchase"
          @click="handlePurchaseBuilding(building.id)"
        >
          {{ building.canPurchase ? '购买' : (building.reason ?? '资源不足') }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel-section {
  border-bottom: 1px solid var(--border);
  padding-bottom: 16px;
  margin-bottom: 16px;
}

.panel-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.section-icon {
  font-size: 16px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.msg-error {
  margin: 8px 0;
  padding: 6px 8px;
  background: var(--bg-error, #ffe5e5);
  color: var(--text-error, #d00);
  border-radius: 4px;
  font-size: 12px;
}

.buildings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.building-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card, #fafafa);
  transition: all 0.2s;
}

.building-card.building-purchased {
  background: var(--bg-success, #e8f5e9);
  border-color: var(--border-success, #81c784);
  opacity: 0.7;
}

.building-card.building-disabled {
  opacity: 0.65;
  background: var(--bg-disabled, #f5f5f5);
}

.building-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.building-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.building-status-badge {
  font-size: 11px;
  background: var(--text-success, #4caf50);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
}

.building-cost {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.building-unlocks {
  margin-bottom: 6px;
}

.unlock-label {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.unlock-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.unlock-item {
  font-size: 10px;
  background: var(--bg-tag, #e3f2fd);
  color: var(--text-tag, #1976d2);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.btn-purchase {
  width: 100%;
  padding: 6px 8px;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--bg-button, #f5f5f5);
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: not-allowed;
  transition: all 0.2s;
}

.btn-purchase:disabled {
  opacity: 1;
}

.btn-purchase.btn-purchase-ready {
  background: var(--text-success, #4caf50);
  color: white;
  border-color: var(--text-success, #4caf50);
  cursor: pointer;
}

.btn-purchase.btn-purchase-ready:hover:not(:disabled) {
  background: var(--text-success-dark, #388e3c);
}
</style>
