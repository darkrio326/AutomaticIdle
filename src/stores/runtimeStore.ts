/**
 * runtimeStore.ts — Runtime 引擎的 Pinia Store 桥接层（ITER-018）
 *
 * 职责：
 *  - 持有 RuntimeEngine 实例（单例）
 *  - 将 engine 内部状态投影为 Vue 响应式状态，供 UI 只读绑定
 *  - 提供 start / pause / resume / stop / setFlow 等控制接口
 *  - 在 onTick 回调中将 engine.state 同步到 Pinia 响应式字段
 *  - 流程修改后通过 setPendingFlow 写入 engine（待步骤边界生效）
 *  - 引擎侧 playerState 变更后同步回 flowStore（资源/技能持久化）
 *
 * 边界约定：
 *  - UI 只读 runtimeStore 中的响应式字段，不直接访问 engine.state
 *  - flowStore 是持久化来源，runtimeStore 持有的 playerState 副本
 *    通过 syncToFlowStore() 回写，不直接修改 flowStore 内部状态
 */

import { defineStore } from "pinia";
import { RuntimeEngine } from "@/core/runtimeEngine";
import { createInitialRuntimeState } from "@/core/runtimeTypes";
import type { RuntimeState, RuntimeStatus } from "@/core/runtimeTypes";
import type { FlowDefinition } from "@/core/types";
import { clonePlayerState } from "@/stores/flowStore";
import { useFlowStore } from "./flowStore";

/** 每隔多少帧将 playerState 回写到 flowStore（降低持久化频率）*/
const SYNC_BACK_EVERY_MS = 2_000;

// engine 实例挂载到模块级（不放 Pinia state，避免响应式代理破坏类实例）
let _engine: RuntimeEngine | null = null;

function getEngine(): RuntimeEngine {
  if (_engine == null) {
    throw new Error("RuntimeEngine not initialized. Call initEngine() first.");
  }
  return _engine;
}

export const useRuntimeStore = defineStore("runtime", {
  state: () => ({
    /** 引擎运行状态（镜像 engine.state.status）*/
    status: "idle" as RuntimeStatus,
    /** 当前执行步骤的索引 */
    stepIndex: 0,
    /** 当前步骤已推进进度（ms） */
    stepProgress: 0,
    /** 当前步骤单次 repeat 的实际耗时（ms），用于进度条百分比 */
    currentRepeatTotalMs: 0,
    /** 当前步骤在 repeat 内已完成次数 */
    repeatProgress: 0,
    /** 流程循环总次数 */
    loopCount: 0,
    /** 实时 GPS（静态公式：总流程金币 / 总流程耗时） */
    gps: 0,
    /** 实时库存快照（每帧从 engine playerState 投影，不触发持久化）*/
    liveInventory: {} as Record<string, number>,
    /** 当前活跃流程 */
    activeFlow: null as FlowDefinition | null,
    /** 是否有待生效流程 */
    hasPendingFlow: false,
    /** 上次同步回 flowStore 的时间戳（ms） */
    _lastSyncMs: 0,
  }),

  getters: {
    isRunning(state): boolean {
      return state.status === "running";
    },
    isPaused(state): boolean {
      return state.status === "paused";
    },
    /** 当前步骤进度 0~1（用于进度条） */
    stepProgressRatio(state): number {
      if (state.currentRepeatTotalMs <= 0) return 0;
      return Math.min(1, state.stepProgress / state.currentRepeatTotalMs);
    },
  },

  actions: {
    /**
     * 初始化引擎（应在 App 挂载时调用一次）。
     * 从 flowStore 取当前流程和玩家状态作为初始值。
     */
    initEngine(): void {
      const flowStore = useFlowStore();

      const initialState = createInitialRuntimeState(
        clonePlayerState(flowStore.playerState)
      );
      initialState.activeFlow = JSON.parse(
        JSON.stringify(flowStore.flowDefinition)
      );

      _engine = new RuntimeEngine(initialState, flowStore.gameConfig);

      _engine.onTick((state) => this._onEngineTick(state));
    },

    /** 启动运行引擎 */
    start(): void {
      const flowStore = useFlowStore();
      if (flowStore.flowDefinition.steps.length === 0) {
        this.stop();
        return;
      }
      // 每次启动前先同步最新流程和配置
      this._syncFlowToEngine();
      getEngine().start();
      this.status = "running";
    },

    /** 暂停（保留接口，当前 UI 不暴露） */
    pause(): void {
      getEngine().pause();
      this.status = "paused";
    },

    /** 恢复（保留接口，当前 UI 不暴露） */
    resume(): void {
      getEngine().resume();
      this.status = "running";
    },

    /** 停止并重置进度 */
    stop(): void {
      getEngine().stop();
      this.status = "idle";
      this.stepIndex = 0;
      this.stepProgress = 0;
      this.repeatProgress = 0;
    },

    /**
     * 流程被编辑后调用（由 FlowEditor 触发）。
     * 规则：
     *  - 流程为空：立即停机
     *  - 运行中：写入 pendingFlow，步骤边界生效
     *  - 非运行中：直接替换 activeFlow 并自动启动
     */
    notifyFlowChanged(): void {
      const flowStore = useFlowStore();
      const newFlow: FlowDefinition = JSON.parse(
        JSON.stringify(flowStore.flowDefinition)
      );

      if (newFlow.steps.length === 0) {
        this.stop();
        const engineState = getEngine().state as RuntimeState;
        (engineState as RuntimeState).activeFlow = newFlow;
        (engineState as RuntimeState).pendingFlow = null;
        this.activeFlow = newFlow;
        this.hasPendingFlow = false;
        return;
      }

      if (this.status === "running" || this.status === "paused") {
        getEngine().setPendingFlow(newFlow);
        this.hasPendingFlow = true;
      } else {
        // idle 状态下直接替换 activeFlow
        const engineState = getEngine().state as RuntimeState;
        (engineState as RuntimeState).activeFlow = newFlow;
        (engineState as RuntimeState).pendingFlow = null;
        (engineState as RuntimeState).stepIndex = 0;
        (engineState as RuntimeState).stepProgress = 0;
        (engineState as RuntimeState).repeatProgress = 0;
        this.activeFlow = newFlow;
        this.hasPendingFlow = false;
        this.start();
      }
    },

    /** 升级后更新引擎内的 GameConfig（保持效率计算最新） */
    notifyConfigChanged(): void {
      const flowStore = useFlowStore();
      getEngine().updateConfig(flowStore.gameConfig);
    },

    // ── 私有方法 ──────────────────────────────────────────────────────────────

    /** 每帧回调：将 engine state 投影到 Pinia 响应式字段 */
    _onEngineTick(state: RuntimeState): void {
      this.status = state.status;
      this.stepIndex = state.stepIndex;
      this.stepProgress = state.stepProgress;
      this.repeatProgress = state.repeatProgress;
      this.loopCount = state.loopCount;
      this.gps = state.gps;
      this.activeFlow = state.activeFlow;
      this.hasPendingFlow = state.pendingFlow != null;

      // 每帧同步实时库存（仅读取，不触发持久化）
      this.liveInventory = { ...state.playerState.inventory };

      // 直接使用引擎写入的精确值（含技能/升级加速）
      this.currentRepeatTotalMs = state.currentRepeatTotalMs;

      // 定时将引擎 playerState 同步回 flowStore（触发持久化）
      const now = performance.now();
      if (now - this._lastSyncMs >= SYNC_BACK_EVERY_MS) {
        this._lastSyncMs = now;
        this._syncPlayerStateBack(state);
      }
    },

    /** 将 engine 内的 playerState 回写到 flowStore */
    _syncPlayerStateBack(state: RuntimeState): void {
      const flowStore = useFlowStore();
      flowStore.playerState = clonePlayerState(state.playerState);
      flowStore.persistState();
    },

    /** 将 flowStore 的当前流程同步到 engine（start 时调用） */
    _syncFlowToEngine(): void {
      const flowStore = useFlowStore();
      const engine = getEngine();
      const engineState = engine.state as RuntimeState;
      // 同步 playerState（确保使用 flowStore 的最新状态，正确处理 Set 类型）
      (engineState as RuntimeState).playerState = clonePlayerState(flowStore.playerState);
      // 同步 config
      engine.updateConfig(flowStore.gameConfig);
    },
  },
});
