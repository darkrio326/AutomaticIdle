import { describe, expect, it } from 'vitest';
import { RuntimeEngine } from './runtimeEngine';
import { createInitialRuntimeState } from './runtimeTypes';
import type { FlowDefinition, GameConfig, PlayerState } from './types';

function buildTestConfig(): GameConfig {
  return {
    resources: {
      gold: { id: 'gold', name: '金币', type: 'currency', sellPrice: -1 },
      ore: { id: 'ore', name: '矿石', type: 'raw', sellPrice: 1 },
      ingot: { id: 'ingot', name: '锭', type: 'intermediate', sellPrice: 3 },
      gem: { id: 'gem', name: '宝石', type: 'product', sellPrice: 10 },
    },
    recipes: {
      gather_ore: {
        id: 'gather_ore',
        name: '开采矿石',
        category: 'gather',
        timeSeconds: 1,
        inputs: [],
        outputs: [{ resourceId: 'ore', amount: 1 }],
        expGains: [{ skillId: 'mining', amount: 1 }],
        requiredSkillId: 'mining',
        enabled: true,
      },
      smelt_ore: {
        id: 'smelt_ore',
        name: '熔炼矿锭',
        category: 'craft',
        timeSeconds: 2,
        inputs: [{ resourceId: 'ore', amount: 1 }],
        outputs: [{ resourceId: 'ingot', amount: 1 }],
        expGains: [{ skillId: 'smelting', amount: 1 }],
        requiredSkillId: 'smelting',
        enabled: true,
      },
      polish_gem: {
        id: 'polish_gem',
        name: '打磨宝石',
        category: 'craft',
        timeSeconds: 1,
        inputs: [],
        outputs: [{ resourceId: 'gem', amount: 1 }],
        expGains: [{ skillId: 'crafting', amount: 1 }],
        requiredSkillId: 'crafting',
        enabled: true,
      },
    },
    skills: {
      mining: {
        id: 'mining',
        name: '采矿',
        baseLevel: 1,
        timeReductionPerLevel: 0.05,
        maxLevel: 10,
        expFormula: { base: 5, exponent: 1.2 },
      },
      smelting: {
        id: 'smelting',
        name: '熔炼',
        baseLevel: 1,
        timeReductionPerLevel: 0.05,
        maxLevel: 10,
        expFormula: { base: 5, exponent: 1.2 },
      },
      crafting: {
        id: 'crafting',
        name: '加工',
        baseLevel: 1,
        timeReductionPerLevel: 0.05,
        maxLevel: 10,
        expFormula: { base: 5, exponent: 1.2 },
      },
    },
    buildings: {},
    tools: {},
  };
}

function buildPlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    inventory: {
      gold: 0,
      ore: 0,
      ingot: 0,
      gem: 0,
      ...(overrides?.inventory ?? {}),
    },
    skills: {
      mining: { skillId: 'mining', level: 1, exp: 0 },
      smelting: { skillId: 'smelting', level: 1, exp: 0 },
      crafting: { skillId: 'crafting', level: 1, exp: 0 },
      ...(overrides?.skills ?? {}),
    },
    purchasedTools: new Set<string>(),
  };
}

function buildFlow(id: string, steps: FlowDefinition['steps']): FlowDefinition {
  return {
    id,
    name: id,
    steps,
  };
}

function buildEngine(flow: FlowDefinition, playerState?: PlayerState): RuntimeEngine {
  const state = createInitialRuntimeState(playerState ?? buildPlayerState());
  state.activeFlow = flow;
  return new RuntimeEngine(state, buildTestConfig());
}

describe('RuntimeEngine core regression', () => {
  it('在单步推进后会切换到下一步骤并结算资源', () => {
    const flow = buildFlow('two-steps', [
      { recipeId: 'gather_ore', repeat: 1 },
      { recipeId: 'smelt_ore', repeat: 1 },
    ]);
    const engine = buildEngine(flow);

    const advanced = engine.stepOnce();

    expect(advanced).toBe(true);
    expect(engine.state.status).toBe('paused');
    expect(engine.state.stepIndex).toBe(1);
    expect(engine.state.playerState.inventory.ore).toBe(1);
    expect(engine.state.playerState.skills.mining.exp).toBe(1);
  });

  it('在流程跑完最后一步后会回到首步骤并累计 loopCount', () => {
    const flow = buildFlow('single-step', [
      { recipeId: 'gather_ore', repeat: 1 },
    ]);
    const engine = buildEngine(flow);

    engine.stepOnce();

    expect(engine.state.stepIndex).toBe(0);
    expect(engine.state.loopCount).toBe(1);
    expect(engine.state.playerState.inventory.ore).toBe(1);
  });

  it('在资源不足时会停机且不执行当前步骤', () => {
    const flow = buildFlow('need-resource', [
      { recipeId: 'smelt_ore', repeat: 1 },
    ]);
    const engine = buildEngine(flow, buildPlayerState({ inventory: { ore: 0 } }));

    const advanced = engine.stepOnce();

    expect(advanced).toBe(true);
    expect(engine.state.status).toBe('idle');
    expect(engine.state.stepIndex).toBe(0);
    expect(engine.state.playerState.inventory.ore).toBe(0);
    expect(engine.state.playerState.inventory.ingot).toBe(0);
  });

  it('pendingFlow 只在步骤边界生效', () => {
    const oldFlow = buildFlow('old-flow', [
      { recipeId: 'gather_ore', repeat: 1 },
      { recipeId: 'smelt_ore', repeat: 1 },
    ]);
    const newFlow = buildFlow('new-flow', [
      { recipeId: 'polish_gem', repeat: 1 },
    ]);
    const engine = buildEngine(oldFlow, buildPlayerState({ inventory: { ore: 1 } }));

    engine.setPendingFlow(newFlow);
    engine.stepOnce();

    expect(engine.state.pendingFlow).toBeNull();
    expect(engine.state.activeFlow?.id).toBe('new-flow');
    expect(engine.state.stepIndex).toBe(0);
    expect(engine.state.playerState.inventory.ore).toBe(2);
    expect(engine.state.playerState.inventory.gem).toBe(0);
  });

  it('维护费不足时会停机并清空金币', () => {
    const config = buildTestConfig();
    config.buildings = {
      workshop: {
        name: '工坊',
        cost: { gold: 10 },
        unlock: {},
        maintenanceGoldPerSecond: 2,
      },
    };

    const state = createInitialRuntimeState(buildPlayerState({ inventory: { gold: 1 } }));
    state.activeFlow = buildFlow('single-step', [{ recipeId: 'gather_ore', repeat: 1 }]);
    state.purchasedBuildingIds = ['workshop'];

    const engine = new RuntimeEngine(state, config);
    const advanced = engine.stepOnce();

    expect(advanced).toBe(true);
    expect(engine.state.status).toBe('idle');
    expect(engine.state.playerState.inventory.gold).toBe(0);
    expect(engine.state.lastStopReason).toContain('维护费不足');
  });
});