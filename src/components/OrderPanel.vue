<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';

const flowStore = useFlowStore();
const orderItems = computed(() => flowStore.orderItems);

function formatResources(items: Array<{ resourceId: string; amount: number }>): string {
  if (items.length === 0) return '无';
  return items.map((x) => `${x.resourceId} x${x.amount}`).join(' / ');
}

function formatUnlocks(items: Array<{ type: 'recipe' | 'upgrade_cap' | 'feature'; id: string }>): string {
  if (items.length === 0) return '无';
  return items.map((x) => `${x.type}:${x.id}`).join(' / ');
}
</script>

<template>
  <section>
    <h2>订单面板</h2>

    <p v-if="flowStore.orderMessage">{{ flowStore.orderMessage }}</p>

    <ul>
      <li v-for="order in orderItems" :key="order.id">
        <p>{{ order.name }} ({{ order.id }})</p>
        <p>需求：{{ formatResources(order.requirements) }}</p>
        <p>奖励：{{ formatResources(order.rewards) }}</p>
        <p>解锁：{{ formatUnlocks(order.unlocks) }}</p>
        <p>状态：{{ order.completed ? '已完成' : '进行中' }}</p>

        <button type="button" :disabled="!order.canSubmit" @click="flowStore.submitOrder(order.id)">
          提交订单
        </button>
        <p v-if="!order.canSubmit && order.reason">不可提交：{{ order.reason }}</p>
      </li>
    </ul>
  </section>
</template>
