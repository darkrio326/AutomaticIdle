<script setup lang="ts">
import { computed } from 'vue';
import type { RecipeConfig } from '@/core/types';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();

const gatherRecipes = computed(() =>
  flowStore.recipeOptions.filter((recipe) => recipe.category === 'gather')
);

const craftRecipes = computed(() =>
  flowStore.recipeOptions.filter((recipe) => recipe.category === 'craft')
);

const sellRecipes = computed(() =>
  flowStore.recipeOptions.filter((recipe) => recipe.category === 'sell')
);

function getRecipeName(recipeId: string): string {
  return flowStore.gameConfig.recipes[recipeId]?.name ?? recipeId;
}

function getRecipeTime(recipeId: string): number {
  return flowStore.gameConfig.recipes[recipeId]?.timeSeconds ?? 0;
}

function getRecipeCategory(recipeId: string): string {
  return flowStore.gameConfig.recipes[recipeId]?.category ?? 'gather';
}

function addStepWithRecipe(recipeId: string): void {
  flowStore.addStep();
  const newStep = flowStore.steps[flowStore.steps.length - 1];
  if (newStep.recipeId !== recipeId) {
    flowStore.updateStepRecipe(newStep.uid, recipeId);
  }
  runtimeStore.notifyFlowChanged();
}

function onRecipeChange(uid: number, value: string): void {
  flowStore.updateStepRecipe(uid, value);
  runtimeStore.notifyFlowChanged();
}

function onRemoveStep(uid: number): void {
  flowStore.removeStep(uid);
  runtimeStore.notifyFlowChanged();
}

function onRepeatDec(uid: number, current: number): void {
  if (current <= 1) return;
  flowStore.updateStepRepeat(uid, current - 1);
  runtimeStore.notifyFlowChanged();
}

function onRepeatInc(uid: number, current: number): void {
  flowStore.updateStepRepeat(uid, current + 1);
  runtimeStore.notifyFlowChanged();
}

function stepProgressPercent(stepIndex: number): number {
  if (runtimeStore.stepIndex !== stepIndex) return 0;
  return Math.round(runtimeStore.stepProgressRatio * 100);
}

function formatResourceAmount(resourceId: string, amount: number): string {
  const name = flowStore.gameConfig.resources[resourceId]?.name ?? resourceId;
  return `${name} x ${amount}`;
}

function formatResourceList(items: Array<{ resourceId: string; amount: number }>): string {
  if (items.length === 0) return '无';
  return items.map((item) => formatResourceAmount(item.resourceId, item.amount)).join('；');
}

function getRecipeSellValue(recipe: RecipeConfig): string {
  let totalGold = 0;

  for (const output of recipe.outputs) {
    const rc = flowStore.gameConfig.resources[output.resourceId];
    if (!rc) continue;
    if (rc.type === 'currency') {
      totalGold += output.amount;
      continue;
    }
    if (rc.sellPrice > 0) {
      totalGold += rc.sellPrice * output.amount;
    }
  }

  if (totalGold <= 0) return '无';
  return `${totalGold} 金币/次`;
}
</script>

<template>
  <div class="flow-editor">
    <!-- 标题栏 -->
    <div class="flow-header">
      <h2 class="flow-title">流程编辑区</h2>
      <span class="badge-auto">自动循环</span>
    </div>

    <!-- 离线消息 -->
    <div v-if="flowStore.offlineMessage" class="offline-msg">
      {{ flowStore.offlineMessage }}
    </div>

    <!-- 步骤列表 -->
    <div class="step-list">
      <div
        v-for="(step, index) in flowStore.steps"
        :key="step.uid"
        class="step-card"
        :class="{ 'step-active': (runtimeStore.isRunning || runtimeStore.isPaused) && runtimeStore.stepIndex === index }"
      >
        <!-- 激活标识条 -->
        <div v-if="(runtimeStore.isRunning || runtimeStore.isPaused) && runtimeStore.stepIndex === index" class="active-bar"></div>

        <!-- 顶部行：配方标签 + 时间 + 配方选择 + 删除 -->
        <div class="step-top">
          <div class="step-info">
            <span class="recipe-badge" :class="`cat-${getRecipeCategory(step.recipeId)}`">
              {{ getRecipeName(step.recipeId) }}
            </span>
            <span class="step-time">{{ getRecipeTime(step.recipeId) }}s</span>
          </div>
          <div class="step-actions">
            <select
              :value="step.recipeId"
              @change="onRecipeChange(step.uid, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="recipe in flowStore.recipeOptions" :key="recipe.id" :value="recipe.id">
                {{ recipe.name }}
              </option>
            </select>
            <button class="btn-icon btn-danger" @click="onRemoveStep(step.uid)" title="删除">✕</button>
          </div>
        </div>

        <!-- 底部行：循环次数 -->
        <div class="step-bottom">
          <div class="repeat-control">
            <span class="repeat-label">循环次数:</span>
            <div class="repeat-counter">
              <button class="repeat-btn" :disabled="step.repeat <= 1" @click="onRepeatDec(step.uid, step.repeat)">−</button>
              <span class="repeat-value">{{ step.repeat }}</span>
              <button class="repeat-btn" @click="onRepeatInc(step.uid, step.repeat)">+</button>
            </div>
          </div>
        </div>

        <!-- 进度条（仅当前执行步骤） -->
        <div v-if="(runtimeStore.isRunning || runtimeStore.isPaused) && runtimeStore.stepIndex === index" class="step-progress">
          <div class="step-progress-fill" :style="{ width: stepProgressPercent(index) + '%' }"></div>
        </div>
      </div>

      <div v-if="flowStore.steps.length === 0" class="empty-steps">
        流程为空，系统停机
      </div>
    </div>

    <!-- 添加步骤 -->
    <div class="add-step-area">
      <h3 class="section-label">添加步骤</h3>

      <div class="recipe-group" v-if="gatherRecipes.length > 0">
        <div class="recipe-group-head">采集</div>
        <div class="recipe-buttons">
          <button
            v-for="recipe in gatherRecipes"
            :key="recipe.id"
            class="btn-add-recipe"
            @click="addStepWithRecipe(recipe.id)"
          >
            + {{ recipe.name }}
            <span class="recipe-tooltip">
              <span class="tip-title">{{ recipe.name }}</span>
              <span class="tip-line"><span class="tip-label">消耗</span><span>{{ formatResourceList(recipe.inputs) }}</span></span>
              <span class="tip-line"><span class="tip-label">产出</span><span>{{ formatResourceList(recipe.outputs) }}</span></span>
              <span class="tip-line"><span class="tip-label">卖价</span><span>{{ getRecipeSellValue(recipe) }}</span></span>
            </span>
          </button>
        </div>
      </div>

      <div class="recipe-group" v-if="craftRecipes.length > 0">
        <div class="recipe-group-head">加工</div>
        <div class="recipe-buttons">
          <button
            v-for="recipe in craftRecipes"
            :key="recipe.id"
            class="btn-add-recipe"
            @click="addStepWithRecipe(recipe.id)"
          >
            + {{ recipe.name }}
            <span class="recipe-tooltip">
              <span class="tip-title">{{ recipe.name }}</span>
              <span class="tip-line"><span class="tip-label">消耗</span><span>{{ formatResourceList(recipe.inputs) }}</span></span>
              <span class="tip-line"><span class="tip-label">产出</span><span>{{ formatResourceList(recipe.outputs) }}</span></span>
              <span class="tip-line"><span class="tip-label">卖价</span><span>{{ getRecipeSellValue(recipe) }}</span></span>
            </span>
          </button>
        </div>
      </div>

      <div class="recipe-group" v-if="sellRecipes.length > 0">
        <div class="recipe-group-head">出售</div>
        <div class="recipe-buttons">
          <button
            v-for="recipe in sellRecipes"
            :key="recipe.id"
            class="btn-add-recipe"
            @click="addStepWithRecipe(recipe.id)"
          >
            + {{ recipe.name }}
            <span class="recipe-tooltip">
              <span class="tip-title">{{ recipe.name }}</span>
              <span class="tip-line"><span class="tip-label">消耗</span><span>{{ formatResourceList(recipe.inputs) }}</span></span>
              <span class="tip-line"><span class="tip-label">产出</span><span>{{ formatResourceList(recipe.outputs) }}</span></span>
              <span class="tip-line"><span class="tip-label">卖价</span><span>{{ getRecipeSellValue(recipe) }}</span></span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 自动运行状态 -->
    <div class="run-state">
      <div v-if="runtimeStore.isRunning" class="run-state-ok">✓ 自动运行中</div>
      <div v-else-if="runtimeStore.isPaused" class="run-state-pause">⏸ 已暂停（页面整体）</div>
      <div v-else-if="flowStore.steps.length === 0" class="run-state-warn">流程为空，系统停机</div>
      <div v-else class="run-state-warn">资源不足，系统停机</div>
      <div v-if="runtimeStore.isRunning || runtimeStore.isPaused || runtimeStore.loopCount > 0" class="loop-count">
        已循环 {{ runtimeStore.loopCount }} 次
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  padding: 16px;
  overflow: hidden;
}

/* 标题栏 */
.flow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.flow-title {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
}

.badge-auto {
  font-size: 10px;
  background: var(--bg-card);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: var(--r-full);
  padding: 2px 8px;
}

/* 离线消息 */
.offline-msg {
  font-size: 12px;
  color: var(--amber);
  background: var(--amber-bg);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--r-sm);
  padding: 6px 10px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

/* 步骤列表 */
.step-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
  margin-bottom: 12px;
}

.step-card {
  position: relative;
  background: var(--bg-card-50);
  border: 1px solid var(--border-50);
  border-radius: var(--r-lg);
  padding: 10px 12px;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  overflow: hidden;
}

.step-active {
  background: var(--bg-card) !important;
  border-color: var(--indigo) !important;
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.18);
}

.active-bar {
  position: absolute;
  left: -1px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 32px;
  background: var(--indigo);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px var(--indigo-glow);
}

/* 步骤顶部行 */
.step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.step-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.recipe-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  white-space: nowrap;
}

.cat-gather { background: rgba(30, 41, 59, 0.8); color: var(--text-muted); }
.cat-craft  { background: var(--orange-bg);       color: var(--orange); }
.cat-sell   { background: var(--yellow-bg);       color: var(--yellow); }

.step-time {
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.step-actions select {
  font-size: 11px;
  padding: 2px 4px;
  max-width: 88px;
}

.btn-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--r-sm);
  border: none;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-danger {
  background: var(--red-bg);
  color: var(--red);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.25);
}

/* 步骤底部行 */
.step-bottom {
  margin-top: 8px;
}

.repeat-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.repeat-label {
  font-size: 11px;
  color: var(--text-dim);
}

.repeat-counter {
  display: flex;
  align-items: center;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  overflow: hidden;
}

.repeat-btn {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.repeat-btn:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-card);
}

.repeat-value {
  width: 24px;
  text-align: center;
  font-size: 12px;
  font-family: monospace;
  color: var(--text);
}

/* 步骤进度条 */
.step-progress {
  margin-top: 8px;
  height: 3px;
  background: var(--bg-root);
  border-radius: var(--r-full);
  overflow: hidden;
}

.step-progress-fill {
  height: 100%;
  background: linear-gradient(to right, var(--indigo), var(--cyan));
  border-radius: var(--r-full);
  transition: width 0.1s linear;
  box-shadow: 0 0 6px var(--indigo-glow);
}

/* 空状态 */
.empty-steps {
  text-align: center;
  padding: 36px 16px;
  font-size: 13px;
  color: var(--text-dim);
  border: 1px dashed var(--border);
  border-radius: var(--r-lg);
}

/* 添加步骤区 */
.add-step-area {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-bottom: 12px;
}

.recipe-group {
  margin-bottom: 10px;
}

.recipe-group:last-child {
  margin-bottom: 0;
}

.recipe-group-head {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
  letter-spacing: 0.02em;
}

.tip-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}

.tip-line {
  display: flex;
  gap: 6px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-muted);
}

.tip-label {
  color: var(--text-dim);
  flex-shrink: 0;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.recipe-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.btn-add-recipe {
  position: relative;
  font-size: 12px;
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 7px 8px;
  text-align: center;
  transition: all 0.15s;
}

.btn-add-recipe:hover:not(:disabled) {
  background: var(--indigo-bg);
  border-color: var(--indigo);
  color: var(--text);
}

.recipe-tooltip {
  display: none;
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  width: 230px;
  z-index: 12;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 8px 10px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  text-align: left;
}

.btn-add-recipe:hover .recipe-tooltip {
  display: block;
}

/* 自动运行状态 */
.run-state {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.run-state-ok,
.run-state-pause,
.run-state-warn {
  font-size: 12px;
  border-radius: var(--r-full);
  padding: 5px 12px;
  font-weight: 600;
}

.run-state-ok {
  color: var(--emerald);
  background: var(--emerald-bg);
  border: 1px solid rgba(52, 211, 153, 0.28);
}

.run-state-pause {
  color: var(--amber);
  background: var(--amber-bg);
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.run-state-warn {
  color: var(--amber);
  background: var(--amber-bg);
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.loop-count {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: auto;
  font-family: monospace;
}
</style>
