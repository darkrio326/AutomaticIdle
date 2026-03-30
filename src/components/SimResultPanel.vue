<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();

const hasResult = computed(() => flowStore.result != null);
const canApply = computed(() => flowStore.canApplyResult);

const resourceDeltaEntries = computed(() => {
  if (!flowStore.result) return [];
  return Object.entries(flowStore.result.resourceDelta).sort(([a], [b]) => a.localeCompare(b));
});

const expDeltaEntries = computed(() => {
  if (!flowStore.result) return [];
  return Object.entries(flowStore.result.expDelta).sort(([a], [b]) => a.localeCompare(b));
});

const recommendedUpgrade = computed(() => {
  if (!flowStore.result?.bottleneckRecipeId) return '';

  const bottleneckRecipeId = flowStore.result.bottleneckRecipeId;
  const target = Object.values(flowStore.gameConfig.upgrades).find(
    (u) => u.targetType === 'recipe_time' && u.targetId === bottleneckRecipeId,
  );

  if (!target) return '';
  return `${target.name} (${target.id})`;
});

/** 运行中使用实时库存，否则使用 flowStore 库存 */
const displayInventory = computed<Array<[string, number]>>(() => {
  if (runtimeStore.isRunning || runtimeStore.isPaused) {
    return Object.entries(runtimeStore.liveInventory).sort(([a], [b]) => a.localeCompare(b));
  }
  return flowStore.inventoryEntries;
});
</script>

<template>
  <section>
    <h2>模拟结果面板</h2>

    <!-- 实时运行摘要 -->
    <div v-if="runtimeStore.isRunning || runtimeStore.isPaused" class="runtime-summary">
      <span class="gps-badge">实时 GPS：{{ runtimeStore.gps.toFixed(3) }}/s</span>
      <span class="loop-badge">循环：{{ runtimeStore.loopCount }} 次</span>
    </div>

    <p v-if="flowStore.errorMessage">{{ flowStore.errorMessage }}</p>

    <h3>当前库存</h3>
    <ul class="inventory-list">
      <li v-for="[id, amount] in displayInventory" :key="id" class="inventory-item">
        <span class="res-id">{{ id }}</span>
        <span class="res-amount">{{ amount }}</span>
      </li>
    </ul>

    <div v-if="!hasResult">
      <p>尚无静态模拟结果。可点击「静态模拟」查看单轮收益，或直接点「开始运行」进入实时模式。</p>
    </div>

    <div v-else>
      <p>总耗时：{{ flowStore.result!.totalTime.toFixed(2) }}s</p>
      <p>总金币：{{ flowStore.result!.totalGoldGained }}</p>
      <p>每秒金币（静态）：{{ flowStore.result!.goldPerSecond.toFixed(4) }}</p>
      <p>瓶颈步骤：{{ flowStore.result!.bottleneckRecipeId ?? '无' }}</p>

      <div>
        <button type="button" :disabled="!canApply" @click="flowStore.applySimulationResult">
          应用本轮结果到库存
        </button>
        <p v-if="!canApply">当前库存不足以应用本轮结果，请先调整流程。</p>
      </div>

      <h3>资源净变化</h3>
      <ul v-if="resourceDeltaEntries.length > 0">
        <li v-for="[id, delta] in resourceDeltaEntries" :key="id">
          {{ id }}：{{ delta > 0 ? '+' : '' }}{{ delta }}
        </li>
      </ul>
      <p v-else>本轮无资源变化。</p>

      <h3>经验净变化</h3>
      <ul v-if="expDeltaEntries.length > 0">
        <li v-for="[id, delta] in expDeltaEntries" :key="id">
          {{ id }}：{{ delta > 0 ? '+' : '' }}{{ delta }}
        </li>
      </ul>
      <p v-else>本轮无经验变化。</p>

      <h3>优化建议</h3>
      <p v-if="recommendedUpgrade">
        当前瓶颈步骤对应升级建议：优先考虑 {{ recommendedUpgrade }}。
      </p>
      <p v-else>
        暂无直接升级建议，可优先减少瓶颈步骤重复次数或调整流程结构。
      </p>
    </div>
  </section>
</template>

<style scoped>
.runtime-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: #f0f6ff;
  border-radius: 4px;
  font-size: 0.9em;
}

.gps-badge {
  font-weight: 600;
  color: #2a6db5;
}

.loop-badge {
  color: #555;
}

.inventory-list {
  list-style: none;
  padding: 0;
  margin: 0 0 10px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.inventory-item {
  display: flex;
  gap: 4px;
  padding: 3px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.85em;
}

.res-id {
  color: #666;
}

.res-amount {
  font-weight: 600;
  color: #222;
  min-width: 2ch;
}
</style>
