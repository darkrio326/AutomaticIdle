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
import { loadSaveSnapshot } from "@/services/saveService";
import { trackResourceBlocked, trackRunStart } from "@/services/analyticsService";
import { calcBuildingMaintenancePerSecond } from "@/core/economy";
import { clonePlayerState, getFlowValidationError } from "@/stores/flowStore";
import { useFlowStore } from "./flowStore";
import { useToolStore } from "./toolStore";
import { useBuildingStore } from "./buildingStore";

/** 每隔多少帧将 playerState 回写到 flowStore（降低持久化频率）*/
const SYNC_BACK_EVERY_MS = 2_000;

// engine 实例挂载到模块级（不放 Pinia state，避免响应式代理破坏类实例）
let _engine: RuntimeEngine | null = null;

function getInitialHistoryState(): { bestStableGps: number; localBestGps: number } {
  const snapshot = loadSaveSnapshot();
  return {
    bestStableGps: Math.max(0, snapshot?.bestStableGps ?? 0),
    localBestGps: Math.max(0, snapshot?.localBestGps ?? 0),
  };
}

function getInitialTechPoints(): number {
  const snapshot = loadSaveSnapshot();
  return Math.max(0, snapshot?.totalTechPoints ?? 0);
}

function getEngine(): RuntimeEngine {
  if (_engine == null) {
    throw new Error("RuntimeEngine not initialized. Call initEngine() first.");
  }
  return _engine;
}

export const useRuntimeStore = defineStore("runtime", {
  state: () => {
    const historyState = getInitialHistoryState();

    return ({
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
    /** 当前会话内历史最高稳定收益（刷新后重置） */
    sessionBestGps: 0,
    /** 当前轮次历史最高稳定收益（持久化，用于后续 Prestige） */
    bestStableGps: historyState.bestStableGps,
    /** 本地历史最佳稳定收益（持久化） */
    localBestGps: historyState.localBestGps,
    /** 累计技术点（跨轮次） */
    totalTechPoints: getInitialTechPoints(),
    /** 当前建筑维护费（金币 / 秒） */
    maintenancePerSecond: 0,
    /** 最近一次自动停机原因 */
    lastStopReason: '',
    /** 实时库存快照（每帧从 engine playerState 投影，不触发持久化）*/
    liveInventory: {} as Record<string, number>,
    /** 当前活跃流程 */
    activeFlow: null as FlowDefinition | null,
    /** 是否有待生效流程 */
    hasPendingFlow: false,
    /** 上次同步回 flowStore 的时间戳（ms） */
    _lastSyncMs: 0,
    });
  },

  getters: {
    isRunning(state): boolean {
      return state.status === "running";
    },
    isPaused(state): boolean {
      return state.status === "paused";
    },
    canStepOnce(state): boolean {
      return state.status !== "running" && state.activeFlow != null && state.activeFlow.steps.length > 0;
    },
    currentStableGps(state): number {
      const flowStore = useFlowStore();
      return state.status === "running" || state.status === "paused"
        ? state.gps
        : flowStore.displayGps;
    },
    currentMaintenancePerSecond(state): number {
      const flowStore = useFlowStore();
      return state.status === "running" || state.status === "paused"
        ? state.maintenancePerSecond
        : flowStore.displayMaintenancePerSecond;
    },
    currentGoldBalance(state): number {
      const flowStore = useFlowStore();
      const inventory = state.status === "running" || state.status === "paused"
        ? state.liveInventory
        : flowStore.playerState.inventory;
      return Math.max(0, inventory.gold ?? 0);
    },
    currentGpsDeltaFromBest(state): number {
      const flowStore = useFlowStore();
      const currentGps = state.status === "running" || state.status === "paused"
        ? state.gps
        : flowStore.displayGps;
      return currentGps - state.localBestGps;
    },
    hasNegativeIncome(): boolean {
      return this.currentMaintenancePerSecond > 0 && this.currentStableGps < 0;
    },
    lowBalanceSeconds(): number {
      if (this.currentMaintenancePerSecond <= 0) return 0;
      return Math.floor(this.currentGoldBalance / this.currentMaintenancePerSecond);
    },
    isLowBalanceWarning(): boolean {
      return this.currentMaintenancePerSecond > 0
        && this.currentGoldBalance > 0
        && this.lowBalanceSeconds <= 30;
    },
    economyWarningText(state): string {
      if (state.lastStopReason) return state.lastStopReason;
      if (this.hasNegativeIncome) {
        const secondsLeft = this.currentStableGps < 0
          ? Math.floor(this.currentGoldBalance / Math.abs(this.currentStableGps))
          : 0;
        if (secondsLeft > 0) {
          return `当前净收益为负，按现有金币约 ${secondsLeft} 秒后会见底。`;
        }
        return '当前净收益为负，金币会持续下降。';
      }
      if (this.isLowBalanceWarning) {
        return `金币余额偏低，按当前维护费约可再支撑 ${this.lowBalanceSeconds} 秒。`;
      }
      return '';
    },
    techPointGain(state): number {
      return Math.floor(6 * Math.log2(state.bestStableGps / 5 + 1));
    },
    previewTotalTechPoints(state): number {
      return state.totalTechPoints + this.techPointGain;
    },
    globalEfficiencyMultiplier(state): number {
      return 1 + state.totalTechPoints * 0.02;
    },
    previewEfficiencyMultiplier(state): number {
      return 1 + this.previewTotalTechPoints * 0.02;
    },
    globalEfficiencyPercent(): number {
      return this.totalTechPoints * 2;
    },
    previewEfficiencyPercent(): number {
      return this.previewTotalTechPoints * 2;
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
      const toolStore = useToolStore();
      const buildingStore = useBuildingStore();

      const initialState = createInitialRuntimeState(
        clonePlayerState(flowStore.playerState)
      );
      initialState.activeFlow = JSON.parse(
        JSON.stringify(flowStore.flowDefinition)
      );
      initialState.toolLevels = { ...toolStore.toolLevels };
      initialState.totalTechPoints = this.totalTechPoints;
      initialState.purchasedBuildingIds = [...buildingStore.getPurchasedBuildingIds];
      initialState.maintenancePerSecond = calcBuildingMaintenancePerSecond(
        initialState.purchasedBuildingIds,
        flowStore.gameConfig,
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
      const validationError = getFlowValidationError(
        flowStore.flowDefinition.steps,
        flowStore.gameConfig,
      );
      if (validationError) {
        flowStore.errorMessage = validationError;
        this.stop();
        return;
      }
      flowStore.errorMessage = "";
      // 每次启动前先同步最新流程和配置
      this._syncFlowToEngine();
      getEngine().start();
      this.status = "running";
      trackRunStart();
      this._syncGpsHistory(flowStore.displayGps);
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
      const validationError = getFlowValidationError(newFlow.steps, flowStore.gameConfig);

      if (newFlow.steps.length === 0) {
        this.stop();
        const engineState = getEngine().state as RuntimeState;
        (engineState as RuntimeState).activeFlow = newFlow;
        (engineState as RuntimeState).pendingFlow = null;
        this.activeFlow = newFlow;
        this.hasPendingFlow = false;
        return;
      }

      if (validationError) {
        flowStore.errorMessage = validationError;
        this.stop();
        const engineState = getEngine().state as RuntimeState;
        (engineState as RuntimeState).activeFlow = newFlow;
        (engineState as RuntimeState).pendingFlow = null;
        this.activeFlow = newFlow;
        this.hasPendingFlow = false;
        return;
      }

      flowStore.errorMessage = "";

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

    /**
     * 外部（如订单提交、建筑/工具购买）修改了 flowStore.playerState 后，
     * 立即把最新状态同步到引擎，避免被定时回写覆盖。
     */
    syncPlayerStateFromFlowStore(): void {
      if (_engine == null) return;
      const flowStore = useFlowStore();
      const toolStore = useToolStore();
      const buildingStore = useBuildingStore();
      const engineState = getEngine().state as RuntimeState;
      (engineState as RuntimeState).playerState = clonePlayerState(flowStore.playerState);
      (engineState as RuntimeState).toolLevels = { ...toolStore.toolLevels };
      (engineState as RuntimeState).totalTechPoints = this.totalTechPoints;
      (engineState as RuntimeState).purchasedBuildingIds = [...buildingStore.getPurchasedBuildingIds];
      (engineState as RuntimeState).maintenancePerSecond = calcBuildingMaintenancePerSecond(
        buildingStore.getPurchasedBuildingIds,
        flowStore.gameConfig,
      );
      this.liveInventory = { ...engineState.playerState.inventory };
    },

    /** DebugPanel 单步推进当前步骤的一次 repeat。 */
    stepOnce(): void {
      if (_engine == null) return;
      const advanced = getEngine().stepOnce();
      if (!advanced) return;

      const state = getEngine().state as RuntimeState;
      this._onEngineTick(state);
      this._syncPlayerStateBack(state);
    },

    _syncGpsHistory(currentGps: number): void {
      const normalizedGps = Number.isFinite(currentGps) ? Math.max(0, currentGps) : 0;
      if (normalizedGps <= 0) return;

      let didChange = false;

      if (normalizedGps > this.sessionBestGps) {
        this.sessionBestGps = normalizedGps;
      }
      if (normalizedGps > this.bestStableGps) {
        this.bestStableGps = normalizedGps;
        didChange = true;
      }
      if (normalizedGps > this.localBestGps) {
        this.localBestGps = normalizedGps;
        didChange = true;
      }

      if (didChange) {
        const flowStore = useFlowStore();
        flowStore.persistState();
      }
    },

    prestigeReset(): { success: boolean; gained: number } {
      const flowStore = useFlowStore();
      const gain = this.techPointGain;
      if (gain <= 0) {
        flowStore.errorMessage = '重开失败：当前轮次历史最佳收益不足，无法获得技术点。';
        return { success: false, gained: 0 };
      }

      this.stop();
      this.totalTechPoints += gain;
      this.sessionBestGps = 0;
      this.bestStableGps = 0;
      this.lastStopReason = '';

      flowStore.resetProgressForPrestige();
      this.syncPlayerStateFromFlowStore();
      this.notifyConfigChanged();
      this.notifyFlowChanged();
      flowStore.persistState();
      flowStore.errorMessage = `重开成功：获得 +${gain} 技术点，当前总技术点 ${this.totalTechPoints}。`;

      return { success: true, gained: gain };
    },

    // ── 私有方法 ──────────────────────────────────────────────────────────────

    /** 每帧回调：将 engine state 投影到 Pinia 响应式字段 */
    _onEngineTick(state: RuntimeState): void {
      const prevStopReason = this.lastStopReason;
      this.status = state.status;
      this.stepIndex = state.stepIndex;
      this.stepProgress = state.stepProgress;
      this.repeatProgress = state.repeatProgress;
      this.loopCount = state.loopCount;
      this.gps = state.gps;
      this.maintenancePerSecond = state.maintenancePerSecond;
      this.lastStopReason = state.lastStopReason;
      this.activeFlow = state.activeFlow;
      this.hasPendingFlow = state.pendingFlow != null;

      if (
        state.lastStopReason.startsWith('资源不足')
        && state.lastStopReason !== prevStopReason
      ) {
        trackResourceBlocked(state.lastStopReason);
      }

      this._syncGpsHistory(state.gps);

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
      if (state.lastStopReason.startsWith('维护费不足') || state.lastStopReason.startsWith('资源不足')) {
        flowStore.errorMessage = state.lastStopReason;
      }
      flowStore.persistState();
    },

    /** 将 flowStore 的当前流程同步到 engine（start 时调用） */
    _syncFlowToEngine(): void {
      const flowStore = useFlowStore();
      const buildingStore = useBuildingStore();
      const engine = getEngine();
      const engineState = engine.state as RuntimeState;
      // 同步 playerState（确保使用 flowStore 的最新状态，正确处理 Set 类型）
      (engineState as RuntimeState).playerState = clonePlayerState(flowStore.playerState);
      (engineState as RuntimeState).purchasedBuildingIds = [...buildingStore.getPurchasedBuildingIds];
      (engineState as RuntimeState).maintenancePerSecond = calcBuildingMaintenancePerSecond(
        buildingStore.getPurchasedBuildingIds,
        flowStore.gameConfig,
      );
      // 同步 config
      engine.updateConfig(flowStore.gameConfig);
    },
  },
});
