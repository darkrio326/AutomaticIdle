<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import SimResultPanel from '@/components/SimResultPanel.vue';
import UpgradePanel from '@/components/UpgradePanel.vue';
import SkillPanel from '@/components/SkillPanel.vue';

const flowStore = useFlowStore();

const canRun = computed(() => flowStore.steps.length > 0);

function onRepeatInput(uid: number, value: string): void {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return;
  flowStore.updateStepRepeat(uid, parsed);
}
</script>

<template>
  <section>
    <h2>流程编辑器</h2>

    <div>
      <button type="button" @click="flowStore.addStep">新增步骤</button>
      <button type="button" :disabled="!canRun" @click="flowStore.runSimulation">运行模拟</button>
    </div>

    <ul>
      <li v-for="step in flowStore.steps" :key="step.uid">
        <label>
          配方：
          <select
            :value="step.recipeId"
            @change="flowStore.updateStepRecipe(step.uid, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="recipe in flowStore.recipeOptions" :key="recipe.id" :value="recipe.id">
              {{ recipe.name }} ({{ recipe.id }})
            </option>
          </select>
        </label>

        <label>
          次数：
          <input
            type="number"
            min="1"
            :value="step.repeat"
            @input="onRepeatInput(step.uid, ($event.target as HTMLInputElement).value)"
          />
        </label>

        <button type="button" @click="flowStore.removeStep(step.uid)">删除</button>
      </li>
    </ul>

    <UpgradePanel />
    <SkillPanel />
    <SimResultPanel />
  </section>
</template>
