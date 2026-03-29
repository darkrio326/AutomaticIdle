<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';

const flowStore = useFlowStore();

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
</script>

<template>
  <section>
    <h2>模拟结果面板</h2>

    <p v-if="flowStore.errorMessage">{{ flowStore.errorMessage }}</p>

    <h3>当前库存</h3>
    <ul>
      <li v-for="[id, amount] in flowStore.inventoryEntries" :key="id">
        {{ id }}：{{ amount }}
      </li>
    </ul>

    <div v-if="!hasResult">
      <p>尚无模拟结果。请先在流程编辑器中点击运行模拟。</p>
    </div>

    <div v-else>
      <p>总耗时：{{ flowStore.result!.totalTime.toFixed(2) }}s</p>
      <p>总金币：{{ flowStore.result!.totalGoldGained }}</p>
      <p>每秒金币：{{ flowStore.result!.goldPerSecond.toFixed(4) }}</p>
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
