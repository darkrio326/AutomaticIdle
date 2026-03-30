import type { FlowDefinition, PlayerState } from "./types";

/** 引擎运行状态 */
export type RuntimeStatus = "idle" | "running" | "paused";

/**
 * 运行时状态 — 引擎内部单一数据源。
 *
 * 字段分组：
 *  - 引擎控制：status / lastTickAt
 *  - 流程状态：activeFlow / pendingFlow
 *  - 步骤执行：stepIndex / stepProgress / loopCount
 *  - 玩家状态：playerState（运行时可写副本，由 runtimeStore 与 flowStore 同步）
 *  - 统计摘要：gps / lastGpsWindowMs / goldInWindow
 */
export interface RuntimeState {
  // ── 引擎控制 ──────────────────────────────────────────────
  /** 当前引擎运行态 */
  status: RuntimeStatus;
  /** 上一次 tick 的 performance.now() 时间戳（ms）；0 表示尚未启动 */
  lastTickAt: number;

  // ── 流程状态 ──────────────────────────────────────────────
  /** 当前正在执行的流程定义；null 表示尚未配置 */
  activeFlow: FlowDefinition | null;
  /**
   * 待生效流程：玩家修改流程后暂存于此，
   * 当前步骤完成后（进入下一步时）切换为 activeFlow。
   */
  pendingFlow: FlowDefinition | null;

  // ── 步骤执行 ──────────────────────────────────────────────
  /** 当前正在执行的步骤索引（对应 activeFlow.steps[stepIndex]）*/
  stepIndex: number;
  /**
   * 当前步骤已推进的时间（ms）。
   * 当 stepProgress >= 当前步骤实际耗时时，触发一次动作结算并归零。
   */
  stepProgress: number;
  /** 当前步骤在 repeat 内已完成的执行次数（0 基） */
  repeatProgress: number;
  /** 流程已完整循环的次数 */
  loopCount: number;

  // ── 玩家状态（运行时可写副本）────────────────────────────
  /** 运行时维护的玩家状态，隔离于 flowStore 的编辑态；引擎结算后回写 flowStore */
  playerState: PlayerState;

  // ── 统计摘要 ──────────────────────────────────────────────
  /** 实时每秒金币收益（5s 滑动窗口估算）*/
  gps: number;
  /** GPS 滑动窗口内累计金币 */
  goldInWindow: number;
  /** GPS 滑动窗口已累计时长（ms）*/
  gpsWindowMs: number;
}

/** 创建一个空白初始 RuntimeState */
export function createInitialRuntimeState(
  playerState: PlayerState
): RuntimeState {
  return {
    status: "idle",
    lastTickAt: 0,
    activeFlow: null,
    pendingFlow: null,
    stepIndex: 0,
    stepProgress: 0,
    repeatProgress: 0,
    loopCount: 0,
    playerState,
    gps: 0,
    goldInWindow: 0,
    gpsWindowMs: 0,
  };
}
