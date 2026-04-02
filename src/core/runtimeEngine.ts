/**
 * runtimeEngine.ts — Runtime 引擎核心（Phase 1）
 *
 * 职责：
 *  ITER-015  Tick 时钟驱动器 — 基于 requestAnimationFrame + deltaTime 推进
 *  ITER-016  步骤推进器 + 单步动作执行器 — 步骤进度推进与原子执行结算
 *  ITER-017  运行时资源与 EXP 结算 — 动作完成后写入 RuntimeState.playerState
 *
 * 设计约定：
 *  - 纯函数 + 可外部持有的 RuntimeState ref，不依赖 Pinia / Vue
 *  - 引擎不直接读写 localStorage，持久化由调用方（runtimeStore）负责
 *  - 流程修改通过 setPendingFlow() 写入 pendingFlow，当前步骤完成后生效
 */

import type { GameConfig, RecipeConfig } from "./types";
import type { RuntimeState } from "./runtimeTypes";
import { applyExpGains } from "./expSystem";
import { calcBuildingMaintenancePerSecond } from "./economy";

// ─── GPS 静态计算 ───────────────────────────────────────────────────────────────

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function addDelta(
  record: Record<string, number>,
  key: string,
  amount: number
): void {
  record[key] = (record[key] ?? 0) + amount;
}

/**
 * 计算某个 recipe 在当前 playerState 下的实际单次耗时（秒）。
 * 与 simulator.ts 保持一致的公式。
 */
function calcActualStepTime(
  recipe: RecipeConfig,
  state: RuntimeState,
  config: GameConfig
): number {
  let skillMultiplier = 1;
  if (recipe.requiredSkillId != null) {
    const skillConfig = config.skills[recipe.requiredSkillId];
    const skillState = state.playerState.skills[recipe.requiredSkillId];
    if (skillConfig != null && skillState != null) {
      skillMultiplier =
        1 - (skillState.level - 1) * skillConfig.timeReductionPerLevel;
    }
  }

  // 工具倍率：同一配方只取最高 tier 已购工具
  let toolMultiplier = 1;
  const purchasedTools = state.playerState.purchasedTools;
  const purchasedToolsIterable: Iterable<string> =
    purchasedTools instanceof Set ? purchasedTools : new Set<string>();
  if (purchasedTools && config.tools) {
    let bestTier = -1;
    let bestToolId = '';
    for (const toolId of purchasedToolsIterable) {
      const toolConfig = config.tools[toolId];
      if (!toolConfig) continue;
      const effect = toolConfig.effects[recipe.id];
      if (!effect) continue;
      const tier = toolConfig.tier ?? 0;
      if (tier > bestTier) {
        bestTier = tier;
        bestToolId = toolId;
        toolMultiplier = effect.timeMultiplier;
      }
    }
    // 叠加升级等级带来的额外效率
    if (bestToolId && state.toolLevels) {
      const upgradeLevel = state.toolLevels[bestToolId] ?? 0;
      if (upgradeLevel > 0) {
        const toolConfig = config.tools[bestToolId];
        const effPerLevel = toolConfig?.upgrade?.efficiencyPerLevel ?? 0;
        toolMultiplier = Math.max(0.1, toolMultiplier - upgradeLevel * effPerLevel);
      }
    }
  }

  const globalEfficiencyMultiplier = 1 + Math.max(0, state.totalTechPoints) * 0.02;
  const adjustedTime = (recipe.timeSeconds * skillMultiplier * toolMultiplier) / globalEfficiencyMultiplier;
  return Math.max(0.1, adjustedTime);
}

// ─── 单步动作执行器（ITER-016 / ITER-017）────────────────────────────────────

/**
 * 执行当前流程中 stepIndex 步骤的一次 repeat 重复。
 * 将资源/EXP 变化直接写入 state.playerState（可变操作）。
 * 返回本次产出的金币数量（用于 GPS 统计）。
 */
function executeOneRepeat(
  state: RuntimeState,
  config: GameConfig
): number {
  if (state.activeFlow == null) return 0;
  const step = state.activeFlow.steps[state.stepIndex];
  if (step == null) return 0;

  const recipe = config.recipes[step.recipeId];
  if (recipe == null) return 0;

  // 消耗输入资源
  for (const input of recipe.inputs) {
    const current = state.playerState.inventory[input.resourceId] ?? 0;
    state.playerState.inventory[input.resourceId] = Math.max(
      0,
      current - input.amount
    );
  }
  // 产出输出资源
  for (const output of recipe.outputs) {
    addDelta(state.playerState.inventory, output.resourceId, output.amount);
  }

  // 统计本次产出的货币（用于 GPS 窗口）
  let goldGained = 0;
  for (const output of recipe.outputs) {
    const rc = config.resources[output.resourceId];
    if (rc?.type === "currency") {
      goldGained += output.amount;
    }
  }

  // EXP 结算（写入 playerState.skills）
  const expDelta: Record<string, number> = {};
  for (const gain of recipe.expGains) {
    addDelta(expDelta, gain.skillId, gain.amount);
  }
  state.playerState.skills = applyExpGains(
    state.playerState.skills,
    expDelta,
    config.skills
  );

  return goldGained;
}

/** 判断当前步骤的一次 repeat 是否具备足够输入资源。 */
function canExecuteCurrentRepeat(
  state: RuntimeState,
  config: GameConfig
): boolean {
  if (state.activeFlow == null) return false;
  const step = state.activeFlow.steps[state.stepIndex];
  if (step == null) return false;
  const recipe = config.recipes[step.recipeId];
  if (recipe == null) return false;

  for (const input of recipe.inputs) {
    const current = state.playerState.inventory[input.resourceId] ?? 0;
    if (current < input.amount) return false;
  }
  return true;
}

/**
 * 计算当前流程的静态 GPS（gold per second）。
 * 公式：流程一次完整循环的总金币产出 / 总耗时（秒）。
 * 基于当前 playerState 的技能/升级效果实时计算。
 */
function calcStaticGps(state: RuntimeState, config: GameConfig): number {
  if (state.activeFlow == null || state.activeFlow.steps.length === 0) return 0;
  let totalGold = 0;
  let totalTimeS = 0;
  for (const step of state.activeFlow.steps) {
    const recipe = config.recipes[step.recipeId];
    if (recipe == null) continue;
    const t = calcActualStepTime(recipe, state, config);
    totalTimeS += t * step.repeat;
    for (const output of recipe.outputs) {
      const rc = config.resources[output.resourceId];
      if (rc?.type === "currency") {
        totalGold += output.amount * step.repeat;
      }
    }
  }
  const grossGps = totalTimeS > 0 ? totalGold / totalTimeS : 0;
  const maintenancePerSecond = calcBuildingMaintenancePerSecond(state.purchasedBuildingIds, config);
  state.maintenancePerSecond = maintenancePerSecond;
  return grossGps - maintenancePerSecond;
}

function applyMaintenanceCost(
  state: RuntimeState,
  deltaMs: number,
  config: GameConfig,
): boolean {
  const maintenancePerSecond = calcBuildingMaintenancePerSecond(state.purchasedBuildingIds, config);
  state.maintenancePerSecond = maintenancePerSecond;
  if (maintenancePerSecond <= 0 || deltaMs <= 0) return true;

  const goldCost = (maintenancePerSecond * deltaMs) / 1000;
  const currentGold = state.playerState.inventory.gold ?? 0;
  if (currentGold + 1e-9 < goldCost) {
    state.playerState.inventory.gold = 0;
    state.status = "idle";
    state.lastTickAt = 0;
    state.stepProgress = 0;
    state.repeatProgress = 0;
    state.lastStopReason = "维护费不足：金币已耗尽，流程已停机。";
    return false;
  }

  state.playerState.inventory.gold = Math.max(0, currentGold - goldCost);
  return true;
}

// ─── 步骤推进器（ITER-016）────────────────────────────────────────────────────

/**
 * 根据 deltaTime（ms）推进当前步骤进度。
 * 当一次 repeat 执行完成时调用 executeOneRepeat 结算，
 * 全部 repeat 完成后切换到下一步骤（或回绕循环）。
 */
function advanceStep(
  state: RuntimeState,
  deltaMs: number,
  config: GameConfig
): void {
  if (state.activeFlow == null || state.activeFlow.steps.length === 0) return;

  let remaining = deltaMs;

  // 单帧内可能跨越多个 repeat 甚至多个步骤（极端快速情况）
  // 通过循环处理，避免帧率波动导致漏算
  const MAX_ITERATIONS = 200; // 防止无限循环的安全阀
  let iterations = 0;

  while (remaining > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    if (state.activeFlow == null || state.activeFlow.steps.length === 0) break;

    const step = state.activeFlow.steps[state.stepIndex];
    if (step == null) break;

    const recipe = config.recipes[step.recipeId];
    if (recipe == null) break;

    // 资源不足时立即停机（等待玩家补充资源或编辑流程）。
    if (!canExecuteCurrentRepeat(state, config)) {
      state.status = "idle";
      state.lastTickAt = 0;
      state.stepProgress = 0;
      state.repeatProgress = 0;
      state.lastStopReason = "资源不足：当前步骤缺少输入资源，流程已停机。";
      break;
    }

    // 当前这次 repeat 的实际耗时（ms）
    const repeatTimeMs = calcActualStepTime(recipe, state, config) * 1000;
    // 写入 state，供进度条精确使用
    state.currentRepeatTotalMs = repeatTimeMs;
    const needed = repeatTimeMs - state.stepProgress;

    if (remaining < needed) {
      // 本帧 deltaTime 不够完成这次 repeat
      state.stepProgress += remaining;
      remaining = 0;
    } else {
      // 完成这次 repeat
      remaining -= needed;
      state.stepProgress = 0;

      executeOneRepeat(state, config);

      // 推进 repeatProgress
      state.repeatProgress += 1;

      if (state.repeatProgress >= step.repeat) {
        // 该步骤全部 repeat 完成，切换到下一步骤
        state.repeatProgress = 0;

        // 检查是否有待生效流程（步骤边界切换，保持步骤进度连续）
        const nextIndex = state.stepIndex + 1;
        const didCompleteOldFlow =
          state.activeFlow != null && nextIndex >= state.activeFlow.steps.length;
        if (state.pendingFlow != null) {
          const newFlow = state.pendingFlow;
          state.activeFlow = newFlow;
          state.pendingFlow = null;
          state.stepProgress = 0;
          state.repeatProgress = 0;
          // 不重置到 step 0，而是继续到下一步（与非 pending 分支一致）
          if (nextIndex >= newFlow.steps.length) {
            state.stepIndex = 0;
          } else {
            state.stepIndex = nextIndex;
          }
          // 只在旧流程完整跑完一轮时计数 +1。
          if (didCompleteOldFlow) {
            state.loopCount += 1;
          }
        } else {
          if (nextIndex >= state.activeFlow.steps.length) {
            // 流程结束，回到首步骤，循环计数+1
            state.stepIndex = 0;
            state.loopCount += 1;
          } else {
            state.stepIndex = nextIndex;
          }
        }
      }
    }
  }
}

// ─── Tick 时钟驱动器（ITER-015）──────────────────────────────────────────────

export class RuntimeEngine {
  private _state: RuntimeState;
  private _config: GameConfig;
  private _rafId: number | null = null;
  /** 外部注册的状态变更回调（每帧调用，用于通知 Pinia store 同步）*/
  private _onTick: ((state: RuntimeState) => void) | null = null;

  constructor(state: RuntimeState, config: GameConfig) {
    this._state = state;
    this._config = config;
  }

  /** 注册每帧回调，引擎调用后外部可将 state 同步到 Pinia */
  onTick(cb: (state: RuntimeState) => void): void {
    this._onTick = cb;
  }

  /** 替换引擎持有的 GameConfig（升级后可调用） */
  updateConfig(config: GameConfig): void {
    this._config = config;
  }

  /** 直接替换引擎持有的 RuntimeState（恢复存档时使用） */
  replaceState(state: RuntimeState): void {
    this._state = state;
  }

  /** 设置待生效流程（下一步骤边界时切换） */
  setPendingFlow(flow: RuntimeState["pendingFlow"]): void {
    this._state.pendingFlow = flow;
  }

  /** 启动引擎 */
  start(): void {
    if (this._state.status === "running") return;
    this._state.status = "running";
    this._state.lastStopReason = "";
    this._state.lastTickAt = performance.now();
    this._scheduleRaf();
  }

  /** 暂停引擎 */
  pause(): void {
    if (this._state.status !== "running") return;
    this._state.status = "paused";
    this._cancelRaf();
  }

  /** 恢复引擎（暂停后） */
  resume(): void {
    if (this._state.status !== "paused") return;
    this._state.status = "running";
    this._state.lastStopReason = "";
    // 重置 lastTickAt 避免恢复时补算暂停期间的 deltaTime
    this._state.lastTickAt = performance.now();
    this._scheduleRaf();
  }

  /** 停止引擎并重置步骤进度 */
  stop(): void {
    this._state.status = "idle";
    this._cancelRaf();
    this._state.lastTickAt = 0;
    this._state.stepProgress = 0;
    this._state.repeatProgress = 0;
    this._state.lastStopReason = "";
  }

  /**
   * 调试单步推进：在非 running 状态下推进当前步骤的一次 repeat。
   * 用于 DebugPanel 的单步验证，不启动 rAF 循环。
   */
  stepOnce(): boolean {
    if (this._state.status === "running") return false;
    if (this._state.activeFlow == null || this._state.activeFlow.steps.length === 0) {
      return false;
    }

    const step = this._state.activeFlow.steps[this._state.stepIndex];
    if (step == null) return false;
    const recipe = this._config.recipes[step.recipeId];
    if (recipe == null) return false;

    if (this._state.status === "idle") {
      this._state.status = "paused";
      this._state.lastStopReason = "";
    }

    const repeatTimeMs = calcActualStepTime(recipe, this._state, this._config) * 1000;
    const remainingMs = Math.max(1, repeatTimeMs - this._state.stepProgress);

    if (!applyMaintenanceCost(this._state, remainingMs, this._config)) {
      this._state.gps = calcStaticGps(this._state, this._config);
      return true;
    }

    advanceStep(this._state, remainingMs, this._config);
    this._state.gps = calcStaticGps(this._state, this._config);
    return true;
  }

  /** 当前引擎状态快照（只读引用，外部不应直接修改） */
  get state(): Readonly<RuntimeState> {
    return this._state;
  }

  // ── 私有方法 ────────────────────────────────────────────────────────────────

  private _scheduleRaf(): void {
    this._rafId = requestAnimationFrame((now) => this._tick(now));
  }

  private _cancelRaf(): void {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _tick(now: number): void {
    if (this._state.status !== "running") return;

    const deltaMs = this._state.lastTickAt === 0
      ? 0
      : now - this._state.lastTickAt;

    this._state.lastTickAt = now;

    // 步骤推进与资源/EXP 结算
    if (deltaMs > 0) {
      if (!applyMaintenanceCost(this._state, deltaMs, this._config)) {
        this._state.gps = calcStaticGps(this._state, this._config);
        this._onTick?.(this._state);
        return;
      }

      advanceStep(this._state, deltaMs, this._config);

      // GPS 静态公式（总流程金币 / 总流程耗时）
      this._state.gps = calcStaticGps(this._state, this._config);
    }

    // 通知外部同步
    this._onTick?.(this._state);

    // 继续下一帧
    this._scheduleRaf();
  }
}
