#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const resources = readJson('src/config/resources.json');
const recipes = readJson('src/config/recipes.json');
const sells = readJson('src/config/sells.json');
const buildings = readJson('src/config/buildings.json');
const orderTemplates = readJson('src/config/ordersTemplate.json');

const recipeMap = Object.fromEntries([...recipes, ...sells].map((x) => [x.id, x]));
const resourceMap = Object.fromEntries(resources.map((x) => [x.id, x]));

const HORIZON_SECONDS = 20 * 60;
const ORDER_SAMPLE = 400;

function createRng(seed = 20260402) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
}

function weightedPick(items, weightFn, rand) {
  const weighted = items.map((item) => ({ item, w: Math.max(0.0001, weightFn(item)) }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let r = rand() * total;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.item;
  }
  return weighted[weighted.length - 1].item;
}

function buildInitialState() {
  return {
    inventory: {
      gold: 0,
      iron_ore: 0,
      iron_ingot: 0,
      iron_sword: 0,
      copper_ore: 0,
      copper_ingot: 0,
      coal_ore: 0,
      steel_ingot: 0,
    },
    purchasedBuildings: new Set(),
  };
}

function calcMaintenancePerSecond(purchasedBuildings) {
  let total = 0;
  for (const id of purchasedBuildings) {
    total += Math.max(0, buildings[id]?.maintenanceGoldPerSecond ?? 0);
  }
  return total;
}

function canAffordCost(inventory, cost) {
  return Object.entries(cost).every(([rid, amount]) => (inventory[rid] ?? 0) >= amount);
}

function payCost(inventory, cost) {
  for (const [rid, amount] of Object.entries(cost)) {
    inventory[rid] = (inventory[rid] ?? 0) - amount;
  }
}

function executeRecipe(inventory, recipe) {
  for (const input of recipe.inputs) {
    if ((inventory[input.resourceId] ?? 0) < input.amount) return false;
  }
  for (const input of recipe.inputs) {
    inventory[input.resourceId] = (inventory[input.resourceId] ?? 0) - input.amount;
  }
  for (const output of recipe.outputs) {
    inventory[output.resourceId] = (inventory[output.resourceId] ?? 0) + output.amount;
  }
  return true;
}

function getFlowOutputRate(flowSteps) {
  const out = {};
  const totalTime = flowSteps.reduce((s, step) => {
    const recipe = recipeMap[step.recipeId];
    return s + (recipe?.timeSeconds ?? 0) * Math.max(1, step.repeat);
  }, 0);
  if (totalTime <= 0) return out;

  for (const step of flowSteps) {
    const recipe = recipeMap[step.recipeId];
    if (!recipe) continue;
    for (const item of recipe.outputs) {
      out[item.resourceId] = (out[item.resourceId] ?? 0) + (item.amount * step.repeat) / totalTime;
    }
  }
  return out;
}

function estimateOrderCompletionRate(flowRates, strategyTag) {
  const rand = createRng(strategyTag.length * 131 + 7);
  let completable = 0;
  let highValueCompletable = 0;
  let highValueTotal = 0;

  for (let i = 0; i < ORDER_SAMPLE; i += 1) {
    const tpl = weightedPick(orderTemplates, (x) => x.weight, rand);
    const req = tpl.requirementPool[0];
    const requiredAmount = req.min + Math.floor(rand() * (req.max - req.min + 1));
    const avgDuration = (tpl.durationSeconds.min + tpl.durationSeconds.max) / 2;
    const potential = (flowRates[req.resourceId] ?? 0) * avgDuration;
    const ok = potential >= requiredAmount * 0.7;
    if (ok) completable += 1;
    if (tpl.highValue) {
      highValueTotal += 1;
      if (ok) highValueCompletable += 1;
    }
  }

  return {
    completionRate: completable / ORDER_SAMPLE,
    highValueCompletionRate: highValueTotal > 0 ? highValueCompletable / highValueTotal : 0,
  };
}

const strategies = [
  {
    id: 'baseline_iron_ingot',
    name: '基线铁锭循环',
    flow: [
      { recipeId: 'mine_iron', repeat: 2 },
      { recipeId: 'smelt_iron', repeat: 1 },
      { recipeId: 'sell_iron_ingot', repeat: 1 },
    ],
    buildingPlan: [],
  },
  {
    id: 'armory_sword_focus',
    name: '铁匠铺铁剑循环',
    flow: [
      { recipeId: 'mine_iron', repeat: 10 },
      { recipeId: 'smelt_iron', repeat: 5 },
      { recipeId: 'craft_iron_sword', repeat: 1 },
      { recipeId: 'sell_iron_sword', repeat: 1 },
    ],
    buildingPlan: ['blacksmith_shop'],
  },
  {
    id: 'copper_chain',
    name: '铜链路扩展循环',
    flow: [
      { recipeId: 'mine_iron', repeat: 6 },
      { recipeId: 'smelt_iron', repeat: 3 },
      { recipeId: 'sell_iron_ingot', repeat: 3 },
      { recipeId: 'mine_copper', repeat: 6 },
      { recipeId: 'smelt_copper', repeat: 3 },
    ],
    buildingPlan: ['copper_mine'],
  },
  {
    id: 'steel_scale',
    name: '钢链路规模化循环',
    flow: [
      { recipeId: 'mine_iron', repeat: 8 },
      { recipeId: 'smelt_iron', repeat: 5 },
      { recipeId: 'mine_coal', repeat: 4 },
      { recipeId: 'smelt_steel', repeat: 3 },
      { recipeId: 'sell_iron_ingot', repeat: 2 },
    ],
    buildingPlan: ['coal_mine', 'steel_furnace'],
  },
];

function simulateStrategy(strategy) {
  const state = buildInitialState();
  const enabledRecipes = new Set(
    [...recipes, ...sells].filter((x) => x.enabled !== false).map((x) => x.id),
  );

  let flowIndex = 0;
  let stepRepeatProgress = 0;
  let stepProgressSeconds = 0;
  let stoppedSeconds = 0;
  let hardStopAt = null;
  let cumulativeNetGold = 0;
  let paybackSeconds = null;
  let totalBuildingCostInGold = 0;

  for (const buildingId of strategy.buildingPlan) {
    const cfg = buildings[buildingId];
    if (!cfg) continue;
    totalBuildingCostInGold += cfg.cost.gold ?? 0;
    for (const rid of Object.keys(cfg.cost)) {
      state.inventory[rid] = (state.inventory[rid] ?? 0) + (cfg.cost[rid] ?? 0);
    }
    if (canAffordCost(state.inventory, cfg.cost)) {
      payCost(state.inventory, cfg.cost);
      state.purchasedBuildings.add(buildingId);
      for (const recipeId of cfg.unlock?.recipes ?? []) enabledRecipes.add(recipeId);
    }
  }

  for (let t = 1; t <= HORIZON_SECONDS; t += 1) {
    const maintenance = calcMaintenancePerSecond(state.purchasedBuildings);
    const goldBefore = state.inventory.gold ?? 0;
    if (maintenance > 0 && goldBefore < maintenance) {
      state.inventory.gold = 0;
      stoppedSeconds += 1;
      if (hardStopAt == null) hardStopAt = t;
      continue;
    }
    if (maintenance > 0) {
      state.inventory.gold = Math.max(0, goldBefore - maintenance);
    }

    const step = strategy.flow[flowIndex];
    const recipe = recipeMap[step.recipeId];
    if (!recipe || !enabledRecipes.has(recipe.id)) {
      stoppedSeconds += 1;
      continue;
    }

    stepProgressSeconds += 1;
    if (stepProgressSeconds < Math.max(0.1, recipe.timeSeconds)) {
      continue;
    }

    const executed = executeRecipe(state.inventory, recipe);
    stepProgressSeconds = 0;
    if (!executed) {
      stoppedSeconds += 1;
      continue;
    }

    stepRepeatProgress += 1;
    if (stepRepeatProgress >= Math.max(1, step.repeat)) {
      stepRepeatProgress = 0;
      flowIndex = (flowIndex + 1) % strategy.flow.length;
    }

    const netGold = state.inventory.gold - goldBefore;
    cumulativeNetGold += netGold;
    if (paybackSeconds == null && totalBuildingCostInGold > 0 && cumulativeNetGold >= totalBuildingCostInGold) {
      paybackSeconds = t;
    }
  }

  const netGps = (state.inventory.gold ?? 0) / HORIZON_SECONDS;
  const flowRates = getFlowOutputRate(strategy.flow.filter((x) => enabledRecipes.has(x.recipeId)));
  const orders = estimateOrderCompletionRate(flowRates, strategy.id);

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    netGps,
    stoppedRatio: stoppedSeconds / HORIZON_SECONDS,
    bankruptAtSeconds: hardStopAt,
    orderCompletionRate: orders.completionRate,
    highValueOrderCompletionRate: orders.highValueCompletionRate,
    paybackSeconds,
    finalGold: state.inventory.gold ?? 0,
    maintenancePerSecond: calcMaintenancePerSecond(state.purchasedBuildings),
  };
}

function fmtPct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtSec(v) {
  if (v == null) return '未回本';
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${m}m${s}s`;
}

function toMarkdown(results, generatedAt) {
  const sorted = [...results].sort((a, b) => b.netGps - a.netGps);
  const lines = [];
  lines.push('# v0.3 调优报告（ITER-038）');
  lines.push('');
  lines.push(`生成时间：${generatedAt}`);
  lines.push(`仿真时长：${HORIZON_SECONDS}s`);
  lines.push('');
  lines.push('## 策略对比');
  lines.push('');
  lines.push('| 策略 | 净收益(G/s) | 停工率 | 订单完成率 | 高价值订单完成率 | 回本时间 | 维护费(G/s) |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const row of sorted) {
    lines.push(`| ${row.strategyName} | ${row.netGps.toFixed(2)} | ${fmtPct(row.stoppedRatio)} | ${fmtPct(row.orderCompletionRate)} | ${fmtPct(row.highValueOrderCompletionRate)} | ${fmtSec(row.paybackSeconds)} | ${row.maintenancePerSecond.toFixed(2)} |`);
  }
  lines.push('');
  lines.push('## 结论建议');
  lines.push('');
  const best = sorted[0];
  lines.push(`- 当前净收益最佳策略：${best.strategyName}（${best.netGps.toFixed(2)} G/s）。`);
  const safest = [...sorted].sort((a, b) => a.stoppedRatio - b.stoppedRatio)[0];
  lines.push(`- 停工风险最低策略：${safest.strategyName}（停工率 ${fmtPct(safest.stoppedRatio)}）。`);
  const orderBest = [...sorted].sort((a, b) => b.orderCompletionRate - a.orderCompletionRate)[0];
  lines.push(`- 订单完成率最佳策略：${orderBest.strategyName}（${fmtPct(orderBest.orderCompletionRate)}）。`);
  lines.push('- 建议优先调低“高停工率策略”的建筑维护费，或提升其对应订单回报区间。');
  return `${lines.join('\n')}\n`;
}

function main() {
  const results = strategies.map(simulateStrategy);
  const generatedAt = new Date().toISOString();

  const outDir = path.join(root, 'reports', 'tuning');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `balance-${stamp}.json`);
  const mdPath = path.join(outDir, `balance-${stamp}.md`);
  const latestJsonPath = path.join(outDir, 'latest-balance-report.json');
  const latestMdPath = path.join(outDir, 'latest-balance-report.md');

  const payload = {
    generatedAt,
    horizonSeconds: HORIZON_SECONDS,
    orderSample: ORDER_SAMPLE,
    results,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const markdown = toMarkdown(results, generatedAt);
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(latestMdPath, markdown, 'utf8');

  console.log('调优报告已生成:');
  console.log(`- ${path.relative(root, latestMdPath)}`);
  console.log(`- ${path.relative(root, latestJsonPath)}`);
}

main();