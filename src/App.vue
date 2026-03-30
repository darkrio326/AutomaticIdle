<script setup lang="ts">
import { onMounted } from 'vue';
import FlowEditor from '@/components/FlowEditor.vue';
import ExecutionView from '@/components/ExecutionView.vue';
import StatusPanel from '@/components/StatusPanel.vue';
import { useRuntimeStore } from '@/stores/runtimeStore';
import { useFlowStore } from '@/stores/flowStore';
import { useOrderStore } from '@/stores/orderStore';

const runtimeStore = useRuntimeStore();
const flowStore = useFlowStore();
const orderStore = useOrderStore();

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
    <!-- 左：流程编辑区 -->
    <div class="panel panel-left">
      <FlowEditor />
    </div>
    <!-- 中：实时运行区 -->
    <div class="panel panel-center">
      <ExecutionView />
    </div>
    <!-- 右：状态面板 -->
    <div class="panel panel-right">
      <StatusPanel />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  background: var(--bg-root);
  overflow: hidden;
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
}
</style>
