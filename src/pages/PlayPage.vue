<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
    gap: 8px;
    padding: calc(8px + env(safe-area-inset-top)) 12px 12px;
    border-bottom: 1px solid var(--border);
    background: rgba(11, 15, 25, 0.94);
    backdrop-filter: blur(10px);
    flex-shrink: 0;
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

/* ── 全局消息提示 ── */
</style>
