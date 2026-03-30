import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ProcessStep, STEP_DEFINITIONS, FloatingText } from '../types';
import { AlertCircle, Gauge, Cpu, CheckCircle2 } from 'lucide-react';

interface ExecutionViewProps {
  processList: ProcessStep[];
  activeStepIndex: number;
  currentStepLoopCount: number;
  stepProgress: number;
  floatingTexts: FloatingText[];
  bottleneck: string | null;
  goldPerSec: number;
  efficiency: number;
}

export function ExecutionView({
  processList,
  activeStepIndex,
  currentStepLoopCount,
  stepProgress,
  floatingTexts,
  bottleneck,
  goldPerSec,
  efficiency
}: ExecutionViewProps) {
  
  const activeStep = processList[activeStepIndex];
  const def = activeStep ? STEP_DEFINITIONS[activeStep.type] : null;

  return (
    <div className="flex-1 flex flex-col relative bg-[#0B0F19] overflow-hidden">
      {/* Floating text layer */}
      <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
        <AnimatePresence>
          {floatingTexts.map(ft => (
            <motion.div
              key={ft.id}
              initial={{ opacity: 0, y: ft.y, x: ft.x, scale: 0.5 }}
              animate={{ opacity: 1, y: ft.y - 40, x: ft.x, scale: 1 }}
              exit={{ opacity: 0, y: ft.y - 60, scale: 0.8 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute text-xl font-bold font-mono tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              style={{ color: ft.color }}
            >
              {ft.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 md:p-6 h-full flex flex-col">
        {/* Header Stats */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">
              实时收益
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-amber-400 font-mono tracking-tight drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                {goldPerSec}
              </span>
              <span className="text-slate-500 font-medium text-sm">G/s</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <Gauge size={12} />
                运行效率
              </span>
              <span className={clsx(
                "font-mono text-lg font-bold drop-shadow-md",
                efficiency >= 90 ? "text-emerald-400" :
                efficiency >= 50 ? "text-yellow-400" : "text-red-400"
              )}>
                {efficiency}%
              </span>
            </div>
          </div>
        </div>

        {/* Center Execution Animation Area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative">
          
          {/* Futuristic Circles Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <div className="w-64 h-64 rounded-full border border-indigo-500 animate-[spin_10s_linear_infinite]" />
            <div className="absolute w-48 h-48 rounded-full border border-dashed border-cyan-500 animate-[spin_15s_linear_infinite_reverse]" />
          </div>

          <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center">
            {processList.length > 0 ? (
              <>
                <div className="mb-4 text-xs font-semibold px-3 py-1 bg-slate-800 text-indigo-300 rounded-full border border-indigo-500/30 flex items-center gap-2">
                  <Cpu size={14} className="animate-pulse" />
                  正在执行 ({activeStepIndex + 1}/{processList.length})
                  {activeStep && activeStep.repeatCount > 1 && ` - 循环 ${currentStepLoopCount + 1}/${activeStep.repeatCount}`}
                </div>

                <div className="w-full bg-slate-800/80 backdrop-blur-sm border border-slate-700 p-8 rounded-2xl shadow-2xl relative">
                  
                  {bottleneck && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 text-xs px-3 py-1 rounded-full border border-red-500 flex items-center gap-1 whitespace-nowrap z-20 shadow-lg shadow-red-900/50"
                    >
                      <AlertCircle size={12} />
                      系统停滞: {bottleneck}
                    </motion.div>
                  )}

                  <div className="flex flex-col items-center mb-6">
                    <span className="text-3xl font-black text-white tracking-wide drop-shadow-lg mb-2">
                      {def?.name}
                    </span>
                    <span className="text-sm font-mono text-slate-400">
                      {((def?.baseTime || 0) / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Core Progress Bar */}
                  <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700 inset-shadow-sm relative">
                    <motion.div
                      className={twMerge(
                        clsx(
                          "h-full rounded-full transition-all duration-75", // Use brief duration so it looks fluid but doesn't lag behind state
                          bottleneck ? "bg-red-500" : "bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                        )
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, stepProgress))}%` }}
                    />
                    
                    {/* Tick markers */}
                    <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-full w-px bg-slate-700/50" />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-2 text-xs font-mono font-medium text-slate-500">
                    <span>0%</span>
                    <span>{Math.floor(stepProgress)}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-slate-500">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <p>流程未配置，系统无法运转</p>
                <p className="text-xs mt-2">请在左侧添加步骤</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Status Tip */}
        <div className="mt-auto pt-6 flex items-center justify-center">
          {efficiency === 100 && processList.length > 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-900/20 px-4 py-2 rounded-full border border-emerald-900/50">
              <CheckCircle2 size={16} />
              系统完美运转中
            </div>
          ) : bottleneck ? (
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium bg-red-900/20 px-4 py-2 rounded-full border border-red-900/50 animate-pulse">
              <AlertCircle size={16} />
              发现瓶颈，请优化资源匹配
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
