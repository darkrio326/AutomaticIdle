<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useFlowStore } from '@/stores/flowStore';
import { useRuntimeStore } from '@/stores/runtimeStore';
import { useOrderStore } from '@/stores/orderStore';
import { useBuildingStore } from '@/stores/buildingStore';
import {
  loadSaveSnapshot,
  saveSnapshot,
  exportSaveTransferString,
  parseSaveTransferString,
} from '@/services/saveService';
import { trackPrestigeConfirm } from '@/services/analyticsService';
import type { ActiveOrder } from '@/core/types';
import BuildingPanel from './BuildingPanel.vue';
import ToolPanel from './ToolPanel.vue';

const flowStore = useFlowStore();
const runtimeStore = useRuntimeStore();
const orderStore = useOrderStore();
const buildingStore = useBuildingStore();

const ordersExpanded = ref(true);
const skillsExpanded = ref(true);
const toolsExpanded = ref(true);
const buildingsExpanded = ref(true);
const prestigeExpanded = ref(true);
const saveTransferExpanded = ref(false);
const saveTransferText = ref('');
const saveTransferMessage = ref('');
const saveTransferMessageIsSuccess = ref(true);
const expandedSkillIds = ref<string[]>([]);

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

const slotGuidances = computed(() =>
  slotInfos.value.map((slot) => {
    if (!slot.order) return null;
    return orderStore.getOrderGuidance(slot.order, flowStore.gameConfig);
  }),
);

const toolCount = computed(() => Object.keys(flowStore.gameConfig.tools ?? {}).length);
const buildingCount = computed(() => Object.keys(flowStore.gameConfig.buildings ?? {}).length);

const orderMessage = computed(() => {
  const msg = flowStore.errorMessage || '';
  return msg.startsWith('订单') ? msg : '';
});

const orderMessageIsSuccess = computed(() => {
  const msg = orderMessage.value;
  return msg.includes('成功') || msg.includes('完成');
});

const prestigeMessage = computed(() => {
  const msg = flowStore.errorMessage || '';
  return msg.startsWith('重开') ? msg : '';
});

const prestigeMessageIsSuccess = computed(() => prestigeMessage.value.includes('成功'));

const showEconomySummary = computed(() =>
  runtimeStore.currentMaintenancePerSecond > 0 || Boolean(runtimeStore.economyWarningText),
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

/** 资源显示基础顺序 */
const BASE_RESOURCE_ORDER = ['gold', 'iron_ore', 'iron_ingot'];

const currentInventory = computed(() => {
  return (runtimeStore.isRunning || runtimeStore.isPaused)
    ? runtimeStore.liveInventory
    : flowStore.playerState.inventory;
});

const inventoryResourceIds = computed(() => {
  const ids: string[] = [];
  const seen = new Set<string>();

  const pushId = (id: string) => {
    if (!id || seen.has(id)) return;
    if (!flowStore.gameConfig.resources[id]) return;
    seen.add(id);
    ids.push(id);
  };

  // 先保证核心资源顺序稳定
  BASE_RESOURCE_ORDER.forEach(pushId);

  // 建筑解锁的新资源即使当前为 0 也展示
  buildingStore.getUnlockedResourceIds(flowStore.gameConfig).forEach(pushId);

  // 库存里已出现过的其他资源也展示（兼容后续扩展）
  Object.entries(currentInventory.value).forEach(([id, amount]) => {
    if ((amount ?? 0) > 0) pushId(id);
  });

  return ids;
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
  return inventoryResourceIds.value.map((id) => ({
    // 金币在运行中直接复用引擎 GPS，确保与中间「实时收益」一致。
    effectiveRate:
      id === 'gold' && isRuntimeActive
        ? runtimeStore.currentStableGps
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

function formatInventoryAmount(resourceId: string, amount: number): string {
  if (resourceId === 'gold') {
    // 维护费按秒连续扣减会产生小数，金币库存展示统一按整数口径避免抖动。
    return Math.floor(Math.max(0, amount)).toLocaleString();
  }
  const rounded = Math.round(amount);
  if (Math.abs(amount - rounded) <= 0.0001) {
    return rounded.toLocaleString();
  }
  return amount.toFixed(2);
}

function formatResources(items: Array<{ resourceId: string; amount: number }>): string {
  if (!items || items.length === 0) return '无';
  return items.map((x) => {
    const name = flowStore.gameConfig.resources[x.resourceId]?.name ?? x.resourceId;
    return `${name} ×${x.amount}`;
  }).join(' / ');
}

function toggleSkill(skillId: string): void {
  if (expandedSkillIds.value.includes(skillId)) {
    expandedSkillIds.value = expandedSkillIds.value.filter((id) => id !== skillId);
    return;
  }
  expandedSkillIds.value = [...expandedSkillIds.value, skillId];
}

function isSkillExpanded(skillId: string): boolean {
  return expandedSkillIds.value.includes(skillId);
}

function onPrestigeReset(): void {
  const gain = runtimeStore.techPointGain;
  if (gain <= 0) return;
  const confirmed = window.confirm(
    `确认重开本轮进度？\n将获得 +${gain} 技术点。\n建筑、工具、库存与流程会重置，但总技术点会保留。`,
  );
  if (!confirmed) return;
  trackPrestigeConfirm(gain);
  runtimeStore.prestigeReset();
}

async function onExportSaveString(): Promise<void> {
  flowStore.persistState();
  const snapshot = loadSaveSnapshot();
  if (!snapshot) {
    saveTransferMessage.value = '导出失败：当前没有可用存档。';
    saveTransferMessageIsSuccess.value = false;
    return;
  }

  const transfer = exportSaveTransferString(snapshot);
  saveTransferText.value = transfer;

  try {
    await navigator.clipboard.writeText(transfer);
    saveTransferMessage.value = '导出成功：已生成并复制存档字符串。';
    saveTransferMessageIsSuccess.value = true;
  } catch {
    saveTransferMessage.value = '导出成功：已生成存档字符串（复制失败，请手动复制）。';
    saveTransferMessageIsSuccess.value = true;
  }
}

function onImportSaveString(): void {
  const parsed = parseSaveTransferString(saveTransferText.value);
  if (!parsed.ok || !parsed.snapshot) {
    saveTransferMessage.value = `导入失败：${parsed.reason ?? '未知错误'}`;
    saveTransferMessageIsSuccess.value = false;
    return;
  }

  const snapshot = parsed.snapshot;
  const confirmed = window.confirm(
    `即将覆盖当前本地进度。\n\n导入存档：${snapshot.flowName || '未命名流程'}\n最后保存：${new Date(snapshot.lastSavedAt).toLocaleString()}\n\n确认继续导入？`,
  );
  if (!confirmed) {
    saveTransferMessage.value = '已取消导入。';
    saveTransferMessageIsSuccess.value = false;
    return;
  }

  saveSnapshot(snapshot);
  saveTransferMessage.value = '导入成功：页面即将刷新并加载新存档。';
  saveTransferMessageIsSuccess.value = true;
  window.setTimeout(() => {
    window.location.reload();
  }, 400);
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
            <div class="inv-amount">{{ formatInventoryAmount(res.id, res.amount) }}</div>
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
      <div v-if="showEconomySummary" class="economy-card">
        <div class="economy-row">
          <span class="economy-label">运行净收益</span>
          <span class="economy-value" :class="{ 'economy-value-negative': runtimeStore.currentStableGps < 0, 'economy-value-positive': runtimeStore.currentStableGps > 0 }">
            {{ formatRate(runtimeStore.currentStableGps) }}
          </span>
        </div>
        <div class="economy-row">
          <span class="economy-label">建筑维护费</span>
          <span class="economy-value economy-value-negative">{{ formatRate(-runtimeStore.currentMaintenancePerSecond) }}</span>
        </div>
        <div v-if="runtimeStore.economyWarningText" class="economy-warning">
          {{ runtimeStore.economyWarningText }}
        </div>
      </div>
    </section>

    <!-- ── 订单任务 ── -->
    <section class="panel-section">
      <div class="section-header section-header-toggle" @click="ordersExpanded = !ordersExpanded">
        <span class="section-icon">📋</span>
        <h3 class="section-title">订单</h3>
        <span class="section-count">{{ activeOrderCount }} 进行中</span>
        <span class="toggle-arrow" :class="{ expanded: ordersExpanded }">›</span>
      </div>
      <div v-if="ordersExpanded" class="orders-list">
        <div v-for="(slot, slotIndex) in slotInfos" :key="slotIndex" class="order-slot">
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
              <button class="btn-order-discard" @click="flowStore.deleteOrder(slot.order.instanceId)">删除 -10🪙</button>
            </div>
          </div>
          <!-- 活跃订单 -->
          <div v-else-if="slot.status === 'active' && slot.order" class="order-card">
            <div class="order-header">
              <span class="order-name">{{ slot.order.name }}</span>
              <div class="order-badges">
                <span v-if="slotGuidances[slotIndex]?.isHighValue" class="order-value-badge">
                  {{ slotGuidances[slotIndex]?.valueLabel }}
                </span>
                <span class="order-rarity" :class="'rarity-' + slot.order.rarity">{{ rarityLabel(slot.order.rarity) }}</span>
              </div>
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
            <div
              v-if="slotGuidances[slotIndex]"
              class="order-guide"
              :class="`order-guide-${slotGuidances[slotIndex]?.tone}`"
            >
              {{ slotGuidances[slotIndex]?.text }}
            </div>
            <div class="order-actions">
              <button
                class="btn-order"
                :disabled="!canSubmitOrder(slot.order)"
                @click="flowStore.submitOrder(slot.order.instanceId)"
              >提交</button>
              <button class="btn-order-refresh" @click="flowStore.refreshOrder(slot.order.instanceId)">刷新 -25🪙</button>
              <button class="btn-order-discard" @click="flowStore.deleteOrder(slot.order.instanceId)">丢弃 -10🪙</button>
            </div>
          </div>
        </div>
        <div
          v-if="orderMessage"
          class="panel-message"
          :class="{ 'panel-message-success': orderMessageIsSuccess, 'panel-message-error': !orderMessageIsSuccess }"
        >
          {{ orderMessage }}
        </div>
      </div>
    </section>

    <!-- ── 技能经验 ── -->
    <section class="panel-section">
      <div class="section-header section-header-toggle" @click="skillsExpanded = !skillsExpanded">
        <span class="section-icon">✦</span>
        <h3 class="section-title">技能</h3>
        <span class="section-count">{{ flowStore.skillItems.length }} 项</span>
        <span class="toggle-arrow" :class="{ expanded: skillsExpanded }">›</span>
      </div>
      <div v-if="skillsExpanded" class="skills-list">
        <button
          v-for="skill in flowStore.skillItems"
          :key="skill.id"
          type="button"
          class="skill-card"
          :class="{ 'skill-card-expanded': isSkillExpanded(skill.id) }"
          @click="toggleSkill(skill.id)"
        >
          <div class="skill-header">
            <div class="skill-name">{{ skill.name }}</div>
            <div class="skill-meta">
              <span class="skill-level">Lv.{{ skill.level }}</span>
              <span class="skill-bonus">-{{ skill.skillBonusPercent.toFixed(0) }}% 耗时</span>
              <span class="skill-toggle-arrow" :class="{ expanded: isSkillExpanded(skill.id) }">›</span>
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
                {{ tool.name }} (-{{ ((1 - tool.timeMultiplier) * 100).toFixed(0) }}% 耗时)
              </span>
            </div>
          </div>
          <!-- 显示总体效率加成 -->
          <div class="skill-total-bonus">
            <strong>当前总加成: {{ skill.combinedBonusPercent.toFixed(1) }}%</strong>
          </div>
          <div v-if="isSkillExpanded(skill.id)" class="skill-expanded">
            <div class="skill-expanded-title">配方总加成</div>
            <div v-if="skill.recipeBonuses.length > 0" class="skill-recipe-list">
              <div v-for="recipe in skill.recipeBonuses" :key="recipe.recipeId" class="skill-recipe-row">
                <span class="skill-recipe-name">{{ recipe.recipeName }}</span>
                <span class="skill-recipe-bonus">总加成：{{ recipe.combinedBonusPercent.toFixed(1) }}%</span>
              </div>
            </div>
            <div v-else class="skill-empty-detail">当前没有关联配方</div>
          </div>
        </button>
      </div>
    </section>

    <!-- ── 工具系统 ── -->
    <section class="panel-section">
      <div class="section-header section-header-toggle" @click="toolsExpanded = !toolsExpanded">
        <span class="section-icon">🔧</span>
        <h3 class="section-title">工具</h3>
        <span class="section-count">{{ toolCount }} 项</span>
        <span class="toggle-arrow" :class="{ expanded: toolsExpanded }">›</span>
      </div>
      <ToolPanel v-if="toolsExpanded" :embedded="true" />
    </section>

    <!-- ── 建筑系统 ── -->
    <section class="panel-section">
      <div class="section-header section-header-toggle" @click="buildingsExpanded = !buildingsExpanded">
        <span class="section-icon">🏛️</span>
        <h3 class="section-title">建筑</h3>
        <span class="section-count">{{ buildingCount }} 项</span>
        <span class="toggle-arrow" :class="{ expanded: buildingsExpanded }">›</span>
      </div>
      <BuildingPanel v-if="buildingsExpanded" :embedded="true" />
    </section>

    <!-- ── 再来一轮（Prestige） ── -->
    <section class="panel-section">
      <div class="section-header section-header-toggle" @click="prestigeExpanded = !prestigeExpanded">
        <span class="section-icon">⟳</span>
        <h3 class="section-title">再来一轮</h3>
        <span class="section-count">+{{ runtimeStore.techPointGain }} 技术点</span>
        <span class="toggle-arrow" :class="{ expanded: prestigeExpanded }">›</span>
      </div>

      <template v-if="prestigeExpanded">
        <div class="prestige-card">
          <div class="prestige-preview">
            当前可获得：<strong>+{{ runtimeStore.techPointGain }}</strong> 技术点
          </div>
          <div class="prestige-preview">
            当前总技术点：<strong>{{ runtimeStore.totalTechPoints }}</strong>
          </div>
          <div class="prestige-preview">
            重开后全局效率：<strong>+{{ runtimeStore.previewEfficiencyPercent.toFixed(0) }}%</strong>
          </div>

          <button
            class="btn-prestige"
            :disabled="runtimeStore.techPointGain <= 0"
            @click="onPrestigeReset"
          >
            重开本轮（保留技术点）
          </button>

          <div class="prestige-note">
            当前全局效率加成：+{{ runtimeStore.globalEfficiencyPercent.toFixed(0) }}%
          </div>
        </div>

        <div
          v-if="prestigeMessage"
          class="panel-message"
          :class="{ 'panel-message-success': prestigeMessageIsSuccess, 'panel-message-error': !prestigeMessageIsSuccess }"
        >
          {{ prestigeMessage }}
        </div>

        <div class="save-transfer-block">
          <div class="save-transfer-head" @click="saveTransferExpanded = !saveTransferExpanded">
            <span class="save-transfer-title">存档导入导出</span>
            <span class="toggle-arrow" :class="{ expanded: saveTransferExpanded }">›</span>
          </div>
          <div v-if="saveTransferExpanded" class="save-transfer-body">
            <textarea
              v-model="saveTransferText"
              class="save-transfer-input"
              placeholder="点击“导出存档字符串”生成，或粘贴字符串后点击“导入并覆盖”"
            ></textarea>
            <div class="save-transfer-actions">
              <button class="btn-save-transfer" @click="onExportSaveString">导出存档字符串</button>
              <button class="btn-save-transfer btn-save-transfer-danger" @click="onImportSaveString">导入并覆盖</button>
            </div>
            <div
              v-if="saveTransferMessage"
              class="panel-message"
              :class="{ 'panel-message-success': saveTransferMessageIsSuccess, 'panel-message-error': !saveTransferMessageIsSuccess }"
            >
              {{ saveTransferMessage }}
            </div>
          </div>
        </div>
      </template>
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
  overflow-x: hidden;
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

.section-header-toggle {
  cursor: pointer;
  user-select: none;
}

.section-header-toggle:hover .section-title,
.section-header-toggle:hover .section-count {
  color: var(--text-muted);
}

.section-count {
  font-size: 10px;
  color: var(--text-dim);
  margin-left: auto;
}

/* ── 库存网格 ── */
.inv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  min-width: 0;
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
  font-size: clamp(14px, 2.3vw, 18px);
  font-weight: 800;
  font-family: monospace;
  color: white;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.inv-amount-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  width: 100%;
  justify-content: center;
  flex-wrap: wrap;
}

.inv-rate {
  font-size: 10px;
  font-family: monospace;
  color: var(--text-dim);
  white-space: nowrap;
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

.economy-card {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  border: 1px solid rgba(251, 191, 36, 0.18);
  background: rgba(120, 53, 15, 0.14);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.economy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.economy-label {
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.economy-value {
  font-size: 12px;
  font-family: monospace;
  color: var(--text);
}

.economy-value-positive {
  color: var(--emerald);
}

.economy-value-negative {
  color: var(--red);
}

.economy-warning {
  font-size: 11px;
  color: #fcd34d;
  border-top: 1px solid rgba(251, 191, 36, 0.14);
  padding-top: 6px;
}

@media (max-width: 1260px) {
  .inv-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .status-panel {
    padding: 12px;
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }

  .panel-section {
    padding-bottom: 12px;
    margin-bottom: 12px;
  }

  .section-header {
    margin-bottom: 8px;
  }

  .inv-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .inv-card {
    padding: 9px 10px;
    border-radius: var(--r-md);
  }

  .inv-name {
    font-size: 10px;
  }

  .inv-amount {
    font-size: clamp(15px, 4.8vw, 20px);
  }

  .inv-rate {
    font-size: 10px;
  }

  .economy-card {
    margin-top: 8px;
    padding: 9px 10px;
  }

  .order-card,
  .order-slot-wait,
  .skill-card,
  .prestige-card {
    border-radius: var(--r-md);
  }

  .btn-order,
  .btn-order-refresh,
  .btn-order-discard,
  .btn-prestige,
  .btn-save-transfer {
    min-height: 36px;
  }
}

@media (max-width: 480px) {
  .inv-grid {
    grid-template-columns: 1fr;
  }
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
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.skill-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  background: var(--bg-card);
}

.skill-card-expanded {
  border-color: rgba(99, 102, 241, 0.35);
  background: var(--bg-card);
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

.skill-toggle-arrow {
  font-size: 16px;
  color: var(--text-dim);
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.skill-toggle-arrow.expanded {
  transform: rotate(90deg);
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

.skill-expanded {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-50);
}

.skill-expanded-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.skill-recipe-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-recipe-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--r-sm);
  background: rgba(15, 23, 42, 0.55);
}

.skill-recipe-name {
  font-size: 11px;
  color: var(--text);
  font-weight: 600;
}

.skill-recipe-bonus {
  font-size: 11px;
  color: var(--emerald);
  white-space: nowrap;
}

.skill-empty-detail {
  font-size: 11px;
  color: var(--text-dim);
}

.prestige-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prestige-preview {
  font-size: 12px;
  color: var(--text-muted);
}

.prestige-preview strong {
  color: var(--text);
}

.btn-prestige {
  margin-top: 2px;
  min-height: 34px;
  font-size: 12px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: var(--r-sm);
}

.btn-prestige:disabled {
  color: var(--text-dim);
  border-color: var(--border-50);
  background: var(--bg-card-50);
}

.prestige-note {
  font-size: 11px;
  color: var(--emerald);
}

.save-transfer-block {
  margin-top: 6px;
  border-top: 1px solid var(--border-50);
  padding-top: 8px;
}

.save-transfer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.save-transfer-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  font-weight: 700;
}

.save-transfer-body {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.save-transfer-input {
  width: 100%;
  min-height: 92px;
  resize: vertical;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-50);
  background: var(--bg-card-50);
  color: var(--text-muted);
  padding: 8px;
  font-size: 11px;
  font-family: monospace;
}

.save-transfer-actions {
  display: flex;
  gap: 6px;
}

.btn-save-transfer {
  flex: 1;
  min-height: 32px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.12);
  color: #a5b4fc;
  font-size: 11px;
  font-weight: 700;
}

.btn-save-transfer-danger {
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
}

/* ── 升级 ── */
/* ── 订单 ── */

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

.order-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.order-value-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(251, 191, 36, 0.14);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.28);
  letter-spacing: 0.03em;
}

.order-reward { color: var(--emerald); }

.order-expiring { color: var(--red); font-weight: 700; }

.order-guide {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: var(--r-sm);
  font-size: 11px;
  line-height: 1.4;
}

.order-guide-ready {
  background: rgba(52, 211, 153, 0.1);
  color: var(--emerald);
}

.order-guide-flow {
  background: rgba(99, 102, 241, 0.12);
  color: #a5b4fc;
}

.order-guide-suggestion {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
}

.order-guide-locked {
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

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

.btn-order-refresh {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(251, 191, 36, 0.08);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
}

.btn-order-refresh:hover {
  background: rgba(251, 191, 36, 0.18);
  color: #fef3c7;
}

.panel-message {
  margin-top: 4px;
  padding: 7px 10px;
  border-radius: var(--r-sm);
  font-size: 12px;
  border: 1px solid transparent;
}

.panel-message-success {
  background: var(--emerald-bg);
  color: var(--emerald);
  border-color: rgba(52, 211, 153, 0.28);
}

.panel-message-error {
  background: var(--red-bg);
  color: var(--red);
  border-color: rgba(248, 113, 113, 0.28);
}

@media (max-width: 900px) {
  .status-panel {
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
  }

  .inv-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .order-actions {
    flex-wrap: wrap;
  }

  .order-actions .btn-order,
  .btn-order-refresh,
  .btn-order-discard {
    min-height: 36px;
  }
}

@media (max-width: 520px) {
  .panel-section {
    padding-bottom: 12px;
    margin-bottom: 12px;
  }

  .inv-grid {
    grid-template-columns: 1fr;
  }

  .skill-header,
  .order-header,
  .section-header {
    align-items: flex-start;
  }

  .skill-header,
  .skill-meta,
  .order-actions {
    flex-wrap: wrap;
  }

  .orders-count {
    margin-left: 0;
  }

  .order-row {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
