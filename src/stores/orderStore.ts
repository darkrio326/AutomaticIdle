import { defineStore } from 'pinia';
import type { ActiveOrder, OrderTemplate, GameConfig } from '@/core/types';
import type { OrderSlotSnapshot } from '@/services/saveService';
import orderTemplatesData from '@/config/ordersTemplate.json';

const SLOT_COUNT = 3;
const SUBMIT_COOLDOWN_MS = 10_000;   // 10s after submit
const DELETE_COOLDOWN_MS = 120_000;  // 2min after discard
const EXPIRE_COOLDOWN_MS = 30_000;   // 30s after expire

export interface SlotState {
  slotIndex: number;
  order: ActiveOrder | null;
  cooldownEndsAt: number | null;
}

let instanceSeed = 0;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedRandom(templates: OrderTemplate[]): OrderTemplate {
  const total = templates.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of templates) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return templates[templates.length - 1];
}

function generateOrder(
  template: OrderTemplate,
  gameConfig: GameConfig,
  now: number,
): ActiveOrder {
  const requirements = template.requirementPool.map((p) => ({
    resourceId: p.resourceId,
    amount: randInt(p.min, p.max),
  }));
  const rewards = template.rewardPool.map((p) => ({
    resourceId: p.resourceId,
    amount: randInt(p.min, p.max),
  }));
  const durationMs =
    randInt(template.durationSeconds.min, template.durationSeconds.max) * 1000;
  const mainReqId = template.requirementPool[0]?.resourceId ?? '';
  const mainResourceName = gameConfig.resources[mainReqId]?.name ?? '物资';
  const rarityLabel: Record<string, string> = {
    common: '普通',
    uncommon: '收购',
    rare: '急需',
  };
  const storyTitle = template.titlePool && template.titlePool.length > 0
    ? template.titlePool[randInt(0, template.titlePool.length - 1)]
    : null;
  const name = storyTitle ?? `${rarityLabel[template.rarity] ?? ''}${mainResourceName}订单`;

  return {
    instanceId: `ord_${now}_${instanceSeed++}`,
    templateId: template.id,
    name,
    rarity: template.rarity,
    requirements,
    rewards,
    expiresAt: now + durationMs,
    createdAt: now,
  };
}

export const useOrderStore = defineStore('order', {
  state: (): {
    slots: SlotState[];
    _timerId: number | null;
  } => ({
    slots: Array.from({ length: SLOT_COUNT }, (_, i): SlotState => ({
      slotIndex: i,
      order: null,
      cooldownEndsAt: null,
    })),
    _timerId: null,
  }),

  getters: {
    activeOrderCount(): number {
      const now = Date.now();
      return this.slots.filter((s) => s.order !== null && s.order.expiresAt > now).length;
    },

    getOrderByInstanceId(): (instanceId: string) => ActiveOrder | null {
      return (instanceId: string) => {
        for (const slot of this.slots) {
          if (slot.order?.instanceId === instanceId) return slot.order;
        }
        return null;
      };
    },

    getSlotInfo(): (
      slotIndex: number,
      now: number,
    ) => {
      status: 'active' | 'expired' | 'cooldown' | 'empty';
      order: ActiveOrder | null;
      cooldownRemainMs: number;
    } {
      return (slotIndex: number, now: number) => {
        const slot = this.slots[slotIndex];
        if (!slot) return { status: 'empty', order: null, cooldownRemainMs: 0 };

        if (slot.order) {
          const status = slot.order.expiresAt > now ? 'active' : 'expired';
          return { status, order: slot.order, cooldownRemainMs: 0 };
        }
        if (slot.cooldownEndsAt !== null && slot.cooldownEndsAt > now) {
          return {
            status: 'cooldown',
            order: null,
            cooldownRemainMs: slot.cooldownEndsAt - now,
          };
        }
        return { status: 'empty', order: null, cooldownRemainMs: 0 };
      };
    },

    getSnapshotSlots(): OrderSlotSnapshot[] {
      return this.slots.map((s) => ({
        slotIndex: s.slotIndex,
        order: s.order,
        cooldownEndsAt: s.cooldownEndsAt,
      }));
    },
  },

  actions: {
    tick(gameConfig: GameConfig): void {
      const now = Date.now();
      const templates = orderTemplatesData as OrderTemplate[];

      for (const slot of this.slots) {
        // Expire active orders
        if (slot.order !== null && slot.order.expiresAt <= now) {
          slot.order = null;
          slot.cooldownEndsAt = now + EXPIRE_COOLDOWN_MS;
        }
        // Clear ended cooldowns
        if (
          slot.order === null &&
          slot.cooldownEndsAt !== null &&
          slot.cooldownEndsAt <= now
        ) {
          slot.cooldownEndsAt = null;
        }
        // Fill empty slots
        if (slot.order === null && slot.cooldownEndsAt === null) {
          const template = weightedRandom(templates);
          slot.order = generateOrder(template, gameConfig, now);
        }
      }
    },

    startTick(gameConfig: GameConfig): void {
      if (this._timerId !== null) return;
      this.tick(gameConfig);
      this._timerId = window.setInterval(() => this.tick(gameConfig), 1000);
    },

    stopTick(): void {
      if (this._timerId !== null) {
        window.clearInterval(this._timerId);
        this._timerId = null;
      }
    },

    completeOrder(instanceId: string): void {
      const slot = this.slots.find((s) => s.order?.instanceId === instanceId);
      if (!slot) return;
      slot.order = null;
      slot.cooldownEndsAt = Date.now() + SUBMIT_COOLDOWN_MS;
    },

    deleteOrder(instanceId: string): void {
      const slot = this.slots.find((s) => s.order?.instanceId === instanceId);
      if (!slot) return;
      slot.order = null;
      slot.cooldownEndsAt = Date.now() + DELETE_COOLDOWN_MS;
    },

    refreshOrder(instanceId: string, gameConfig: GameConfig): void {
      const slot = this.slots.find((s) => s.order?.instanceId === instanceId);
      if (!slot) return;
      const now = Date.now();
      const templates = orderTemplatesData as OrderTemplate[];
      const template = weightedRandom(templates);
      slot.order = generateOrder(template, gameConfig, now);
      slot.cooldownEndsAt = null;
    },

    restoreFromSnapshot(slots: OrderSlotSnapshot[]): void {
      const now = Date.now();
      for (const saved of slots) {
        const slot = this.slots[saved.slotIndex];
        if (!slot) continue;
        if (saved.order !== null && saved.order.expiresAt > now) {
          slot.order = saved.order;
          slot.cooldownEndsAt = null;
        } else {
          slot.order = null;
          slot.cooldownEndsAt =
            saved.cooldownEndsAt !== null && saved.cooldownEndsAt > now
              ? saved.cooldownEndsAt
              : null;
        }
      }
    },
  },
});
