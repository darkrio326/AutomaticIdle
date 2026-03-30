<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';
import { useOrderStore } from '@/stores/orderStore';
import type { ActiveOrder } from '@/core/types';
import BuildingPanel from './BuildingPanel.vue';
import ToolPanel from './ToolPanel.vue';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();
const orderStore = useOrderStore();

const ordersExpanded = ref(true);

/** 订单时钟刷新 */
const now = ref(Date.now());
let nowTimer: number | null = null;
onMounted(() => { nowTimer = window.setInterval(() => { now.value = Date.now(); }, 1000); });
onUnmounted(() => { if (nowTimer !== null) window.clearInterval(nowTimer); });

const slotInfos = computed(() =>
  [0, 1, 2].map((i) => orderStore.getSlotInfo(i, now.value))
);

const activeOrderCount = computed(() =>
  slotInfos.value.filter((s) => s.status === 'active').length
);

function canSubmitOrder(order: ActiveOrder): boolean {
  for (const req of order.requirements) {
    if ((flowStore.playerState.inventory[req.resourceId] ?? 0) < req.amount) return false;
  }
  return true;
}

function rarityLabel(rarity: string): string {
  return { common: '普通', uncommon: '稀有', rare: '极少' }[rarity] ?? rarity;
}

function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s >= 60) return `${Math.floor(s / 60)}m${s % 60}s`;
  return `${s}s`;
}

/** 资源显示顺序 */
const RESOURCE_ORDER = ['gold', 'iron_ore', 'iron_ingot', 'iron_sword'];

const currentInventory = computed(() => {
  return (runtimeStore.isRunning || runtimeStore.isPaused)
    ? runtimeStore.liveInventory
    : flowStore.playerState.inventory;
});

function calcActualRecipeTimeSeconds(recipeId: string): number {
  const recipe = flowStore.gameConfig.recipes[recipeId];
  if (!recipe) return 0;

  let skillMultiplier = 1;
  if (recipe.requiredSkillId != null) {
    const skillConfig = flowStore.gameConfig.skills[recipe.requiredSkillId];
    const skillState = flowStore.playerState.skills[recipe.requiredSkillId];
    if (skillConfig && skillState) {
      skillMultiplier =
        1 - (skillState.level - 1) * skillConfig.timeReductionPerLevel;
    }
  }

  return Math.max(0, recipe.timeSeconds * skillMultiplier);
}

const flowRateMap = computed(() => {
  const rates: Record<string, number> = {};
  const involved: Record<string, boolean> = {};
  const steps = flowStore.steps;
  if (steps.length === 0) {
    return { rates, involved };
  }

  let totalTimeSeconds = 0;
  const netDelta: Record<string, number> = {};

  for (const step of steps) {
    const recipe = flowStore.gameConfig.recipes[step.recipeId];
    if (!recipe) continue;

    const repeat = Math.max(1, step.repeat);
    totalTimeSeconds += calcActualRecipeTimeSeconds(recipe.id) * repeat;

    for (const input of recipe.inputs) {
      involved[input.resourceId] = true;
      netDelta[input.resourceId] = (netDelta[input.resourceId] ?? 0) - input.amount * repeat;
    }
    for (const output of recipe.outputs) {
      involved[output.resourceId] = true;
      netDelta[output.resourceId] = (netDelta[output.resourceId] ?? 0) + output.amount * repeat;
    }
  }

  if (totalTimeSeconds <= 0) {
    return { rates, involved };
  }

  for (const resourceId of Object.keys(involved)) {
    rates[resourceId] = (netDelta[resourceId] ?? 0) / totalTimeSeconds;
  }

  return { rates, involved };
});

const displayInventory = computed(() => {
  const inv = currentInventory.value;
  const isRuntimeActive = runtimeStore.isRunning || runtimeStore.isPaused;
  return RESOURCE_ORDER.map((id) => ({
    // 金币在运行中直接复用引擎 GPS，确保与中间「实时收益」一致。
    effectiveRate:
      id === 'gold' && isRuntimeActive
        ? flowStore.displayGps
        : (flowRateMap.value.rates[id] ?? 0),
    id,
    name: flowStore.gameConfig.resources[id]?.name ?? id,
    amount: inv[id] ?? 0,
    showRate:
      id === 'gold' && isRuntimeActive
        ? true
        : Boolean(flowRateMap.value.involved[id]),
    isGold: id === 'gold',
  }));
});

function formatRate(rate: number): string {
  if (rate === 0) return '0/s';
  const sign = rate > 0 ? '+' : '';
  const rounded = Math.round(rate);
  if (Math.abs(rate - rounded) <= 0.005) {
    return `${sign}${Math.abs(rounded)}/s`;
  }
  return `${sign}${Math.abs(rate).toFixed(2)}/s`;
}

function formatCost(costs: Array<{ resourceId: string; amount: number }>): string {
  return costs.map((c) => {
    const name = flowStore.gameConfig.resources[c.resourceId]?.name ?? c.resourceId;
    return `${name} ×${c.amount}`;
  }).join(' / ');
}

function formatResources(items: Array<{ resourceId: string; amount: number }>): string {
  if (!items || items.length === 0) return '无';
  return items.map((x) => {
    const name = flowStore.gameConfig.resources[x.resourceId]?.name ?? x.resourceId;
    return `${name} ×${x.amount}`;
  }).join(' / ');
}

function formatUnlocks(items: Array<{ type: string; id: string }>): string {
  if (!items || items.length === 0) return '';
  return items.map((x) => {
    if (x.type === 'recipe') {
      return `解锁配方: ${flowStore.gameConfig.recipes[x.id]?.name ?? x.id}`;
    }
    return x.id;
  }).join(', ');
}
</script>

<template>
  <div class="status-panel">

    <!-- ── 资源库存 ── -->
    <section class="panel-section">
      <div class="section-header">
        <span class="section-icon">◈</span>
        <h3 class="section-title">资源库存</h3>
      </div>
      <div class="inv-grid">
        <div
          v-for="res in displayInventory"
          :key="res.id"
          class="inv-card"
          :class="{ 'inv-gold': res.isGold }"
        >
          <div class="inv-name">{{ res.name }}</div>
          <div class="inv-amount-row">
            <div class="inv-amount">{{ res.amount.toLocaleString() }}</div>
            <div
              v-if="res.showRate"
              class="inv-rate"
              :class="{ 'inv-rate-plus': res.effectiveRate > 0, 'inv-rate-minus': res.effectiveRate < 0 }"
            >
              ({{ formatRate(res.effectiveRate) }})
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 技能经验 ── -->
    <section class="panel-section">
      <div class="section-header">
        <span class="section-icon">✦</span>
        <h3 class="section-title">技能成长</h3>
      </div>
      <div class="skills-list">
        <div v-for="skill in flowStore.skillItems" :key="skill.id" class="skill-card">
          <div class="skill-header">
            <div class="skill-name">{{ skill.name }}</div>
            <div class="skill-meta">
              <span class="skill-level">Lv.{{ skill.level }}</span>
              <span class="skill-bonus">-{{ skill.skillBonusPercent.toFixed(0) }}% 耗时</span>
            </div>
          </div>
          <div class="exp-track">
            <div class="exp-fill" :style="{ width: skill.progressPercent + '%' }"></div>
          </div>
          <div class="exp-label">
            <template v-if="skill.requiredExp > 0">
              {{ Math.floor(skill.exp) }} / {{ skill.requiredExp }} EXP
            </template>
            <template v-else>已满级</template>
          </div>
          <!-- 显示工具加速 -->
          <div v-if="skill.applicableTools.length > 0" class="tool-info">
            <div class="tool-label">工具加速:</div>
            <div class="tool-list">
              <span v-for="tool in skill.applicableTools" :key="tool.toolId" class="tool-item">
                {{ tool.name }} ({{ (tool.timeMultiplier * 100).toFixed(0) }}%)
              </span>
            </div>
          </div>
          <!-- 显示总体效率加成 -->
          <div class="skill-total-bonus">
            <strong>总效率加成: {{ skill.combinedBonusPercent.toFixed(1) }}%</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 建筑系统 ── -->
    <BuildingPanel />

    <!-- ── 工具系统 ── -->
    <ToolPanel />

    <!-- ── 订单任务 ── -->
    <section class="panel-section">
      <div class="section-header orders-toggle" @click="ordersExpanded = !ordersExpanded">
        <span class="section-icon">📋</span>
        <h3 class="section-title">订单任务</h3>
        <span class="orders-count">{{ activeOrderCount }} 进行中</span>
        <span class="toggle-arrow" :class="{ expanded: ordersExpanded }">›</span>
      </div>
      <div v-if="ordersExpanded" class="orders-list">
        <p v-if="flowStore.errorMessage" class="msg-tip">{{ flowStore.errorMessage }}</p>
        <div v-for="slot in slotInfos" :key="slot.slotIndex" class="order-slot">
          <!-- 冷却中 -->
          <div v-if="slot.status === 'cooldown'" class="order-slot-wait">
            <span class="slot-wait-icon">⏳</span>
            <span class="slot-wait-text">下个订单 {{ formatTime(slot.cooldownRemainMs ?? 0) }}</span>
          </div>
          <!-- 空插槽 / 生成中 -->
          <div v-else-if="slot.status === 'empty'" class="order-slot-wait">
            <span class="slot-wait-icon">…</span>
            <span class="slot-wait-text">生成新订单中</span>
          </div>
          <!-- 已过期 -->
          <div v-else-if="slot.status === 'expired' && slot.order" class="order-card order-expired">
            <div class="order-header">
              <span class="order-name">{{ slot.order.name }}</span>
              <span class="order-rarity" :class="'rarity-' + slot.order.rarity">{{ rarityLabel(slot.order.rarity) }}</span>
            </div>
            <div class="order-row"><span class="order-label">订单已过期</span></div>
            <div class="order-actions">
              <button class="btn-order-discard" @click="flowStore.deleteOrder(slot.order.instanceId)">删除</button>
            </div>
          </div>
          <!-- 活跃订单 -->
          <div v-else-if="slot.status === 'active' && slot.order" class="order-card">
            <div class="order-header">
              <span class="order-name">{{ slot.order.name }}</span>
              <span class="order-rarity" :class="'rarity-' + slot.order.rarity">{{ rarityLabel(slot.order.rarity) }}</span>
            </div>
            <div class="order-row">
              <span class="order-label">需求:</span>
              <span class="order-val">{{ formatResources(slot.order.requirements) }}</span>
            </div>
            <div class="order-row">
              <span class="order-label">奖励:</span>
              <span class="order-val order-reward">{{ formatResources(slot.order.rewards) }}</span>
            </div>
            <div class="order-row">
              <span class="order-label">剩余:</span>
              <span
                class="order-val"
                :class="{ 'order-expiring': slot.order.expiresAt - now < 60_000 }"
              >{{ formatTime(slot.order.expiresAt - now) }}</span>
            </div>
            <div class="order-actions">
              <button
                class="btn-order"
                :disabled="!canSubmitOrder(slot.order)"
                @click="flowStore.submitOrder(slot.order.instanceId)"
              >提交</button>
              <button class="btn-order-discard" @click="flowStore.deleteOrder(slot.order.instanceId)">丢弃</button>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.status-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  padding: 16px;
  gap: 0;
  min-height: 100%;
}

/* ── 通用 section ── */
.panel-section {
  border-bottom: 1px solid var(--border);
  padding-bottom: 16px;
  margin-bottom: 16px;
}

.panel-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.section-icon {
  font-size: 12px;
  color: var(--text-dim);
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
}

/* ── 库存网格 ── */
.inv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.inv-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.inv-gold {
  background: rgba(120, 53, 15, 0.2);
  border-color: rgba(251, 191, 36, 0.35);
}

.inv-name {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.inv-amount {
  font-size: 18px;
  font-weight: 800;
  font-family: monospace;
  color: white;
  letter-spacing: -0.5px;
}

.inv-amount-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.inv-rate {
  font-size: 10px;
  font-family: monospace;
  color: var(--text-dim);
}

.inv-rate-plus {
  color: var(--emerald);
}

.inv-rate-minus {
  color: var(--red);
}

.inv-gold .inv-amount {
  color: var(--amber);
}

/* ── 技能 ── */
.skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-card {
  background: var(--bg-card-50);
  border: 1px solid var(--border-50);
  border-radius: var(--r-md);
  padding: 10px 12px;
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.skill-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}

.skill-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.skill-level {
  font-size: 11px;
  font-weight: 700;
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--r-sm);
  padding: 1px 6px;
}

.skill-bonus {
  font-size: 10px;
  color: var(--emerald);
  background: var(--emerald-bg);
  border-radius: var(--r-sm);
  padding: 1px 5px;
}

.exp-track {
  height: 5px;
  background: var(--bg-panel);
  border-radius: var(--r-full);
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.2);
  margin-bottom: 4px;
}

.exp-fill {
  height: 100%;
  background: var(--indigo);
  border-radius: var(--r-full);
  box-shadow: 0 0 6px rgba(99, 102, 241, 0.6);
  transition: width 0.3s ease;
}

.exp-label {
  font-size: 10px;
  font-family: monospace;
  color: var(--text-dim);
  text-align: right;
}

.tool-info {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-50);
}

.tool-label {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 4px;
  font-weight: 500;
}

.tool-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool-item {
  font-size: 10px;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.skill-total-bonus {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-50);
  font-size: 11px;
  color: var(--emerald);
  text-align: right;
}

/* ── 升级 ── */
/* ── 订单 ── */
.orders-toggle {
  cursor: pointer;
  margin-bottom: 8px;
  user-select: none;
}

.orders-toggle:hover .section-title {
  color: var(--text-muted);
}

.orders-count {
  font-size: 10px;
  color: var(--text-dim);
  margin-left: auto;
}

.toggle-arrow {
  font-size: 16px;
  color: var(--text-dim);
  transform: rotate(0deg);
  transition: transform 0.2s;
}

.toggle-arrow.expanded {
  transform: rotate(90deg);
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 10px 12px;
}

.order-done {
  opacity: 0.5;
}

.order-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}

.order-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 3px;
}

.order-label {
  font-size: 10px;
  color: var(--text-dim);
  flex-shrink: 0;
  padding-top: 1px;
}

.order-val {
  font-size: 11px;
  color: var(--text-muted);
}

.order-val.unlock {
  color: #a5b4fc;
}

.order-completed {
  font-size: 11px;
  color: var(--emerald);
  margin-top: 6px;
  font-weight: 600;
}

.btn-order {
  width: 100%;
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--indigo-bg);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: var(--r-sm);
}

.btn-order:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.25);
  color: white;
}

.btn-order:disabled {
  background: var(--bg-card-50);
  color: var(--text-dim);
  border-color: var(--border-50);
}

/* ── 动态订单插槽 ── */
.order-slot {
  display: flex;
  flex-direction: column;
}

.order-slot-wait {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-card-50);
  border: 1px dashed var(--border-50);
  border-radius: var(--r-md);
  color: var(--text-dim);
}

.slot-wait-icon { font-size: 12px; }

.slot-wait-text {
  font-size: 11px;
  color: var(--text-dim);
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.order-rarity {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rarity-common { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100,116,139,0.3); }
.rarity-uncommon { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
.rarity-rare { background: rgba(168, 85, 247, 0.15); color: #c4b5fd; border: 1px solid rgba(168,85,247,0.3); }

.order-reward { color: var(--emerald); }

.order-expiring { color: var(--red); font-weight: 700; }

.order-expired { opacity: 0.6; border-color: rgba(239,68,68,0.3); }

.order-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.order-actions .btn-order {
  flex: 1;
  margin-top: 0;
}

.btn-order-discard {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
}

.btn-order-discard:hover {
  background: rgba(239, 68, 68, 0.18);
  color: #fee2e2;
}
</style>
