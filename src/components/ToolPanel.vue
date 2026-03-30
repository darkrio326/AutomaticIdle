<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import { useToolStore } from '@/stores/toolStore';

const flowStore = useFlowStore();
const toolStore = useToolStore();

interface ToolEffect {
  recipeId: string;
  recipeName: string;
  timeMultiplier: number;
  speedPercent: number;
}

interface ToolItem {
  id: string;
  name: string;
  tier: number;
  cost: Record<string, number>;
  isFree: boolean;
  isPurchased: boolean;
  canPurchase: boolean;
  reason?: string;
  effects: ToolEffect[];
}

const toolItems = computed((): ToolItem[] => {
  const tools = flowStore.gameConfig.tools;
  if (!tools) return [];

  return Object.entries(tools).map(([toolId, toolConfig]) => {
    const isPurchased = toolStore.purchasedTools.has(toolId);
    const cost = toolConfig.cost ?? {};
    const isFree = Object.keys(cost).length === 0;

    const check = isPurchased
      ? { canBuy: false, reason: '已购' }
      : toolStore.canPurchaseTool(toolId, flowStore.playerState, flowStore.gameConfig);

    const effects: ToolEffect[] = Object.entries(toolConfig.effects).map(([recipeId, effect]) => ({
      recipeId,
      recipeName: flowStore.gameConfig.recipes[recipeId]?.name ?? recipeId,
      timeMultiplier: effect.timeMultiplier,
      speedPercent: Math.round((1 - effect.timeMultiplier) * 100),
    }));

    return {
      id: toolId,
      name: toolConfig.name,
      tier: toolConfig.tier ?? 0,
      cost,
      isFree,
      isPurchased,
      canPurchase: check.canBuy && !isPurchased,
      reason: check.reason,
      effects,
    };
  });
});

function formatCost(costs: Record<string, number>): string {
  const entries = Object.entries(costs);
  if (entries.length === 0) return '免费';
  return entries
    .map(([resourceId, amount]) => {
      const name = flowStore.gameConfig.resources[resourceId]?.name ?? resourceId;
      return `${name} ×${amount}`;
    })
    .join(' / ');
}

function handlePurchaseTool(toolId: string): void {
  flowStore.purchaseTool(toolId);
}
</script>

<template>
  <section class="panel-section">
    <div class="section-header">
      <span class="section-icon">🔧</span>
      <h3 class="section-title">工具系统</h3>
    </div>
    <div class="tools-list">
      <div
        v-for="tool in toolItems"
        :key="tool.id"
        class="tool-card"
        :class="{ 'tool-purchased': tool.isPurchased, 'tool-disabled': !tool.canPurchase && !tool.isPurchased }"
      >
        <div class="tool-header">
          <div class="tool-name">{{ tool.name }}</div>
          <div class="tool-badges">
            <span class="tool-tier-badge">T{{ tool.tier }}</span>
            <span v-if="tool.isPurchased" class="tool-status-badge">✓ 已购</span>
          </div>
        </div>

        <div class="tool-cost">
          {{ formatCost(tool.cost) }}
        </div>

        <!-- 加速效果 -->
        <div v-if="tool.effects.length > 0" class="tool-effects">
          <div class="effects-label">加速效果:</div>
          <div class="effects-list">
            <span v-for="effect in tool.effects" :key="effect.recipeId" class="effect-item">
              {{ effect.recipeName }}
              <span class="effect-value">-{{ effect.speedPercent }}%</span>
            </span>
          </div>
        </div>

        <!-- 购买按钮 -->
        <button
          v-if="!tool.isPurchased"
          class="btn-purchase"
          :class="{ 'btn-purchase-ready': tool.canPurchase }"
          :disabled="!tool.canPurchase"
          @click="handlePurchaseTool(tool.id)"
        >
          {{ tool.canPurchase ? (tool.isFree ? '领取' : '购买') : (tool.reason ?? '资源不足') }}
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

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card, #fff);
  transition: border-color 0.2s;
}

.tool-purchased {
  border-color: var(--color-success, #22c55e);
  background: var(--bg-success-light, #f0fdf4);
  opacity: 0.85;
}

.tool-disabled {
  opacity: 0.6;
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-badges {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-tier-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--bg-muted, #e5e7eb);
  color: var(--text-secondary, #6b7280);
  font-weight: 600;
}

.tool-status-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-success, #22c55e);
  color: #fff;
  font-weight: 600;
}

.tool-cost {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 6px;
}

.tool-effects {
  margin-bottom: 8px;
}

.effects-label {
  font-size: 11px;
  color: var(--text-muted, #9ca3af);
  margin-bottom: 3px;
}

.effects-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.effect-item {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--bg-muted, #e5e7eb);
  color: var(--text-secondary, #6b7280);
  display: flex;
  align-items: center;
  gap: 3px;
}

.effect-value {
  color: var(--color-accent, #3b82f6);
  font-weight: 600;
}

.btn-purchase {
  width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  cursor: not-allowed;
  background: var(--bg-muted, #e5e7eb);
  color: var(--text-muted, #9ca3af);
  transition: background 0.15s;
}

.btn-purchase-ready {
  background: var(--color-accent, #3b82f6);
  color: #fff;
  border-color: var(--color-accent, #3b82f6);
  cursor: pointer;
}

.btn-purchase-ready:hover {
  background: var(--color-accent-dark, #2563eb);
  border-color: var(--color-accent-dark, #2563eb);
}
</style>
