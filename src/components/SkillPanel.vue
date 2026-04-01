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
        <p>技能加成：{{ skill.skillBonusPercent.toFixed(1) }}%</p>
        
        <!-- 工具加速信息 -->
        <div v-if="skill.applicableTools.length > 0">
          <p>适配工具：</p>
          <ul>
            <li v-for="tool in skill.applicableTools" :key="tool.toolId">
              {{ tool.name }} (Tier {{ tool.tier }}) -{{ ((1 - tool.timeMultiplier) * 100).toFixed(0) }}% 耗时
            </li>
          </ul>
        </div>
        
        <!-- 总体加速效果 -->
        <p><strong>当前总加成：{{ skill.combinedBonusPercent.toFixed(1) }}%</strong></p>
      </li>
    </ul>
  </section>
</template>
