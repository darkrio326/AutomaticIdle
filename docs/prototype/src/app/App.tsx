import { useGameEngine } from './engine/useGameEngine';
import { ProcessEditor } from './components/ProcessEditor';
import { ExecutionView } from './components/ExecutionView';
import { StatusPanel } from './components/StatusPanel';

export default function App() {
  const {
    resources,
    upgrades,
    processList,
    activeStepIndex,
    currentStepLoopCount,
    stepProgress,
    exp,
    level,
    expToNextLevel,
    floatingTexts,
    bottleneck,
    goldPerSec,
    efficiency,
    addStep,
    removeStep,
    moveStep,
    updateStepRepeat,
    buyUpgrade,
  } = useGameEngine();

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-y-auto lg:overflow-hidden select-none">
      {/* 实时运行区 - 移动端置顶 */}
      <div className="w-full lg:flex-1 lg:min-w-[500px] z-0 order-1 lg:order-2 h-[60vh] lg:h-full shrink-0">
        <ExecutionView
          processList={processList}
          activeStepIndex={activeStepIndex}
          currentStepLoopCount={currentStepLoopCount}
          stepProgress={stepProgress}
          floatingTexts={floatingTexts}
          bottleneck={bottleneck}
          goldPerSec={goldPerSec}
          efficiency={efficiency}
        />
      </div>

      {/* 状态面板 - 移动端放中间 */}
      <div className="w-full lg:w-80 flex-shrink-0 z-10 order-2 lg:order-3 h-[70vh] lg:h-full border-t lg:border-t-0 lg:border-l border-slate-800">
        <StatusPanel
          resources={resources}
          exp={exp}
          level={level}
          expToNextLevel={expToNextLevel}
          upgrades={upgrades}
          buyUpgrade={buyUpgrade}
        />
      </div>

      {/* 流程编辑区 - 移动端放底部 */}
      <div className="w-full lg:w-80 flex-shrink-0 z-10 order-3 lg:order-1 h-[60vh] lg:h-full border-t lg:border-t-0 lg:border-r border-slate-800">
        <ProcessEditor
          processList={processList}
          activeStepIndex={activeStepIndex}
          addStep={addStep}
          removeStep={removeStep}
          moveStep={moveStep}
          updateStepRepeat={updateStepRepeat}
        />
      </div>
    </div>
  );
}
