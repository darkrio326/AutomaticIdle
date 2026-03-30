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
    <h1>AutomaticIdle</h1>
    <FlowEditor />
  </div>
</template>
