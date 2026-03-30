export type ResourceType = "currency" | "raw" | "intermediate" | "product";
export type RecipeCategory = "gather" | "craft" | "sell";

export interface ResourceAmount {
  resourceId: string;
  amount: number;
}

export interface SkillExpGain {
  skillId: string;
  amount: number;
}

export interface ResourceConfig {
  id: string;
  name: string;
  type: ResourceType;
  sellPrice: number;
  description?: string;
}

export interface RecipeConfig {
  id: string;
  name: string;
  category: RecipeCategory;
  timeSeconds: number;
  inputs: ResourceAmount[];
  outputs: ResourceAmount[];
  expGains: SkillExpGain[];
  requiredSkillId?: string;
  requiredSkillLevel?: number;
  enabled?: boolean;
}

export interface SkillConfig {
  id: string;
  name: string;
  baseLevel: number;
  timeReductionPerLevel: number;
  maxLevel: number;
  expFormula: {
    base: number;
    exponent: number;
  };
}

export interface OrderUnlock {
  type: "recipe" | "feature";
  id: string;
}

export interface OrderConfig {
  id: string;
  name: string;
  requirements: ResourceAmount[];
  rewards?: ResourceAmount[];
  unlocks?: OrderUnlock[];
  enabled?: boolean;
}

export interface BuildingUnlock {
  resources?: string[];
  recipes?: string[];
}

export interface BuildingConfig {
  name: string;
  cost: Record<string, number>;
  unlock: BuildingUnlock;
}

export interface ToolEffect {
  timeMultiplier: number;
}

export interface ToolConfig {
  name: string;
  cost: Record<string, number>;
  effects: Record<string, ToolEffect>;
  tier?: number;
}

export interface FlowStep {
  recipeId: string;
  repeat: number;
}

export interface FlowDefinition {
  id: string;
  name: string;
  steps: FlowStep[];
}

export interface SkillState {
  skillId: string;
  level: number;
  exp: number;
}

export interface PlayerState {
  inventory: Record<string, number>;
  skills: Record<string, SkillState>;
  purchasedTools?: Set<string>;
}

export interface SimulationStepResult {
  recipeId: string;
  totalExecutions: number;
  totalTime: number;
  resourceDelta: Record<string, number>;
  expDelta: Record<string, number>;
}

export interface SimulationResult {
  totalTime: number;
  totalGoldGained: number;
  goldPerSecond: number;
  finalInventory: Record<string, number>;
  resourceDelta: Record<string, number>;
  expDelta: Record<string, number>;
  stepResults: SimulationStepResult[];
  bottleneckRecipeId?: string;
}

export interface GameConfig {
  resources: Record<string, ResourceConfig>;
  recipes: Record<string, RecipeConfig>;
  skills: Record<string, SkillConfig>;
  orders: Record<string, OrderConfig>;
  buildings?: Record<string, BuildingConfig>;
  tools?: Record<string, ToolConfig>;
}