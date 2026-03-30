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

// ─── GPS 滑动窗口（5 秒）─────────────────────────────────────────────────────
const GPS_WINDOW_MS = 5_000;

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

  let upgradeMultiplier = 1;
  for (const upgradeConfig of Object.values(config.upgrades)) {
    if (
      upgradeConfig.targetType === "recipe_time" &&
      upgradeConfig.targetId === recipe.id
    ) {
      const upgradeState = state.playerState.upgrades[upgradeConfig.id];
      if (upgradeState != null && upgradeState.level > 0) {
        upgradeMultiplier *= 1 - upgradeState.level * upgradeConfig.effectPerLevel;
      }
    }
  }

  return Math.max(0.1, recipe.timeSeconds * skillMultiplier * upgradeMultiplier);
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
    addDelta(state.playerState.inventory, input.resourceId, -input.amount);
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

    // 当前这次 repeat 的实际耗时（ms）
    const repeatTimeMs = calcActualStepTime(recipe, state, config) * 1000;
    const needed = repeatTimeMs - state.stepProgress;

    if (remaining < needed) {
      // 本帧 deltaTime 不够完成这次 repeat
      state.stepProgress += remaining;
      remaining = 0;
    } else {
      // 完成这次 repeat
      remaining -= needed;
      state.stepProgress = 0;

      const gold = executeOneRepeat(state, config);

      // GPS 滑动窗口累积
      state.goldInWindow += gold;

      // 推进 repeatProgress
      state.repeatProgress += 1;

      if (state.repeatProgress >= step.repeat) {
        // 该步骤全部 repeat 完成，切换到下一步骤
        state.repeatProgress = 0;

        // 检查是否有待生效流程（流程切换在步骤边界生效）
        if (state.pendingFlow != null) {
          state.activeFlow = state.pendingFlow;
          state.pendingFlow = null;
          state.stepIndex = 0;
          state.stepProgress = 0;
          state.repeatProgress = 0;
        } else {
          const nextIndex = state.stepIndex + 1;
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
      advanceStep(this._state, deltaMs, this._config);

      // GPS 滑动窗口时间推进
      this._state.gpsWindowMs += deltaMs;
      if (this._state.gpsWindowMs >= GPS_WINDOW_MS) {
        this._state.gps =
          (this._state.goldInWindow / this._state.gpsWindowMs) * 1000;
        // 滑动窗口重置（不清零，保留超出部分防止跳变）
        this._state.goldInWindow = 0;
        this._state.gpsWindowMs = 0;
      }
    }

    // 通知外部同步
    this._onTick?.(this._state);

    // 继续下一帧
    this._scheduleRaf();
  }
}
