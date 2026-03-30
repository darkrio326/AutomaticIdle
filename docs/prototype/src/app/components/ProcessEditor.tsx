import { Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { ProcessStep, StepType, STEP_DEFINITIONS } from '../types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ProcessEditorProps {
  processList: ProcessStep[];
  activeStepIndex: number;
  addStep: (type: StepType) => void;
  removeStep: (id: string) => void;
  moveStep: (index: number, direction: 'up' | 'down') => void;
  updateStepRepeat: (id: string, count: number) => void;
}

export function ProcessEditor({ processList, activeStepIndex, addStep, removeStep, moveStep, updateStepRepeat }: ProcessEditorProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider">流程编辑区</h2>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">自动循环</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {processList.map((step, index) => {
          const def = STEP_DEFINITIONS[step.type];
          const isActive = index === activeStepIndex;
          
          return (
            <div
              key={step.id}
              className={twMerge(
                clsx(
                  "relative group flex flex-col p-3 rounded-xl border transition-all duration-300",
                  isActive ? "bg-slate-800 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                )
              )}
            >
              {isActive && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    "text-sm font-bold px-2 py-0.5 rounded",
                    step.type === 'mine' && "bg-slate-700 text-slate-300",
                    step.type === 'smelt' && "bg-orange-900/40 text-orange-400",
                    step.type === 'forge' && "bg-blue-900/40 text-blue-400",
                    step.type === 'sell' && "bg-yellow-900/40 text-yellow-400"
                  )}>
                    {def.name}
                  </span>
                  <span className="text-xs text-slate-400">{(def.baseTime / 1000).toFixed(1)}s</span>
                </div>

                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button 
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === processList.length - 1}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button 
                    onClick={() => removeStep(step.id)}
                    className="p-1 text-red-400 hover:text-red-300 ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="mt-2 flex justify-between items-end">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  循环次数:
                  <div className="flex items-center bg-slate-900 rounded border border-slate-700">
                    <button onClick={() => updateStepRepeat(step.id, step.repeatCount - 1)} disabled={step.repeatCount <= 1} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30">-</button>
                    <span className="w-6 text-center text-slate-300 font-mono">{step.repeatCount}</span>
                    <button onClick={() => updateStepRepeat(step.id, step.repeatCount + 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white">+</button>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  总执行: <span className="text-slate-300 font-mono">{step.executionCount}</span>
                </div>
              </div>
            </div>
          );
        })}

        {processList.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
            流程为空，系统停机
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-800 pt-4">
        <h3 className="text-xs font-semibold text-slate-400 mb-2">添加步骤</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(STEP_DEFINITIONS) as [StepType, typeof STEP_DEFINITIONS[StepType]][]).map(([type, def]) => (
            <button
              key={type}
              onClick={() => addStep(type)}
              className="flex items-center justify-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700 transition-colors"
            >
              <Plus size={14} />
              {def.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
