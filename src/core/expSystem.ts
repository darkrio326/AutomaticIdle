import type { SkillState, SkillConfig } from './types';

/**
 * 计算从当前 level 升到 level+1 所需经验。
 * 公式：base × level^exponent（向下取整）
 */
export function calcRequiredExp(
  level: number,
  formula: { base: number; exponent: number },
): number {
  return Math.floor(formula.base * Math.pow(level, formula.exponent));
}

/**
 * 给定累计总经验，计算当前等级和该等级已积累的剩余经验。
 * 从 level 1 开始逐级消耗，直到总经验不足以升下一级或达到 maxLevel。
 */
export function calcLevelFromTotalExp(
  totalExp: number,
  skillConfig: SkillConfig,
): { level: number; exp: number } {
  let level = 1;
  let remaining = totalExp;

  while (level < skillConfig.maxLevel) {
    const required = calcRequiredExp(level, skillConfig.expFormula);
    if (remaining < required) break;
    remaining -= required;
    level += 1;
  }

  return { level, exp: remaining };
}

/**
 * 将本轮经验增量应用到技能状态，返回更新后的技能状态记录（含升级）。
 * 不修改传入的 skillStates，返回新对象。
 */
export function applyExpGains(
  skillStates: Record<string, SkillState>,
  expDelta: Record<string, number>,
  skillConfigs: Record<string, SkillConfig>,
): Record<string, SkillState> {
  const result: Record<string, SkillState> = { ...skillStates };

  for (const [skillId, gained] of Object.entries(expDelta)) {
    if (gained <= 0) continue;

    const config = skillConfigs[skillId];
    if (config == null) continue;

    const current = result[skillId] ?? { skillId, level: 1, exp: 0 };
    let level = current.level;
    let exp = current.exp + gained;

    // 逐级消耗经验，直到不够升级或达到 maxLevel
    while (level < config.maxLevel) {
      const required = calcRequiredExp(level, config.expFormula);
      if (exp < required) break;
      exp -= required;
      level += 1;
    }

    // 达到 maxLevel 后多余经验不再累积
    if (level >= config.maxLevel) {
      exp = 0;
    }

    result[skillId] = { skillId, level, exp };
  }

  return result;
}
