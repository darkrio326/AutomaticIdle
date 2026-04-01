<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { RecipeConfig } from '@/core/types';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';
import { useFlowTemplateStore } from '@/stores/flowTemplateStore';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();
const templateStore = useFlowTemplateStore();

// ── 离线消息弹窗 ──
const showOfflineModal = ref(false);
onMounted(() => {
  if (flowStore.offlineMessage) showOfflineModal.value = true;
});

// ── 流程模板 ──
const showSaveInput = ref(false);
const newTemplateName = ref('');
const selectedTemplateId = ref('');

// ── 编辑区上下分栏（步骤区 / 添加步骤区） ──
const editorMainRef = ref<HTMLElement | null>(null);
const splitRatio = ref(0.62);
let draggingSplit = false;
const SPLIT_MIN_TOP = 180;
const SPLIT_MIN_BOTTOM = 170;
const SPLIT_HANDLE_HEIGHT = 10;

function clampSplitRatio(ratio: number): number {
  if (!editorMainRef.value) return Math.min(0.8, Math.max(0.35, ratio));
  const total = editorMainRef.value.clientHeight;
  const usable = Math.max(1, total - SPLIT_HANDLE_HEIGHT);
  const minRatio = Math.min(0.85, SPLIT_MIN_TOP / usable);
  const maxRatio = Math.max(0.15, 1 - SPLIT_MIN_BOTTOM / usable);
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

function updateSplitByClientY(clientY: number): void {
  const el = editorMainRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const total = rect.height;
  const usable = Math.max(1, total - SPLIT_HANDLE_HEIGHT);
  const rawTop = clientY - rect.top;
  const minTop = Math.min(SPLIT_MIN_TOP, usable - 1);
  const maxTop = Math.max(minTop, usable - SPLIT_MIN_BOTTOM);
  const top = Math.min(maxTop, Math.max(minTop, rawTop));
  splitRatio.value = clampSplitRatio(top / usable);
}

function onSplitMouseMove(event: MouseEvent): void {
  if (!draggingSplit) return;
  event.preventDefault();
  updateSplitByClientY(event.clientY);
}

function onSplitMouseUp(): void {
  if (!draggingSplit) return;
  draggingSplit = false;
  window.removeEventListener('mousemove', onSplitMouseMove);
  window.removeEventListener('mouseup', onSplitMouseUp);
}

function onSplitMouseDown(event: MouseEvent): void {
  event.preventDefault();
  draggingSplit = true;
  updateSplitByClientY(event.clientY);
  window.addEventListener('mousemove', onSplitMouseMove);
  window.addEventListener('mouseup', onSplitMouseUp);
}

const stepListStyle = computed(() => ({
  flexBasis: `${Math.round(clampSplitRatio(splitRatio.value) * 100)}%`,
}));

const addAreaStyle = computed(() => ({
  flexBasis: `${Math.round((1 - clampSplitRatio(splitRatio.value)) * 100)}%`,
}));

function onSaveTemplate(): void {
  if (!newTemplateName.value.trim()) return;
  templateStore.saveTemplate(
    newTemplateName.value,
    flowStore.steps.map((s) => ({ recipeId: s.recipeId, repeat: s.repeat })),
  );
  newTemplateName.value = '';
  showSaveInput.value = false;
}

function onLoadTemplate(): void {
  if (!selectedTemplateId.value) return;
  const tpl = templateStore.getTemplate(selectedTemplateId.value);
  if (!tpl) return;
  flowStore.replaceSteps(tpl.steps);
  runtimeStore.notifyFlowChanged();
}

function onDeleteTemplate(id: string): void {
  templateStore.deleteTemplate(id);
  if (selectedTemplateId.value === id) selectedTemplateId.value = '';
}

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

function onRemoveStep(uid: number): void {
  flowStore.removeStep(uid);
  runtimeStore.notifyFlowChanged();
}

function onClearSteps(): void {
  if (flowStore.steps.length === 0) return;
  if (!window.confirm('确定清空所有步骤吗？')) return;
  flowStore.replaceSteps([]);
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

onUnmounted(() => {
  onSplitMouseUp();
});
</script>

<template>
  <div class="flow-editor">
    <!-- 标题栏 -->
    <div class="flow-header">
      <h2 class="flow-title">流程编辑区</h2>
      <div class="flow-header-actions">
        <span class="badge-auto">自动循环</span>
        <button
          class="btn-clear-steps"
          :disabled="flowStore.steps.length === 0"
          title="清空所有步骤"
          @click="onClearSteps"
        >清空</button>
      </div>
    </div>

    <!-- 离线消息弹窗 -->
    <div v-if="showOfflineModal" class="offline-modal-backdrop" @click.self="showOfflineModal = false">
      <div class="offline-modal">
        <div class="offline-modal-title">📦 离线收益结算</div>
        <div class="offline-modal-body">{{ flowStore.offlineMessage }}</div>
        <button class="offline-modal-ok" @click="showOfflineModal = false">确认</button>
      </div>
    </div>

    <!-- ── 流程模板 ── -->
    <div class="template-bar">
      <div class="template-row">
        <select
          v-model="selectedTemplateId"
          class="template-select"
          :disabled="templateStore.templates.length === 0"
        >
          <option value="">{{ templateStore.templates.length === 0 ? '暂无模板' : '选择模板…' }}</option>
          <option v-for="tpl in templateStore.templates" :key="tpl.id" :value="tpl.id">
            {{ tpl.name }}
          </option>
        </select>
        <button
          class="btn-tpl btn-tpl-load"
          :disabled="!selectedTemplateId"
          @click="onLoadTemplate"
          title="载入所选模板"
        >载入</button>
        <button
          v-if="selectedTemplateId"
          class="btn-tpl btn-tpl-del"
          @click="onDeleteTemplate(selectedTemplateId)"
          title="删除所选模板"
        >✕</button>
        <button
          v-if="!showSaveInput"
          class="btn-tpl btn-tpl-save"
          :disabled="templateStore.isFull || flowStore.steps.length === 0"
          :title="templateStore.isFull ? '已达上限 5 个' : '保存当前流程为模板'"
          @click="showSaveInput = true"
        >+ 保存 {{ templateStore.count }}/5</button>
      </div>
      <div v-if="showSaveInput" class="template-save-row">
        <input
          v-model="newTemplateName"
          class="template-name-input"
          placeholder="模板名称…"
          maxlength="20"
          @keydown.enter="onSaveTemplate"
          @keydown.escape="showSaveInput = false"
          autofocus
        />
        <button class="btn-tpl btn-tpl-confirm" @click="onSaveTemplate">确认</button>
        <button class="btn-tpl btn-tpl-cancel" @click="showSaveInput = false">取消</button>
      </div>
    </div>

    <div ref="editorMainRef" class="editor-main">
      <!-- 步骤列表 -->
      <div class="step-list" :style="stepListStyle">
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

      <div class="split-handle" @mousedown="onSplitMouseDown" title="拖拽调整上下区块高度">
        <span class="split-handle-dot"></span>
      </div>

      <div class="editor-footer" :style="addAreaStyle">
        <div class="add-step-scroll">
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
    </div>
  </div>
</template>

<style scoped>
.flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-panel);
  padding: 16px;
  overflow: hidden;
}

.editor-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.flow-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-auto {
  font-size: 10px;
  background: var(--bg-card);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: var(--r-full);
  padding: 2px 8px;
}

.btn-clear-steps {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.btn-clear-steps:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border-color: #ef4444;
}
.btn-clear-steps:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 离线消息（已弃用，改为 modal） */
.offline-msg {
  display: none;
}

/* 离线消息 Modal */
.offline-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.offline-modal {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px 24px;
  max-width: 320px;
  width: calc(100% - 32px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}
.offline-modal-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--amber);
  margin-bottom: 10px;
}
.offline-modal-body {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 16px;
}
.offline-modal-ok {
  width: 100%;
  padding: 8px;
  font-size: 13px;
  font-weight: 700;
  background: var(--amber-bg);
  color: var(--amber);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.offline-modal-ok:hover {
  background: rgba(251, 191, 36, 0.2);
}

/* 步骤列表 */
.step-list {
  flex: 0 0 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
  margin-bottom: 0;
}

.step-card {
  flex-shrink: 0;
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
  background: var(--indigo);
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

.editor-footer {
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.98) 12%, rgba(15, 23, 42, 1) 100%);
  border-top: 1px solid var(--border);
  margin: 0 -16px;
  padding: 10px 16px 10px;
}

.split-handle {
  height: 10px;
  flex-shrink: 0;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2px -8px;
}

.split-handle-dot {
  width: 54px;
  height: 4px;
  border-radius: var(--r-full);
  background: rgba(148, 163, 184, 0.4);
  box-shadow: 0 0 0 1px rgba(51, 65, 85, 0.5) inset;
}

.split-handle:hover .split-handle-dot {
  background: rgba(99, 102, 241, 0.55);
}

/* 添加步骤区 */
.add-step-area {
  flex-shrink: 0;
  border-top: none;
  padding-top: 0;
  margin-bottom: 8px;
}

.add-step-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
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

/* ── 流程模板 ── */
.template-bar {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.template-select {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  padding: 4px 6px;
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
}

.template-save-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.template-name-input {
  flex: 1;
  font-size: 11px;
  padding: 4px 8px;
  background: var(--bg-card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  outline: none;
}

.template-name-input:focus {
  border-color: var(--indigo);
}

.btn-tpl {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--r-sm);
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-tpl-load {
  background: var(--indigo-bg);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.35);
}

.btn-tpl-load:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.25);
  color: white;
}

.btn-tpl-save {
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.btn-tpl-save:hover:not(:disabled) {
  border-color: var(--indigo);
  color: var(--text);
}

.btn-tpl-del {
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid rgba(248, 113, 113, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.btn-tpl-del:hover {
  background: rgba(248, 113, 113, 0.2);
}

.btn-tpl-confirm {
  background: var(--emerald-bg);
  color: var(--emerald);
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.btn-tpl-confirm:hover:not(:disabled) {
  background: rgba(52, 211, 153, 0.2);
}

.btn-tpl-cancel {
  background: var(--bg-card);
  color: var(--text-dim);
  border: 1px solid var(--border);
}

@media (max-width: 900px) {
  .flow-editor {
    padding: 12px;
  }

  .flow-header {
    align-items: flex-start;
    gap: 8px;
  }

  .flow-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .template-row,
  .template-save-row {
    flex-wrap: wrap;
  }

  .template-select,
  .template-name-input {
    min-height: 38px;
  }

  .btn-tpl,
  .btn-clear-steps {
    min-height: 36px;
  }

  .editor-footer {
    margin: 0 -12px;
    padding-left: 12px;
    padding-right: 12px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .recipe-buttons {
    grid-template-columns: 1fr;
  }

  .recipe-tooltip {
    display: none !important;
  }

  .step-card {
    padding: 10px;
  }
}

@media (max-width: 520px) {
  .flow-title {
    font-size: 13px;
  }

  .badge-auto,
  .btn-clear-steps,
  .run-state-ok,
  .run-state-pause,
  .run-state-warn {
    font-size: 11px;
  }

  .step-top {
    align-items: flex-start;
  }

  .step-info {
    flex-wrap: wrap;
  }

  .btn-add-recipe {
    min-height: 44px;
    font-size: 13px;
  }

  .loop-count {
    width: 100%;
    margin-left: 0;
  }
}
</style>
