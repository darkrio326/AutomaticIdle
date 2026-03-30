import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { Resources, Upgrades, ResourceType } from '../types';
import { Pickaxe, Flame, Hammer, Coins, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface StatusPanelProps {
  resources: Resources;
  exp: number;
  level: number;
  expToNextLevel: number;
  upgrades: Upgrades;
  buyUpgrade: (type: keyof Upgrades, cost: number) => void;
}

const RESOURCE_LABELS: Record<ResourceType, string> = {
  gold: '金币',
  ironOre: '铁矿',
  ironIngot: '铁锭',
  ironSword: '铁剑'
};

const UPGRADE_DATA = [
  { id: 'mineSpeed', title: '升级矿镐', desc: '采矿速度 +10%', icon: Pickaxe, type: 'speed' },
  { id: 'smeltSpeed', title: '升级熔炉', desc: '熔炼速度 +10%', icon: Flame, type: 'speed' },
  { id: 'forgeSpeed', title: '升级铁砧', desc: '锻造速度 +10%', icon: Hammer, type: 'speed' },
  { id: 'sellValue', title: '商人契约', desc: '出售收益 +20%', icon: TrendingUp, type: 'yield' },
] as const;

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  // When value changes, trigger a small pulse animation or just update instantly
  // since idle games update rapidly, pure instant update with font-variant-numeric: tabular-nums is often best
  useEffect(() => {
    setDisplayValue(value);
    prevValue.current = value;
  }, [value]);

  return (
    <span className="font-mono tabular-nums text-white font-bold tracking-tight">
      {displayValue.toLocaleString()}
    </span>
  );
}

export function StatusPanel({
  resources,
  exp,
  level,
  expToNextLevel,
  upgrades,
  buyUpgrade
}: StatusPanelProps) {

  const expPercentage = (exp / expToNextLevel) * 100;

  return (
    <div className="w-full flex flex-col h-full bg-slate-900 p-4 shrink-0 overflow-y-auto">
      
      {/* 资源面板 */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Coins size={14} />
          资源库存
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(RESOURCE_LABELS) as [ResourceType, string][]).map(([key, label]) => (
            <div 
              key={key} 
              className={clsx(
                "p-3 rounded-xl border flex flex-col items-center justify-center relative overflow-hidden",
                key === 'gold' ? "bg-amber-900/20 border-amber-700/50" : "bg-slate-800 border-slate-700"
              )}
            >
              <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>
              <AnimatedNumber value={resources[key]} />
            </div>
          ))}
        </div>
      </div>

      {/* 技能 EXP */}
      <div className="mb-8 p-4 bg-indigo-950/30 rounded-2xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full z-0" />
        
        <div className="flex flex-wrap justify-between items-end mb-3 relative z-10 gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-1">系统等级</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-100">Lv.{level}</span>
              <span className="text-[10px] bg-indigo-900/50 px-1.5 py-0.5 rounded text-indigo-300 border border-indigo-700/50">
                全局提速 +{(level - 1) * 5}%
              </span>
            </div>
          </div>
          <div className="text-xs font-mono text-indigo-300 bg-indigo-950/80 px-2 py-1 rounded">
            {Math.floor(exp)} / {expToNextLevel} EXP
          </div>
        </div>
        
        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative z-10 border border-indigo-900/80">
          <motion.div 
            className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${expPercentage}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      {/* 升级面板 */}
      <div className="flex flex-col pb-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Zap size={14} />
          系统升级
        </h2>
        
        <div className="space-y-3 pr-1">
          {UPGRADE_DATA.map((upg) => {
            const currentLevel = upgrades[upg.id as keyof Upgrades];
            // Simple exponential cost
            const cost = Math.floor(100 * Math.pow(1.5, currentLevel - 1));
            const canAfford = resources.gold >= cost;

            const Icon = upg.icon;

            return (
              <div key={upg.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex flex-col relative group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={clsx(
                      "p-1.5 rounded-lg text-slate-300",
                      upg.type === 'speed' ? "bg-blue-900/50" : "bg-emerald-900/50"
                    )}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-200 leading-tight">{upg.title}</div>
                      <div className="text-[10px] text-slate-500">当前等级: {currentLevel}</div>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 mb-3">{upg.desc}</p>
                
                <button
                  onClick={() => buyUpgrade(upg.id as keyof Upgrades, cost)}
                  disabled={!canAfford}
                  className={clsx(
                    "mt-auto w-full py-2 px-3 rounded-lg text-xs font-bold tracking-wide flex items-center justify-between transition-colors",
                    canAfford 
                      ? "bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.2)] hover:shadow-[0_0_15px_rgba(245,158,11,0.4)]" 
                      : "bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600"
                  )}
                >
                  <span>升级系统</span>
                  <div className="flex items-center gap-1 font-mono">
                    <Coins size={10} />
                    {cost.toLocaleString()}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
