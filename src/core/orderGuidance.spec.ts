import { describe, expect, it } from 'vitest';
import { buildOrderGuidance, getBiasedTemplateWeight, type OrderContext } from './orderGuidance';
import type { ActiveOrder, GameConfig, OrderTemplate } from './types';

function buildConfig(): GameConfig {
  return {
    resources: {
      gold: { id: 'gold', name: '金币', type: 'currency', sellPrice: -1 },
      iron_ore: { id: 'iron_ore', name: '铁矿', type: 'raw', sellPrice: 1 },
      iron_ingot: { id: 'iron_ingot', name: '铁锭', type: 'intermediate', sellPrice: 8 },
    },
    recipes: {
      mine_iron: {
        id: 'mine_iron',
        name: '开采铁矿',
        category: 'gather',
        timeSeconds: 1,
        inputs: [],
        outputs: [{ resourceId: 'iron_ore', amount: 1 }],
        expGains: [],
        enabled: true,
      },
      smelt_iron: {
        id: 'smelt_iron',
        name: '熔炼铁锭',
        category: 'craft',
        timeSeconds: 2,
        inputs: [{ resourceId: 'iron_ore', amount: 2 }],
        outputs: [{ resourceId: 'iron_ingot', amount: 1 }],
        expGains: [],
        enabled: true,
      },
    },
    skills: {},
    buildings: {},
    tools: {},
  };
}

function buildContext(overrides?: Partial<OrderContext>): OrderContext {
  const config = buildConfig();
  return {
    inventory: { gold: 0, iron_ore: 0, iron_ingot: 0, ...(overrides?.inventory ?? {}) },
    flowOutputIds: overrides?.flowOutputIds ?? new Set<string>(),
    enabledRecipes: overrides?.enabledRecipes ?? Object.values(config.recipes),
  };
}

describe('orderGuidance', () => {
  it('对当前流程已产出的资源模板给予更高权重', () => {
    const template: OrderTemplate = {
      id: 't1',
      rarity: 'common',
      weight: 10,
      requirementPool: [{ resourceId: 'iron_ingot', min: 10, max: 20 }],
      rewardPool: [{ resourceId: 'gold', min: 100, max: 200 }],
      durationSeconds: { min: 60, max: 120 },
    };

    const passiveWeight = getBiasedTemplateWeight(template, buildContext());
    const activeWeight = getBiasedTemplateWeight(
      template,
      buildContext({ flowOutputIds: new Set<string>(['iron_ingot']) }),
    );

    expect(activeWeight).toBeGreaterThan(passiveWeight);
  });

  it('在可生产但当前流程未覆盖时给出链路建议', () => {
    const config = buildConfig();
    const order: ActiveOrder = {
      instanceId: 'o1',
      templateId: 't1',
      name: '铁锭订单',
      rarity: 'uncommon',
      requirements: [{ resourceId: 'iron_ingot', amount: 12 }],
      rewards: [{ resourceId: 'gold', amount: 280 }],
      expiresAt: 0,
      createdAt: 0,
    };

    const guidance = buildOrderGuidance(order, config, buildContext(), {
      id: 't1',
      rarity: 'uncommon',
      weight: 10,
      highValue: true,
      requirementPool: [{ resourceId: 'iron_ingot', min: 10, max: 20 }],
      rewardPool: [{ resourceId: 'gold', min: 100, max: 200 }],
      durationSeconds: { min: 60, max: 120 },
    });

    expect(guidance.tone).toBe('suggestion');
    expect(guidance.text).toContain('开采铁矿');
    expect(guidance.text).toContain('熔炼铁锭');
    expect(guidance.isHighValue).toBe(true);
  });
});