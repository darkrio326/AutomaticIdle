<script setup lang="ts">
import { onMounted } from 'vue';
import FlowEditor from '@/components/FlowEditor.vue';
import { useRuntimeStore } from '@/stores/runtimeStore';

const runtimeStore = useRuntimeStore();

onMounted(() => {
  runtimeStore.initEngine();
});
</script>

<template>
  <div id="root">
    <header class="app-header">
      <h1>AutomaticIdle</h1>
      <span class="header-sub">放置生产链游戏</span>
    </header>
    <FlowEditor />
  </div>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.header-sub {
  font-size: 0.82rem;
  color: var(--muted-foreground);
}
</style>
