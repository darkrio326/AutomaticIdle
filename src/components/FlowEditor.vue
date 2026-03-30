<script setup lang="ts">
import { computed } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';
import SimResultPanel from '@/components/SimResultPanel.vue';
import UpgradePanel from '@/components/UpgradePanel.vue';
import SkillPanel from '@/components/SkillPanel.vue';
import OrderPanel from '@/components/OrderPanel.vue';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();

const canRun = computed(() => flowStore.steps.length > 0);

function onRepeatInput(uid: number, value: string): void {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return;
  flowStore.updateStepRepeat(uid, parsed);
  runtimeStore.notifyFlowChanged();
}

function onRecipeChange(uid: number, recipeId: string): void {
  flowStore.updateStepRecipe(uid, recipeId);
  runtimeStore.notifyFlowChanged();
}

function onAddStep(): void {
  flowStore.addStep();
  runtimeStore.notifyFlowChanged();
}

function onRemoveStep(uid: number): void {
  flowStore.removeStep(uid);
  runtimeStore.notifyFlowChanged();
}

/** 进度条百分比（0-100） */
function stepProgressPercent(stepIndex: number): number {
  if (runtimeStore.stepIndex !== stepIndex) return 0;
  return Math.round(runtimeStore.stepProgressRatio * 100);
}
</script>

<template>
  <section>
    <h2>流程编辑器</h2>

    <p v-if="flowStore.offlineMessage" class="offline-msg">{{ flowStore.offlineMessage }}</p>

    <!-- 运行控制 -->
    <div class="runtime-controls">
      <button
        v-if="!runtimeStore.isRunning && !runtimeStore.isPaused"
        type="button"
        :disabled="!canRun"
        @click="runtimeStore.start()"
      >▶ 开始运行</button>

      <template v-else-if="runtimeStore.isRunning">
        <button type="button" @click="runtimeStore.pause()">⏸ 暂停</button>
        <button type="button" @click="runtimeStore.stop()">⏹ 停止</button>
      </template>

      <template v-else-if="runtimeStore.isPaused">
        <button type="button" @click="runtimeStore.resume()">▶ 继续</button>
        <button type="button" @click="runtimeStore.stop()">⏹ 停止</button>
      </template>

      <span v-if="runtimeStore.hasPendingFlow" class="pending-tip">（流程已修改，将在当前步骤完成后生效）</span>
      <span v-if="runtimeStore.isRunning || runtimeStore.isPaused" class="loop-count">已循环：{{ runtimeStore.loopCount }} 次</span>
    </div>

    <!-- 流程编辑 -->
    <div class="step-controls">
      <button type="button" @click="onAddStep">新增步骤</button>
      <button type="button" :disabled="!canRun" @click="flowStore.runSimulation">静态模拟</button>
    </div>

    <ul class="step-list">
      <li
        v-for="(step, index) in flowStore.steps"
        :key="step.uid"
        :class="[
          'step-item',
          runtimeStore.isRunning && runtimeStore.stepIndex === index ? 'step-active' : ''
        ]"
      >
        <div class="step-header">
          <label>
            配方：
            <select
              :value="step.recipeId"
              @change="onRecipeChange(step.uid, ($event.target as HTMLSelectElement).value)"
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

          <button type="button" @click="onRemoveStep(step.uid)">删除</button>
        </div>

        <!-- 进度条：仅当前执行步骤展示 -->
        <div
          v-if="runtimeStore.isRunning && runtimeStore.stepIndex === index"
          class="step-progress-bar"
        >
          <div
            class="step-progress-fill"
            :style="{ width: stepProgressPercent(index) + '%' }"
          ></div>
          <span class="step-progress-label">
            {{ runtimeStore.repeatProgress + 1 }} / {{ step.repeat }}
            &nbsp;{{ stepProgressPercent(index) }}%
          </span>
        </div>
      </li>
    </ul>

    <UpgradePanel />
    <SkillPanel />
    <OrderPanel />
    <SimResultPanel />
  </section>
</template>

<style scoped>
.offline-msg {
  color: #b8860b;
  margin-bottom: 8px;
}

.runtime-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pending-tip {
  font-size: 0.8em;
  color: #888;
}

.loop-count {
  font-size: 0.85em;
  color: #555;
}

.step-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.step-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
}

.step-item {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 6px;
  transition: border-color 0.2s, background 0.2s;
}

.step-active {
  border-color: #4a90d9;
  background: #f0f6ff;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.step-progress-bar {
  position: relative;
  margin-top: 6px;
  height: 14px;
  background: #e0e0e0;
  border-radius: 7px;
  overflow: hidden;
}

.step-progress-fill {
  height: 100%;
  background: #4a90d9;
  border-radius: 7px;
  transition: width 0.1s linear;
}

.step-progress-label {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.72em;
  line-height: 14px;
  color: #333;
  pointer-events: none;
  white-space: nowrap;
}
</style>
