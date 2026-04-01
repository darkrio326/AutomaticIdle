<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { clearSaveSnapshot } from '@/services/saveService';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();
const route = useRoute();

type ExecViewMode = 'active' | 'empty' | 'standby';

interface ExecViewSnapshot {
  mode: ExecViewMode;
  statusLabel: 'running' | 'paused' | 'idle';
  gps: string;
  stepIndex: number;
  stepCount: number;
  repeatCurrent: number;
  repeatTotal: number;
  recipeName: string;
  recipeTime: number;
  inputs: Array<{ resourceId: string; amount: number }>;
  outputs: Array<{ resourceId: string; amount: number }>;
  stepProgress: number;
  loopCount: number;
  isFast: boolean;
}

function buildLiveSnapshot(): ExecViewSnapshot {
  const statusLabel: 'running' | 'paused' | 'idle' =
    !runtimeStore.isRunning && !runtimeStore.isPaused
      ? 'idle'
      : runtimeStore.isPaused
        ? 'paused'
        : 'running';

  const steps = flowStore.steps;
  const stepCount = steps.length;
  const mode: ExecViewMode =
    stepCount === 0
      ? 'empty'
      : runtimeStore.isRunning || runtimeStore.isPaused
        ? 'active'
        : 'standby';

  const step = steps[runtimeStore.stepIndex];
  const recipe = step ? flowStore.gameConfig.recipes[step.recipeId] : null;

  return {
    mode,
    statusLabel,
    gps: flowStore.displayGps.toFixed(2),
    stepIndex: runtimeStore.stepIndex,
    stepCount,
    repeatCurrent: runtimeStore.repeatProgress + 1,
    repeatTotal: step?.repeat ?? 1,
    recipeName: recipe?.name ?? '—',
    recipeTime: recipe?.timeSeconds ?? 0,
    inputs: recipe?.inputs?.map((x) => ({ ...x })) ?? [],
    outputs: recipe?.outputs?.map((x) => ({ ...x })) ?? [],
    stepProgress: Math.round(runtimeStore.stepProgressRatio * 100),
    loopCount: runtimeStore.loopCount,
    isFast: (recipe?.timeSeconds ?? 1) < 1,
  };
}

const viewState = computed(() => {
  return buildLiveSnapshot();
});

const showDebugTools = computed(() => route.query.debug === '1');

function onClearSave(): void {
  clearSaveSnapshot();
  window.location.reload();
}

function onToggleGlobalPause(): void {
  if (runtimeStore.isRunning) {
    runtimeStore.pause();
    return;
  }
  if (runtimeStore.isPaused) {
    runtimeStore.resume();
  }
}

function formatResourceAmount(resourceId: string, amount: number): string {
  const name = flowStore.gameConfig.resources[resourceId]?.name ?? resourceId;
  return `${name} x ${amount}`;
}
</script>

<template>
  <div class="exec-view">
    <!-- 装饰性背景圆环 -->
    <div class="bg-circles" aria-hidden="true">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
    </div>

    <div class="exec-inner">
      <!-- 顶部：实时收益 + 状态 -->
      <div class="exec-header">
        <div class="gps-block">
          <div class="gps-label">实时收益</div>
          <div class="gps-value">
            <span class="gps-number">{{ viewState.gps }}</span>
            <span class="gps-unit">G/s</span>
          </div>
        </div>
        <div class="status-block">
          <span class="status-dot" :class="viewState.statusLabel"></span>
          <span class="status-text">
            <template v-if="viewState.statusLabel === 'running'">运行中</template>
            <template v-else-if="viewState.statusLabel === 'paused'">已暂停</template>
            <template v-else>待机</template>
          </span>
        </div>
      </div>

      <!-- 中部：执行动画区域 -->
      <div class="exec-center">
        <!-- 有流程时 -->
        <template v-if="viewState.mode === 'active'">
          <div class="exec-badge">
            <span class="exec-badge-dot"></span>
            正在执行 ({{ viewState.stepIndex + 1 }}/{{ viewState.stepCount }})
            <template v-if="viewState.repeatTotal > 1">
              — 循环 {{ viewState.repeatCurrent }}/{{ viewState.repeatTotal }}
            </template>
          </div>

          <div class="exec-card">
            <div class="exec-step-name">{{ viewState.recipeName }}</div>
            <div class="exec-step-time">{{ viewState.recipeTime }}s / 次</div>

            <div class="exec-io">
              <div v-if="viewState.inputs.length > 0" class="io-line io-input">
                <span class="io-label">消耗:</span>
                <span class="io-values">
                  <span v-for="(item, idx) in viewState.inputs" :key="`in-${item.resourceId}-${idx}`">
                    {{ formatResourceAmount(item.resourceId, item.amount) }}<span v-if="idx < viewState.inputs.length - 1">；</span>
                  </span>
                </span>
              </div>
              <div v-if="viewState.outputs.length > 0" class="io-line io-output">
                <span class="io-label">产出:</span>
                <span class="io-values">
                  <span v-for="(item, idx) in viewState.outputs" :key="`out-${item.resourceId}-${idx}`">
                    {{ formatResourceAmount(item.resourceId, item.amount) }}<span v-if="idx < viewState.outputs.length - 1">；</span>
                  </span>
                </span>
              </div>
            </div>

            <!-- 进度条 -->
            <div class="progress-track">
              <!-- 快速配方（< 1s）：持续前行扫描条，不归零 -->
              <div v-if="viewState.isFast" class="progress-fill progress-fill--sweep"></div>
              <!-- 普通配方：按进度填充 -->
              <div
                v-else
                class="progress-fill"
                :style="{ width: viewState.stepProgress + '%' }"
              ></div>
              <!-- 刻度线（普通配方才显示） -->
              <div v-if="!viewState.isFast" class="progress-ticks" aria-hidden="true">
                <div class="tick" v-for="i in 4" :key="i"></div>
              </div>
            </div>
            <div class="progress-labels">
              <span>0%</span>
              <span v-if="viewState.isFast" class="label-fast">快速循环</span>
              <span v-else>{{ viewState.stepProgress }}%</span>
            </div>
          </div>
        </template>

        <!-- 空闲/未启动时 -->
        <template v-else-if="viewState.mode === 'empty'">
          <div class="exec-empty">
            <div class="exec-empty-icon">⚙</div>
            <p>流程未配置，系统无法运转</p>
            <p class="exec-empty-sub">请在左侧添加步骤</p>
          </div>
        </template>

        <!-- 有流程但未运行 -->
        <template v-else>
          <div class="exec-empty">
            <div class="exec-empty-icon">▶</div>
            <p>系统待机中</p>
            <p class="exec-empty-sub">添加步骤后将自动运行</p>
          </div>
        </template>
      </div>

      <!-- 底部：循环计数 + 状态提示 -->
      <div class="exec-footer">
        <div v-if="viewState.mode === 'active' || viewState.statusLabel === 'paused' || viewState.loopCount > 0" class="loop-badge">
          已循环 <span class="loop-num">{{ viewState.loopCount }}</span> 次
        </div>
        <div v-if="viewState.statusLabel === 'running'" class="status-ok">
          ✓ 系统运转中
        </div>
        <div v-else-if="viewState.statusLabel === 'paused'" class="status-pause">
          ⏸ 已暂停
        </div>
      </div>

      <!-- Debug 行 -->
      <div v-if="showDebugTools" class="debug-row">
        <span class="debug-label">debug</span>
        <button
          class="debug-btn debug-btn-freeze"
          :class="{ 'is-active': runtimeStore.isPaused }"
          :disabled="!runtimeStore.isRunning && !runtimeStore.isPaused"
          @click="onToggleGlobalPause"
        >
          {{ runtimeStore.isPaused ? '整体继续' : '整体暂停' }}
        </button>
        <button class="debug-btn" @click="onClearSave">清空存档</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exec-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0B0F19;
  overflow: hidden;
}

/* 装饰背景圆环 */
.bg-circles {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.08;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  border: 1px solid;
}

.circle-1 {
  width: 320px;
  height: 320px;
  border-color: var(--indigo);
  animation: spin-slow 12s linear infinite;
}

.circle-2 {
  width: 220px;
  height: 220px;
  border-color: var(--cyan);
  border-style: dashed;
  animation: spin-slow 18s linear infinite reverse;
}

@keyframes spin-slow {
  to { transform: rotate(360deg); }
}

.exec-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
}

/* 顶部收益栏 */
.exec-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.gps-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.gps-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.gps-number {
  font-size: 42px;
  font-weight: 900;
  font-family: monospace;
  color: var(--amber);
  line-height: 1;
  text-shadow: 0 0 24px rgba(251, 191, 36, 0.3);
  letter-spacing: -1px;
}

.gps-unit {
  font-size: 14px;
  color: var(--text-dim);
  font-weight: 500;
}

.status-block {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.running {
  background: var(--emerald);
  box-shadow: 0 0 8px var(--emerald);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.status-dot.paused {
  background: var(--amber);
}

.status-dot.idle {
  background: var(--text-dim);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-text {
  font-size: 12px;
  color: var(--text-muted);
}

/* 中部执行区 */
.exec-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.exec-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #a5b4fc;
  background: var(--bg-card);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--r-full);
  padding: 4px 12px;
  margin-bottom: 20px;
}

.exec-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--indigo);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.exec-card {
  width: 100%;
  max-width: 380px;
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  padding: 28px 28px 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.exec-step-name {
  text-align: center;
  font-size: 28px;
  font-weight: 900;
  color: white;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  margin-bottom: 4px;
}

.exec-step-time {
  text-align: center;
  font-size: 12px;
  font-family: monospace;
  color: var(--text-dim);
  margin-bottom: 12px;
}

.exec-io {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-50);
  background: rgba(15, 23, 42, 0.45);
}

.io-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
}

.io-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
  flex-shrink: 0;
}

.io-values {
  color: var(--text);
  font-family: monospace;
}

.io-input .io-values {
  color: var(--amber);
}

.io-output .io-values {
  color: var(--emerald);
}

/* 进度条 */
.progress-track {
  position: relative;
  height: 14px;
  background: var(--bg-panel);
  border-radius: var(--r-full);
  overflow: hidden;
  border: 1px solid var(--border);
}

.progress-fill {
  height: 100%;
  background: var(--indigo);
  border-radius: var(--r-full);
  transition: width 0.08s linear;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
}

/* 快速配方扫描条（< 1s）*/
.progress-fill--sweep {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--indigo) 0%,
    var(--indigo) 25%,
    rgba(99, 102, 241, 0.4) 50%,
    var(--indigo) 75%,
    var(--indigo) 100%
  );
  background-size: 200% 100%;
  animation: progress-flow 1.4s ease-in-out infinite;
}
@keyframes progress-flow {
  0%, 100% { background-position: 0% 0; }
  50%      { background-position: 100% 0; }
}

.label-fast {
  color: var(--cyan);
  font-style: italic;
}

.progress-ticks {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  padding: 0 2px;
  pointer-events: none;
}

.tick {
  width: 1px;
  background: rgba(100, 116, 139, 0.4);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  font-family: monospace;
  color: var(--text-dim);
}

/* 空状态 */
.exec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
}

.exec-empty-icon {
  font-size: 48px;
  opacity: 0.3;
  margin-bottom: 4px;
}

.exec-empty p {
  font-size: 14px;
  color: var(--text-muted);
}

.exec-empty-sub {
  font-size: 12px;
  color: var(--text-dim) !important;
}

/* 底部状态栏 */
.exec-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 16px;
}

.loop-badge {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-full);
  padding: 4px 14px;
}

.loop-num {
  font-family: monospace;
  color: var(--text);
  font-weight: 700;
}

.status-ok {
  font-size: 13px;
  font-weight: 500;
  color: var(--emerald);
  background: var(--emerald-bg);
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: var(--r-full);
  padding: 6px 18px;
}

.status-pause {
  font-size: 13px;
  font-weight: 500;
  color: var(--amber);
  background: var(--amber-bg);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--r-full);
  padding: 6px 18px;
}

.debug-row {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.debug-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.debug-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--red);
  background: var(--red-bg);
  border: 1px solid rgba(248, 113, 113, 0.32);
  border-radius: var(--r-sm);
  padding: 6px 10px;
}

.debug-btn:hover {
  background: rgba(248, 113, 113, 0.24);
}

.debug-btn-freeze {
  color: var(--amber);
  background: var(--amber-bg);
  border-color: rgba(251, 191, 36, 0.32);
}

.debug-btn-freeze:hover {
  background: rgba(251, 191, 36, 0.24);
}

.debug-btn-freeze.is-active {
  color: var(--emerald);
  background: var(--emerald-bg);
  border-color: rgba(52, 211, 153, 0.32);
}

.debug-btn-freeze:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .exec-inner {
    padding: 16px 14px calc(16px + env(safe-area-inset-bottom));
  }

  .exec-header {
    display: none;
  }

  .gps-number {
    font-size: 34px;
  }

  .exec-card {
    max-width: none;
    padding: 22px 18px 18px;
  }

  .exec-step-name {
    font-size: 24px;
  }

  .exec-footer,
  .debug-row {
    flex-wrap: wrap;
  }

  .debug-label {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 520px) {
  .exec-inner {
    padding-left: 12px;
    padding-right: 12px;
  }

  .gps-number {
    font-size: 30px;
  }

  .gps-unit,
  .status-text,
  .exec-badge,
  .loop-badge,
  .status-ok,
  .status-pause,
  .debug-btn {
    font-size: 11px;
  }

  .exec-step-name {
    font-size: 20px;
  }

  .io-line {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}
</style>
