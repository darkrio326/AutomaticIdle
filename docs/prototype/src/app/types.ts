export type ResourceType = 'gold' | 'ironOre' | 'ironIngot' | 'ironSword';
export type StepType = 'mine' | 'smelt' | 'forge' | 'sell';

export interface StepDefinition {
  type: StepType;
  name: string;
  baseTime: number; // ms
  cost?: Partial<Record<ResourceType, number>>;
  yield?: Partial<Record<ResourceType, number>>;
  expYield: number;
}

export const STEP_DEFINITIONS: Record<StepType, StepDefinition> = {
  mine: {
    type: 'mine',
    name: '采矿',
    baseTime: 1500,
    yield: { ironOre: 1 },
    expYield: 2,
  },
  smelt: {
    type: 'smelt',
    name: '熔炼',
    baseTime: 2500,
    cost: { ironOre: 2 },
    yield: { ironIngot: 1 },
    expYield: 5,
  },
  forge: {
    type: 'forge',
    name: '锻造',
    baseTime: 4000,
    cost: { ironIngot: 2 },
    yield: { ironSword: 1 },
    expYield: 15,
  },
  sell: {
    type: 'sell',
    name: '出售',
    baseTime: 1000,
    cost: { ironSword: 1 },
    yield: { gold: 50 },
    expYield: 10,
  }
};

export interface ProcessStep {
  id: string;
  type: StepType;
  executionCount: number;
  repeatCount: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export type Resources = Record<ResourceType, number>;

export interface Upgrades {
  mineSpeed: number; // Level
  smeltSpeed: number;
  forgeSpeed: number;
  sellValue: number;
}
