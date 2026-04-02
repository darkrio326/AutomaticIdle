<script setup lang="ts">
interface Props {
  mode?: 'mobile' | 'desktop';
  countdownLeft?: number | null;
}

withDefaults(defineProps<Props>(), {
  mode: 'desktop',
  countdownLeft: null,
});

const emit = defineEmits<{
  (e: 'go-flow'): void;
  (e: 'acknowledge'): void;
}>();

function handleGoFlow(): void {
  emit('go-flow');
}

function handleAcknowledge(): void {
  emit('acknowledge');
}
</script>

<template>
  <section class="newbie-guide" :class="`newbie-guide--${mode}`">
    <div class="newbie-guide-header">
      <span class="newbie-guide-badge">新手引导</span>
      <div class="newbie-guide-title-row">
        <h3 class="newbie-guide-title">先搭一条最小赚钱流程</h3>
        <button
          class="newbie-guide-inline-ack"
          type="button"
          @click="handleAcknowledge"
        >
          知道了
        </button>
      </div>
      <p class="newbie-guide-desc">当前是空存档，系统还没有可执行流程。按下面 3 步先跑起来，再逐步优化。</p>
    </div>

    <ol class="newbie-guide-steps">
      <li>切到流程页，依次添加：采矿 × 2 → 熔炼 × 1 → 出售 × 1。</li>
      <li>确认流程后等待自动运行，观察实时收益和库存变化。</li>
      <li>有金币后先买基础工具，再接订单提升收益。</li>
    </ol>

    <p v-if="countdownLeft != null" class="newbie-guide-countdown">
      引导将在 {{ countdownLeft }} 秒后自动隐藏
    </p>

    <div v-if="mode === 'mobile'" class="newbie-guide-actions">
      <button
        class="newbie-guide-action"
        type="button"
        @click="handleGoFlow"
      >
        去流程页开始搭建
      </button>
    </div>
  </section>
</template>

<style scoped>
.newbie-guide {
  border: 1px solid rgba(99, 102, 241, 0.38);
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
  border-radius: var(--r-lg);
  padding: 10px 12px;
  color: var(--text);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22);
}

.newbie-guide--desktop {
  margin-bottom: 12px;
}

.newbie-guide-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.newbie-guide-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.newbie-guide-badge {
  width: fit-content;
  padding: 2px 8px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 700;
  color: #c7d2fe;
  background: rgba(67, 56, 202, 0.28);
  border: 1px solid rgba(129, 140, 248, 0.45);
}

.newbie-guide-title {
  font-size: 15px;
  line-height: 1.2;
  font-weight: 800;
}

.newbie-guide-inline-ack {
  flex-shrink: 0;
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid rgba(100, 116, 139, 0.62);
  border-radius: var(--r-full);
  background: rgba(30, 41, 59, 0.68);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.newbie-guide-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}

.newbie-guide-steps {
  margin: 8px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.newbie-guide-countdown {
  margin-top: 8px;
  font-size: 11px;
  color: #93c5fd;
}

.newbie-guide-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.newbie-guide-action {
  width: 100%;
  min-height: 38px;
  border: 1px solid rgba(129, 140, 248, 0.55);
  border-radius: var(--r-full);
  background: rgba(67, 56, 202, 0.34);
  color: #e0e7ff;
  font-size: 12px;
  font-weight: 700;
}

.newbie-guide-action:active {
  transform: translateY(1px);
}

.newbie-guide--mobile {
  grid-area: bar;
}

@media (max-width: 520px) {
  .newbie-guide {
    padding: 9px 10px;
  }

  .newbie-guide-title {
    font-size: 14px;
  }

  .newbie-guide-inline-ack {
    min-height: 24px;
    padding: 0 8px;
    font-size: 10px;
  }

  .newbie-guide-desc,
  .newbie-guide-steps,
  .newbie-guide-countdown,
  .newbie-guide-action {
    font-size: 11px;
  }

  .newbie-guide-actions {
    gap: 6px;
  }
}
</style>
