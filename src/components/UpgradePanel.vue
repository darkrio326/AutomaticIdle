<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';

const flowStore = useFlowStore();

const upgradeItems = computed(() => flowStore.upgradeItems);

function formatCost(costs: Array<{ resourceId: string; amount: number }>): string {
  return costs.map((c) => `${c.resourceId} x${c.amount}`).join(' / ');
}
</script>

<template>
  <section>
    <h2>升级面板</h2>

    <p v-if="flowStore.upgradeMessage">{{ flowStore.upgradeMessage }}</p>

    <ul>
      <li v-for="item in upgradeItems" :key="item.id">
        <p>{{ item.name }} ({{ item.id }})</p>
        <p>等级：Lv{{ item.currentLevel }} / {{ item.maxLevel }}</p>
        <p>消耗：{{ formatCost(item.costs) }}</p>

        <button type="button" :disabled="!item.canPurchase" @click="flowStore.buyUpgrade(item.id)">
          购买升级
        </button>
        <button type="button" @click="flowStore.previewUpgradeComparison(item.id)">
          查看升级前后收益
        </button>

        <p v-if="!item.canPurchase">不可购买：{{ item.reason }}</p>
      </li>
    </ul>

    <div v-if="flowStore.upgradeComparison">
      <h3>升级收益对比：{{ flowStore.upgradeComparison.upgradeId }}</h3>
      <p>
        总耗时：{{ flowStore.upgradeComparison.before.totalTime.toFixed(2) }}s ->
        {{ flowStore.upgradeComparison.after.totalTime.toFixed(2) }}s
        (Δ {{ flowStore.upgradeComparison.delta.totalTime.toFixed(2) }}s)
      </p>
      <p>
        总金币：{{ flowStore.upgradeComparison.before.totalGoldGained }} ->
        {{ flowStore.upgradeComparison.after.totalGoldGained }}
        (Δ {{ flowStore.upgradeComparison.delta.totalGoldGained.toFixed(2) }})
      </p>
      <p>
        每秒金币：{{ flowStore.upgradeComparison.before.goldPerSecond.toFixed(4) }} ->
        {{ flowStore.upgradeComparison.after.goldPerSecond.toFixed(4) }}
        (Δ {{ flowStore.upgradeComparison.delta.goldPerSecond.toFixed(4) }})
      </p>
    </div>
  </section>
</template>
