<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DebugPanel from '@/components/DebugPanel.vue';
import FlowEditor from '@/components/FlowEditor.vue';
import ExecutionView from '@/components/ExecutionView.vue';
import NewPlayerGuide from '@/components/NewPlayerGuide.vue';
import StatusPanel from '@/components/StatusPanel.vue';
import { useRuntimeStore } from '@/stores/runtimeStore';
import { useFlowStore } from '@/stores/flowStore';
import { useOrderStore } from '@/stores/orderStore';
import { flushGameStay, trackGameEnter } from '@/services/analyticsService';

type MobilePanel = 'flow' | 'runtime' | 'status';

const runtimeStore = useRuntimeStore();
const flowStore = useFlowStore();
const orderStore = useOrderStore();
const route = useRoute();
const activeMobilePanel = ref<MobilePanel>('flow');
const showDebugPanel = computed(() => route.query.debug === '1');
const panelCenterStackRef = ref<HTMLElement | null>(null);
const centerSplitRatio = ref(0.68);

let draggingCenterSplit = false;
let activeCenterSplitPointerId: number | null = null;

const CENTER_SPLIT_MIN_MAIN = 220;
const CENTER_SPLIT_MIN_DEBUG = 170;
const CENTER_SPLIT_HANDLE_HEIGHT = 10;
const GUIDE_AUTO_HIDE_SECONDS = 3;

function clampCenterSplitRatio(ratio: number): number {
  const el = panelCenterStackRef.value;
  if (!el) return Math.min(0.82, Math.max(0.45, ratio));
  const usable = Math.max(1, el.clientHeight - CENTER_SPLIT_HANDLE_HEIGHT);
  const minRatio = Math.min(0.9, CENTER_SPLIT_MIN_MAIN / usable);
  const maxRatio = Math.max(0.2, 1 - CENTER_SPLIT_MIN_DEBUG / usable);
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

function updateCenterSplitByClientY(clientY: number): void {
  const el = panelCenterStackRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const usable = Math.max(1, rect.height - CENTER_SPLIT_HANDLE_HEIGHT);
  const rawTop = clientY - rect.top;
  const minTop = Math.min(CENTER_SPLIT_MIN_MAIN, usable - 1);
  const maxTop = Math.max(minTop, usable - CENTER_SPLIT_MIN_DEBUG);
  const top = Math.min(maxTop, Math.max(minTop, rawTop));
  centerSplitRatio.value = clampCenterSplitRatio(top / usable);
}

function onCenterSplitPointerMove(event: PointerEvent): void {
  if (!draggingCenterSplit) return;
  if (activeCenterSplitPointerId !== null && event.pointerId !== activeCenterSplitPointerId) return;
  event.preventDefault();
  updateCenterSplitByClientY(event.clientY);
}

function onCenterSplitPointerUp(event?: PointerEvent): void {
  if (!draggingCenterSplit) return;
  if (event && activeCenterSplitPointerId !== null && event.pointerId !== activeCenterSplitPointerId) return;
  draggingCenterSplit = false;
  activeCenterSplitPointerId = null;
  window.removeEventListener('pointermove', onCenterSplitPointerMove);
  window.removeEventListener('pointerup', onCenterSplitPointerUp);
  window.removeEventListener('pointercancel', onCenterSplitPointerUp);
}

function onCenterSplitPointerDown(event: PointerEvent): void {
  event.preventDefault();
  activeCenterSplitPointerId = event.pointerId;
  draggingCenterSplit = true;
  updateCenterSplitByClientY(event.clientY);
  window.addEventListener('pointermove', onCenterSplitPointerMove, { passive: false });
  window.addEventListener('pointerup', onCenterSplitPointerUp);
  window.addEventListener('pointercancel', onCenterSplitPointerUp);
}

const panelCenterMainStyle = computed(() => ({
  flexBasis: `${Math.round(clampCenterSplitRatio(centerSplitRatio.value) * 100)}%`,
}));

const panelCenterDebugStyle = computed(() => ({
  flexBasis: `${Math.round((1 - clampCenterSplitRatio(centerSplitRatio.value)) * 100)}%`,
}));

const mobileStatusText = computed(() => {
  if (runtimeStore.isRunning) return '运行中';
  if (runtimeStore.isPaused) return '已暂停';
  if (flowStore.steps.length === 0) return '流程为空';
  return '已停机';
});

const mobileStatusClass = computed(() => {
  if (runtimeStore.isRunning) return 'mobile-runtime-chip--running';
  if (runtimeStore.isPaused) return 'mobile-runtime-chip--paused';
  return 'mobile-runtime-chip--idle';
});

const mobileGpsDeltaText = computed(() => {
  const delta = runtimeStore.currentGpsDeltaFromBest;
  if (Math.abs(delta) < 0.005) return '与最佳持平';
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} G/s`;
});

const guideDismissed = ref(false);
const guideAutoHidden = ref(false);
const guideCountdownLeft = ref<number | null>(null);
let guideCountdownTimer: ReturnType<typeof setInterval> | null = null;

const hasGuideRequiredFlow = computed(() => {
  let hasGather = false;
  let hasCraft = false;
  let hasSell = false;

  for (const step of flowStore.steps) {
    const recipe = flowStore.gameConfig.recipes[step.recipeId];
    if (!recipe) continue;
    if (recipe.category === 'gather') hasGather = true;
    if (recipe.category === 'craft') hasCraft = true;
    if (recipe.category === 'sell') hasSell = true;
  }

  return hasGather && hasCraft && hasSell;
});

const hasGoldGrowth = computed(() => (flowStore.playerState.inventory.gold ?? 0) > 0);
const guideCompletionReached = computed(() => hasGuideRequiredFlow.value || hasGoldGrowth.value);

const showNewPlayerGuide = computed(() => {
  if (guideDismissed.value || guideAutoHidden.value) return false;
  if (!guideCompletionReached.value) return true;
  return guideCountdownLeft.value != null;
});

function clearGuideCountdown(): void {
  if (guideCountdownTimer) {
    clearInterval(guideCountdownTimer);
    guideCountdownTimer = null;
  }
}

function startGuideCountdown(): void {
  if (guideCountdownTimer || guideDismissed.value || guideAutoHidden.value) return;

  guideCountdownLeft.value = GUIDE_AUTO_HIDE_SECONDS;
  guideCountdownTimer = setInterval(() => {
    const next = (guideCountdownLeft.value ?? 0) - 1;
    if (next <= 0) {
      guideCountdownLeft.value = null;
      guideAutoHidden.value = true;
      clearGuideCountdown();
      return;
    }
    guideCountdownLeft.value = next;
  }, 1000);
}

watch(guideCompletionReached, (reached) => {
  if (!reached || guideDismissed.value || guideAutoHidden.value) {
    clearGuideCountdown();
    guideCountdownLeft.value = null;
    return;
  }
  startGuideCountdown();
}, { immediate: true });

function switchMobilePanel(panel: MobilePanel): void {
  activeMobilePanel.value = panel;
}

function jumpToFlowPanel(): void {
  switchMobilePanel('flow');
}

function dismissGuide(): void {
  guideDismissed.value = true;
  guideCountdownLeft.value = null;
  clearGuideCountdown();
}

function handlePageHide(): void {
  flushGameStay();
}

onMounted(() => {
  trackGameEnter();
  window.addEventListener('pagehide', handlePageHide);

  // 恢复建筑 / 工具 / 订单持久化状态
  flowStore.initBuildingsFromSnapshot();
  flowStore.initToolsFromSnapshot();
  flowStore.initOrdersFromSnapshot();

  // 启动引擎 + 订单计时器
  runtimeStore.initEngine();
  runtimeStore.start();
  orderStore.startTick(flowStore.gameConfig);
});

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', handlePageHide);
  clearGuideCountdown();
  onCenterSplitPointerUp();
  flushGameStay();
});
</script>

<template>
  <div class="app-layout">
    <div class="mobile-panel-nav">
      <NewPlayerGuide
        v-if="showNewPlayerGuide"
        mode="mobile"
        :countdown-left="guideCountdownLeft"
        @go-flow="jumpToFlowPanel"
        @acknowledge="dismissGuide"
      />
      <div class="mobile-runtime-bar">
        <div class="mobile-runtime-metric">
          <span class="mobile-runtime-label">实时收益</span>
          <span class="mobile-runtime-value">
            {{ runtimeStore.currentStableGps.toFixed(2) }}
            <span class="mobile-runtime-unit">G/s</span>
          </span>
          <span class="mobile-runtime-sub">
            本机历史最佳 {{ runtimeStore.localBestGps.toFixed(2) }} · {{ mobileGpsDeltaText }}
          </span>
        </div>
        <div class="mobile-runtime-chip" :class="mobileStatusClass">
          {{ mobileStatusText }}
        </div>
      </div>
      <button
        class="mobile-panel-tab"
        :class="{ 'mobile-panel-tab--active': activeMobilePanel === 'flow' }"
        @click="switchMobilePanel('flow')"
      >流程</button>
      <button
        class="mobile-panel-tab"
        :class="{ 'mobile-panel-tab--active': activeMobilePanel === 'runtime' }"
        @click="switchMobilePanel('runtime')"
      >运行</button>
      <button
        class="mobile-panel-tab"
        :class="{ 'mobile-panel-tab--active': activeMobilePanel === 'status' }"
        @click="switchMobilePanel('status')"
      >状态</button>
    </div>

    <!-- 左：流程编辑区 -->
    <div
      class="panel panel-left"
      :class="{ 'panel-mobile-hidden': activeMobilePanel !== 'flow' }"
    >
      <FlowEditor />
    </div>
    <!-- 中：实时运行区 -->
    <div
      class="panel panel-center"
      :class="{ 'panel-mobile-hidden': activeMobilePanel !== 'runtime' }"
    >
      <div ref="panelCenterStackRef" class="panel-center-stack">
        <div class="panel-center-main" :style="showDebugPanel ? panelCenterMainStyle : undefined">
          <ExecutionView
            :show-new-player-guide="showNewPlayerGuide"
            :guide-countdown-left="guideCountdownLeft"
            @acknowledge-guide="dismissGuide"
          />
        </div>
        <div
          v-if="showDebugPanel"
          class="panel-center-split-handle"
          title="拖拽调整运行面板和调试面板高度"
          @pointerdown="onCenterSplitPointerDown"
        >
          <span class="panel-center-split-dot"></span>
        </div>
        <DebugPanel
          v-if="showDebugPanel"
          class="panel-center-debug"
          :style="panelCenterDebugStyle"
          :embedded="true"
        />
      </div>
    </div>
    <!-- 右：状态面板 -->
    <div
      class="panel panel-right"
      :class="{ 'panel-mobile-hidden': activeMobilePanel !== 'status' }"
    >
      <StatusPanel />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100dvh;
  width: 100%;
  background: var(--bg-root);
  overflow: hidden;
}

.mobile-panel-nav {
  display: none;
}

.mobile-runtime-bar {
  display: none;
}

.panel {
  height: 100%;
  overflow: hidden;
}

.panel-left {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
}

.panel-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.panel-center-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-center-main {
  flex: 0 0 auto;
  min-height: 0;
}

.panel-center-split-handle {
  height: 10px;
  flex-shrink: 0;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.panel-center-split-dot {
  width: 56px;
  height: 4px;
  border-radius: var(--r-full);
  background: rgba(148, 163, 184, 0.45);
  box-shadow: 0 0 0 1px rgba(51, 65, 85, 0.5) inset;
}

.panel-center-split-handle:hover .panel-center-split-dot {
  background: rgba(99, 102, 241, 0.6);
}

.panel-center-debug {
  min-height: 0;
  overflow: auto;
  flex-shrink: 0;
  border-top: 1px solid var(--border);
}

.panel-right {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  overflow-y: auto;
  overflow-x: hidden;
}

@media (max-width: 900px) {
  .app-layout {
    flex-direction: column;
    overscroll-behavior: none;
  }

  .mobile-panel-nav {
    display: grid;
    position: sticky;
    top: 0;
    z-index: 8;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-areas:
      'guide guide guide'
      'bar bar bar'
      'flow runtime status';
    gap: 9px;
    padding: calc(8px + env(safe-area-inset-top)) 12px 10px;
    border-bottom: 1px solid var(--border);
    background: rgba(11, 15, 25, 0.94);
    backdrop-filter: blur(10px);
    flex-shrink: 0;
  }

  .mobile-runtime-bar {
    grid-area: bar;
      :deep(.newbie-guide--mobile) {
        grid-area: guide;
      }

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 11px;
    border: 1px solid rgba(51, 65, 85, 0.72);
    border-radius: var(--r-lg);
    background: rgba(15, 23, 42, 0.96);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }

  .mobile-runtime-metric {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .mobile-runtime-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .mobile-runtime-value {
    font-size: 24px;
    line-height: 1.05;
    font-weight: 900;
    letter-spacing: -0.03em;
    font-family: monospace;
    color: var(--amber);
    text-shadow: 0 0 18px rgba(251, 191, 36, 0.22);
  }

  .mobile-runtime-sub {
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .mobile-runtime-unit {
    margin-left: 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .mobile-runtime-chip {
    flex-shrink: 0;
    min-height: 32px;
    padding: 7px 12px;
    border-radius: var(--r-full);
    font-size: 12px;
    font-weight: 700;
    border: 1px solid var(--border);
    color: var(--text-muted);
    background: var(--bg-card-50);
  }

  .mobile-runtime-chip--running {
    color: var(--emerald);
    background: var(--emerald-bg);
    border-color: rgba(52, 211, 153, 0.32);
  }

  .mobile-runtime-chip--paused {
    color: var(--amber);
    background: var(--amber-bg);
    border-color: rgba(251, 191, 36, 0.32);
  }

  .mobile-runtime-chip--idle {
    color: var(--text-dim);
    background: var(--bg-card-50);
    border-color: rgba(51, 65, 85, 0.8);
  }

  .mobile-panel-tab:nth-of-type(1) {
    grid-area: flow;
  }

  .mobile-panel-tab:nth-of-type(2) {
    grid-area: runtime;
  }

  .mobile-panel-tab:nth-of-type(3) {
    grid-area: status;
  }

  .mobile-panel-tab {
    min-height: 44px;
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    background: var(--bg-card-50);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 700;
    touch-action: manipulation;
  }

  .mobile-panel-tab--active {
    border-color: rgba(99, 102, 241, 0.5);
    background: var(--indigo-bg);
    color: var(--text);
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.14) inset;
  }

  .panel {
    width: 100%;
    min-width: 0;
    border: 0;
    height: auto;
    flex: 1;
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .panel-left,
  .panel-right {
    width: 100%;
    border: 0;
  }

  .panel-mobile-hidden {
    display: none;
  }
}

@media (max-width: 520px) {
  .mobile-runtime-bar {
    padding: 8px 10px;
    gap: 10px;
  }

  .mobile-runtime-value {
    font-size: 21px;
  }

  .mobile-runtime-unit,
  .mobile-runtime-chip {
    font-size: 11px;
  }
}

/* ── 全局消息提示 ── */
</style>
