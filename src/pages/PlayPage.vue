<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import FlowEditor from '@/components/FlowEditor.vue';
import ExecutionView from '@/components/ExecutionView.vue';
import StatusPanel from '@/components/StatusPanel.vue';
import { useRuntimeStore } from '@/stores/runtimeStore';
import { useFlowStore } from '@/stores/flowStore';
import { useOrderStore } from '@/stores/orderStore';

type MobilePanel = 'flow' | 'runtime' | 'status';

const runtimeStore = useRuntimeStore();
const flowStore = useFlowStore();
const orderStore = useOrderStore();
const activeMobilePanel = ref<MobilePanel>('flow');

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

function switchMobilePanel(panel: MobilePanel): void {
  activeMobilePanel.value = panel;
}

onMounted(() => {
  // 恢复建筑 / 工具 / 订单持久化状态
  flowStore.initBuildingsFromSnapshot();
  flowStore.initToolsFromSnapshot();
  flowStore.initOrdersFromSnapshot();

  // 启动引擎 + 订单计时器
  runtimeStore.initEngine();
  runtimeStore.start();
  orderStore.startTick(flowStore.gameConfig);
});
</script>

<template>
  <div class="app-layout">
    <div class="mobile-panel-nav">
      <div class="mobile-runtime-bar">
        <div class="mobile-runtime-metric">
          <span class="mobile-runtime-label">实时收益</span>
          <span class="mobile-runtime-value">
            {{ flowStore.displayGps.toFixed(2) }}
            <span class="mobile-runtime-unit">G/s</span>
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
      <ExecutionView />
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
  }

  .mobile-panel-nav {
    display: grid;
    position: sticky;
    top: 0;
    z-index: 8;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-areas:
      'bar bar bar'
      'flow runtime status';
    gap: 8px;
    padding: calc(8px + env(safe-area-inset-top)) 12px 12px;
    border-bottom: 1px solid var(--border);
    background: rgba(11, 15, 25, 0.94);
    backdrop-filter: blur(10px);
    flex-shrink: 0;
  }

  .mobile-runtime-bar {
    grid-area: bar;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
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
    min-height: 40px;
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    background: var(--bg-card-50);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 700;
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
    padding: 9px 10px;
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
