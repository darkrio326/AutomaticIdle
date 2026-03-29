<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';

const flowStore = useFlowStore();
const skillItems = computed(() => flowStore.skillItems);
</script>

<template>
  <section>
    <h2>技能面板</h2>

    <ul>
      <li v-for="skill in skillItems" :key="skill.id">
        <p>{{ skill.name }} ({{ skill.id }})</p>
        <p>等级：Lv{{ skill.level }}</p>
        <p v-if="skill.requiredExp > 0">经验：{{ skill.exp }} / {{ skill.requiredExp }}</p>
        <p v-else>经验：已满级</p>
        <p>升级进度：{{ skill.progressPercent.toFixed(1) }}%</p>
        <p>效率加成：{{ skill.timeBonusPercent.toFixed(1) }}%</p>
      </li>
    </ul>
  </section>
</template>
