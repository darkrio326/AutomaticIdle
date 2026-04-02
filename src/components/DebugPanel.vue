<script setup lang="ts">
import { computed } from 'vue';
import { clearSaveSnapshot } from '@/services/saveService';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
});

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();

const activeStepLabel = computed(() => {
  const flow = runtimeStore.activeFlow;
  if (!flow || flow.steps.length === 0) return '—';
  const step = flow.steps[runtimeStore.stepIndex];
  if (!step) return '—';
  return flowStore.gameConfig.recipes[step.recipeId]?.name ?? step.recipeId;
});

const pendingFlowLabel = computed(() => {
  if (!runtimeStore.hasPendingFlow) return '无';
  return '已挂起，下一步骤边界生效';
});

const inventoryEntries = computed(() =>
  Object.entries(runtimeStore.liveInventory)
    .filter(([, amount]) => amount > 0)
    .sort(([left], [right]) => left.localeCompare(right))
);

const repeatLabel = computed(() => {
  const flow = runtimeStore.activeFlow;
  if (!flow || flow.steps.length === 0) return '0 / 0';
  const step = flow.steps[runtimeStore.stepIndex];
  const total = step?.repeat ?? 0;
  return `${runtimeStore.repeatProgress + 1} / ${total}`;
});

function onTogglePause(): void {
  if (runtimeStore.isRunning) {
    runtimeStore.pause();
    return;
  }
  if (runtimeStore.isPaused) {
    runtimeStore.resume();
    return;
  }
  runtimeStore.start();
}

function onStepOnce(): void {
  runtimeStore.stepOnce();
}

function onClearSave(): void {
  clearSaveSnapshot();
  window.location.reload();
}

function formatAmount(resourceId: string, amount: number): string {
  const resourceName = flowStore.gameConfig.resources[resourceId]?.name ?? resourceId;
  return `${resourceName}: ${amount}`;
}
</script>

<template>
  <aside class="debug-panel" :class="{ 'debug-panel--embedded': props.embedded }">
    <div class="debug-panel__header">
      <div>
        <div class="debug-panel__eyebrow">Runtime Debug</div>
        <div class="debug-panel__title">调试面板</div>
      </div>
      <div class="debug-panel__status" :class="`is-${runtimeStore.status}`">
        {{ runtimeStore.status }}
      </div>
    </div>

    <div class="debug-panel__actions">
      <button class="debug-btn debug-btn--pause" @click="onTogglePause">
        {{ runtimeStore.isRunning ? '暂停' : runtimeStore.isPaused ? '继续' : '启动' }}
      </button>
      <button class="debug-btn debug-btn--step" :disabled="!runtimeStore.canStepOnce" @click="onStepOnce">
        单步推进
      </button>
      <button class="debug-btn debug-btn--danger" @click="onClearSave">
        清空存档
      </button>
    </div>

    <div class="debug-grid">
      <div class="debug-card">
        <span class="debug-card__label">当前步骤</span>
        <strong class="debug-card__value">{{ activeStepLabel }}</strong>
        <span class="debug-card__sub">{{ runtimeStore.stepIndex + 1 }} / {{ runtimeStore.activeFlow?.steps.length ?? 0 }}</span>
      </div>

      <div class="debug-card">
        <span class="debug-card__label">Repeat</span>
        <strong class="debug-card__value">{{ repeatLabel }}</strong>
        <span class="debug-card__sub">loop {{ runtimeStore.loopCount }}</span>
      </div>

      <div class="debug-card">
        <span class="debug-card__label">步骤进度</span>
        <strong class="debug-card__value">{{ Math.round(runtimeStore.stepProgress) }}ms</strong>
        <span class="debug-card__sub">/ {{ Math.round(runtimeStore.currentRepeatTotalMs) }}ms</span>
      </div>

      <div class="debug-card">
        <span class="debug-card__label">待生效流程</span>
        <strong class="debug-card__value">{{ pendingFlowLabel }}</strong>
        <span class="debug-card__sub">GPS {{ runtimeStore.gps.toFixed(2) }}</span>
      </div>
    </div>

    <div class="debug-inventory">
      <div class="debug-inventory__title">Live Inventory</div>
      <div v-if="inventoryEntries.length > 0" class="debug-inventory__list">
        <span v-for="[resourceId, amount] in inventoryEntries" :key="resourceId" class="debug-inventory__item">
          {{ formatAmount(resourceId, amount) }}
        </span>
      </div>
      <div v-else class="debug-inventory__empty">当前无库存变更</div>
    </div>
  </aside>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 30;
  width: min(420px, calc(100vw - 32px));
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(99, 102, 241, 0.24);
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(14px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.38);
}

.debug-panel--embedded {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: 2;
  width: 100%;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  box-shadow: none;
  padding: 12px 14px;
  max-height: min(42dvh, 360px);
  overflow: auto;
}

.debug-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.debug-panel__eyebrow {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.debug-panel__title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
}

.debug-panel__status {
  padding: 5px 10px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid var(--border);
  color: var(--text-dim);
  background: var(--bg-card-50);
}

.debug-panel__status.is-running {
  color: var(--emerald);
  background: var(--emerald-bg);
  border-color: rgba(52, 211, 153, 0.3);
}

.debug-panel__status.is-paused {
  color: var(--amber);
  background: var(--amber-bg);
  border-color: rgba(251, 191, 36, 0.3);
}

.debug-panel__actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.debug-btn {
  min-height: 34px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg-card);
}

.debug-btn--pause {
  color: #a5b4fc;
  background: var(--indigo-bg);
  border-color: rgba(99, 102, 241, 0.35);
}

.debug-btn--step {
  color: var(--amber);
  background: var(--amber-bg);
  border-color: rgba(251, 191, 36, 0.35);
}

.debug-btn--danger {
  color: var(--red);
  background: var(--red-bg);
  border-color: rgba(248, 113, 113, 0.35);
}

.debug-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.debug-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.debug-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.72);
  border: 1px solid var(--border-50);
}

.debug-card__label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.debug-card__value {
  font-size: 13px;
  color: var(--text);
}

.debug-card__sub {
  font-size: 11px;
  color: var(--text-muted);
}

.debug-inventory {
  padding-top: 10px;
  border-top: 1px solid var(--border-50);
}

.debug-inventory__title {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.debug-inventory__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.debug-inventory__item {
  font-size: 11px;
  color: var(--text);
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--border-50);
  border-radius: 999px;
  padding: 4px 8px;
}

.debug-inventory__empty {
  font-size: 11px;
  color: var(--text-dim);
}

@media (max-width: 900px) {
  .debug-panel:not(.debug-panel--embedded) {
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    width: auto;
  }
}

@media (max-width: 560px) {
  .debug-grid {
    grid-template-columns: 1fr;
  }
}
</style>