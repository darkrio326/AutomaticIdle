import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ProcessStep, Resources, StepType, Upgrades, STEP_DEFINITIONS, FloatingText } from '../types';

export const INITIAL_RESOURCES: Resources = {
  gold: 0,
  ironOre: 0,
  ironIngot: 0,
  ironSword: 0,
};

export const INITIAL_UPGRADES: Upgrades = {
  mineSpeed: 1,
  smeltSpeed: 1,
  forgeSpeed: 1,
  sellValue: 1,
};

export const INITIAL_PROCESS: ProcessStep[] = [
  { id: uuidv4(), type: 'mine', executionCount: 0, repeatCount: 1 },
  { id: uuidv4(), type: 'smelt', executionCount: 0, repeatCount: 1 },
  { id: uuidv4(), type: 'forge', executionCount: 0, repeatCount: 1 },
  { id: uuidv4(), type: 'sell', executionCount: 0, repeatCount: 1 },
];

export function useGameEngine() {
  const [renderCounter, setRenderCounter] = useState(0);

  // Core state stored in refs to prevent closure staleness and sync issues
  const stateRef = useRef({
    resources: { ...INITIAL_RESOURCES },
    upgrades: { ...INITIAL_UPGRADES },
    processList: [...INITIAL_PROCESS],
    activeStepIndex: 0,
    currentStepLoopCount: 0,
    stepProgress: 0,
    exp: 0,
    level: 1,
    bottleneck: null as string | null,
    goldPerSec: 0,
    efficiency: 100,
  });

  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  
  const lastTimeRef = useRef<number>(performance.now());
  const incomeHistory = useRef<{time: number, amount: number}[]>([]);
  const attemptsHistory = useRef<{time: number, success: boolean}[]>([]);
  
  const addFloatingText = useCallback((text: string, color: string) => {
    const id = uuidv4();
    const x = (Math.random() - 0.5) * 60; 
    const y = (Math.random() - 0.5) * 40;
    setFloatingTexts(prev => [...prev, { id, text, x, y, color }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 1200);
  }, []);

  const executeStep = useCallback(() => {
    const state = stateRef.current;
    if (state.processList.length === 0) return;
    
    const stepIndex = state.activeStepIndex;
    const step = state.processList[stepIndex];
    if (!step) {
      state.activeStepIndex = 0;
      state.currentStepLoopCount = 0;
      state.stepProgress = 0;
      return;
    }
    
    const def = STEP_DEFINITIONS[step.type];
    
    let canExecute = true;
    let missingRes = '';
    if (def.cost) {
      for (const [res, amt] of Object.entries(def.cost)) {
        if (state.resources[res as keyof Resources] < (amt as number)) {
          canExecute = false;
          missingRes = res;
          break;
        }
      }
    }

    const now = performance.now();
    attemptsHistory.current.push({ time: now, success: canExecute });

    if (canExecute) {
      if (def.cost) {
        for (const [res, amt] of Object.entries(def.cost)) {
          state.resources[res as keyof Resources] -= (amt as number);
        }
      }
      
      if (def.yield) {
        for (const [res, amt] of Object.entries(def.yield)) {
          let yieldAmount = amt as number;
          if (step.type === 'sell' && res === 'gold') {
            yieldAmount = Math.floor(yieldAmount * (1 + (state.upgrades.sellValue - 1) * 0.2));
            incomeHistory.current.push({ time: now, amount: yieldAmount });
          }
          state.resources[res as keyof Resources] += yieldAmount;
          
          if (res === 'gold') addFloatingText(`+${yieldAmount} 金币`, '#FBBF24');
          if (res === 'ironOre') addFloatingText(`+${yieldAmount} 铁矿`, '#9CA3AF');
          if (res === 'ironIngot') addFloatingText(`+${yieldAmount} 铁锭`, '#F3F4F6');
          if (res === 'ironSword') addFloatingText(`+${yieldAmount} 铁剑`, '#60A5FA');
        }
      }
      
      state.exp += def.expYield;
      if (state.exp >= state.level * 100) {
        state.exp -= state.level * 100;
        state.level++;
        addFloatingText(`等级提升!`, '#34D399');
      }
      
      state.processList[stepIndex] = {
        ...step,
        executionCount: step.executionCount + 1
      };
      
      state.bottleneck = null;

      state.currentStepLoopCount += 1;
      if (state.currentStepLoopCount >= step.repeatCount) {
        state.activeStepIndex = (stepIndex + 1) % state.processList.length;
        state.currentStepLoopCount = 0;
      }

    } else {
      const resName = missingRes === 'ironOre' ? '铁矿' : missingRes === 'ironIngot' ? '铁锭' : missingRes === 'ironSword' ? '铁剑' : missingRes;
      state.bottleneck = `缺 ${resName} (在 ${def.name})`;

      state.activeStepIndex = (stepIndex + 1) % state.processList.length;
      state.currentStepLoopCount = 0;
    }

    state.stepProgress = 0;
  }, [addFloatingText]);

  // Main game loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = (time: number) => {
      const state = stateRef.current;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (state.processList.length > 0) {
        const step = state.processList[state.activeStepIndex];
        if (step) {
          const def = STEP_DEFINITIONS[step.type];
          
          let speedMultiplier = 1;
          if (step.type === 'mine') speedMultiplier = 1 + (state.upgrades.mineSpeed - 1) * 0.1;
          if (step.type === 'smelt') speedMultiplier = 1 + (state.upgrades.smeltSpeed - 1) * 0.1;
          if (step.type === 'forge') speedMultiplier = 1 + (state.upgrades.forgeSpeed - 1) * 0.1;
          
          // Apply global level bonus
          speedMultiplier *= (1 + (state.level - 1) * 0.05);
          
          // Clamp delta time to avoid huge jumps on tab switch
          const safeDelta = Math.min(deltaTime, 1000); 
          const timeRequired = def.baseTime / speedMultiplier;
          
          state.stepProgress += (safeDelta / timeRequired) * 100;
          
          if (state.stepProgress >= 100) {
            executeStep();
          }
        } else {
          state.activeStepIndex = 0;
          state.currentStepLoopCount = 0;
        }
      }

      // Stats calculation (throttle slightly)
      if (Math.random() < 0.2) {
        const now = performance.now();
        incomeHistory.current = incomeHistory.current.filter(i => now - i.time < 5000);
        const totalIncomeLast5Sec = incomeHistory.current.reduce((sum, item) => sum + item.amount, 0);
        state.goldPerSec = Math.round(totalIncomeLast5Sec / 5);

        attemptsHistory.current = attemptsHistory.current.filter(a => now - a.time < 10000);
        if (attemptsHistory.current.length > 0) {
          const successCount = attemptsHistory.current.filter(a => a.success).length;
          state.efficiency = Math.round((successCount / attemptsHistory.current.length) * 100);
        } else {
          state.efficiency = 100;
        }
      }

      setRenderCounter(prev => prev + 1); // Trigger React re-render
      animationFrameId = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [executeStep]);

  // External Actions
  const addStep = (type: StepType) => {
    stateRef.current.processList.push({ id: uuidv4(), type, executionCount: 0, repeatCount: 1 });
  };

  const removeStep = (id: string) => {
    const state = stateRef.current;
    const idx = state.processList.findIndex(p => p.id === id);
    if (idx !== -1) {
      state.processList.splice(idx, 1);
      if (state.activeStepIndex >= idx && state.activeStepIndex > 0) {
        state.activeStepIndex -= 1;
      }
      state.currentStepLoopCount = 0;
      state.stepProgress = 0;
    }
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const state = stateRef.current;
    const list = state.processList;
    if (direction === 'up' && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      state.activeStepIndex = 0;
      state.currentStepLoopCount = 0;
      state.stepProgress = 0;
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
      state.activeStepIndex = 0;
      state.currentStepLoopCount = 0;
      state.stepProgress = 0;
    }
  };

  const updateStepRepeat = (id: string, count: number) => {
    const state = stateRef.current;
    const step = state.processList.find(p => p.id === id);
    if (step) {
      step.repeatCount = Math.max(1, count);
    }
  };

  const buyUpgrade = (type: keyof Upgrades, cost: number) => {
    const state = stateRef.current;
    if (state.resources.gold >= cost) {
      state.resources.gold -= cost;
      state.upgrades[type] += 1;
    }
  };

  return {
    ...stateRef.current,
    resources: { ...stateRef.current.resources },
    upgrades: { ...stateRef.current.upgrades },
    processList: [...stateRef.current.processList],
    expToNextLevel: stateRef.current.level * 100,
    floatingTexts,
    addStep,
    removeStep,
    moveStep,
    updateStepRepeat,
    buyUpgrade,
  };
}
