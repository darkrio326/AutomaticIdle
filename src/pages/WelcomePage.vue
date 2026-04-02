<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { trackLandingView, trackStartGameClick } from '@/services/analyticsService';

const router = useRouter();

function startGame(): void {
  trackStartGameClick();
  router.push('/play');
}

onMounted(() => {
  trackLandingView();
});

const PARTICLES = [
  { icon: '⛏️', left: 7,  delay: 0,   dur: 9  },
  { icon: '🪨',  left: 17, delay: 2,   dur: 11 },
  { icon: '⚙️',  left: 29, delay: 4.5, dur: 8  },
  { icon: '🔩',  left: 42, delay: 1,   dur: 13 },
  { icon: '💰',  left: 54, delay: 3,   dur: 10 },
  { icon: '🏭',  left: 66, delay: 0.5, dur: 12 },
  { icon: '⛏️',  left: 78, delay: 5,   dur: 9  },
  { icon: '🔧',  left: 89, delay: 2.5, dur: 11 },
  { icon: '💰',  left: 22, delay: 7,   dur: 10 },
  { icon: '⚙️',  left: 59, delay: 6,   dur: 8  },
  { icon: '📦',  left: 73, delay: 1.5, dur: 14 },
  { icon: '🪨',  left: 11, delay: 8,   dur: 9  },
] as const;
</script>

<template>
  <div class="welcome">
    <!-- 背景层：装饰圆 + 浮动粒子 -->
    <div class="bg-layer" aria-hidden="true">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
      <div
        v-for="(p, i) in PARTICLES"
        :key="i"
        class="particle"
        :style="`left:${p.left}%;animation-delay:${p.delay}s;animation-duration:${p.dur}s`"
      >{{ p.icon }}</div>
    </div>

    <div class="welcome-body">
      <!-- Logo / 标题区 -->
      <div class="logo-area">
        <div class="logo-ring"></div>
        <div class="logo-icon">⚙️</div>
        <h1 class="game-title">AutomaticIdle</h1>
        <p class="game-subtitle">设计 · 自动化 · 暴力刷资源</p>
      </div>

      <!-- 传送带跑马灯 -->
      <div class="ticker-wrap" aria-hidden="true">
        <div class="ticker-track">
          <span class="ticker-text">⛏️ 采矿 → 🪨 铁矿石 +2 → 🏭 冶炼 → 🔩 铁锭 +1 → 💰 出售 → 金币 +8 &nbsp;·&nbsp; ⚙️ 流程自动执行 → 📦 订单完成 → 奖励入账 &nbsp;·&nbsp; 🔧 工具加速 −30% → ⚡ 效率提升 → 💰 收益翻倍 &nbsp;·&nbsp; </span>
          <span class="ticker-text" aria-hidden="true">⛏️ 采矿 → 🪨 铁矿石 +2 → 🏭 冶炼 → 🔩 铁锭 +1 → 💰 出售 → 金币 +8 &nbsp;·&nbsp; ⚙️ 流程自动执行 → 📦 订单完成 → 奖励入账 &nbsp;·&nbsp; 🔧 工具加速 −30% → ⚡ 效率提升 → 💰 收益翻倍 &nbsp;·&nbsp; </span>
        </div>
      </div>

      <!-- 特性卡片 -->
      <div class="feature-grid">
        <div class="feature-card">
          <span class="feature-icon">⚙️</span>
          <span class="feature-label">自己设计生产流程</span>
          <span class="feature-desc">自由规划每一步工序，让产线按你的意志全自动运转</span>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🏭</span>
          <span class="feature-label">解锁新的产业链</span>
          <span class="feature-desc">购建建筑，开启铸造、深加工等全新工序与资源</span>
        </div>
        <div class="feature-card">
          <span class="feature-icon">⛏️</span>
          <span class="feature-label">提升效率极限</span>
          <span class="feature-desc">装备趁手的工具，把每道工序的耗时压到极限</span>
        </div>
        <div class="feature-card">
          <span class="feature-icon">📦</span>
          <span class="feature-label">抢时间订单赚奖励</span>
          <span class="feature-desc">限时单子随时刷新，抢节奏完成，奖励直接入账</span>
        </div>
      </div>

      <!-- 开始按钮 -->
      <button class="btn-start" @click="startGame">
        <span class="btn-start-icon">▶</span>
        开始游戏
      </button>

      <p class="version-tag">v0.2 · Early Access</p>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg-root);
}

/* ── 背景层 ── */
.bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.06;
}
.circle-1 {
  width: 600px; height: 600px;
  background: var(--indigo);
  top: -160px; right: -120px;
  animation: float 12s ease-in-out infinite;
}
.circle-2 {
  width: 400px; height: 400px;
  background: var(--cyan);
  bottom: -100px; left: -80px;
  animation: float 16s ease-in-out infinite reverse;
}
.circle-3 {
  width: 260px; height: 260px;
  background: var(--amber);
  bottom: 120px; right: 180px;
  animation: float 10s ease-in-out infinite 2s;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-24px); }
}

/* 浮动粒子图标 */
.particle {
  position: absolute;
  bottom: -40px;
  font-size: 18px;
  opacity: 0;
  animation: rise linear infinite;
  user-select: none;
}
@keyframes rise {
  0%   { transform: translateY(0)     rotate(0deg);   opacity: 0;    }
  10%  {                                               opacity: 0.35; }
  80%  {                                               opacity: 0.18; }
  100% { transform: translateY(-110vh) rotate(25deg); opacity: 0;    }
}

/* ── 主体 ── */
.welcome-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 680px;
  width: 100%;
  padding: 0 24px;
}

/* ── Logo 区 ── */
.logo-area {
  text-align: center;
  position: relative;
}
.logo-ring {
  position: absolute;
  width: 88px; height: 88px;
  border-radius: 50%;
  border: 2px solid var(--indigo);
  top: 0; left: 50%;
  transform: translateX(-50%) scale(0.85);
  opacity: 0;
  animation: pulse-ring 2.8s ease-out infinite;
}
@keyframes pulse-ring {
  0%   { transform: translateX(-50%) scale(0.85); opacity: 0.4; }
  70%  { transform: translateX(-50%) scale(1.7);  opacity: 0;   }
  100% { transform: translateX(-50%) scale(0.85); opacity: 0;   }
}
.logo-icon {
  font-size: 56px;
  line-height: 1;
  margin-bottom: 16px;
  animation: spin-slow 20s linear infinite;
  display: inline-block;
}
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.game-title {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--indigo), var(--cyan) 60%, var(--emerald));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
}
.game-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

/* ── 传送带跑马灯 ── */
.ticker-wrap {
  width: 100%;
  overflow: hidden;
  border-top: 1px solid var(--border-50);
  border-bottom: 1px solid var(--border-50);
  padding: 7px 0;
  mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
}
.ticker-track {
  display: flex;
  width: max-content;
  animation: ticker 24s linear infinite;
}
.ticker-text {
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  padding-right: 0;
  letter-spacing: 0.3px;
}
@keyframes ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ── 特性卡片 ── */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
}
.feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border-50);
  border-radius: var(--r-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.feature-card:hover {
  border-color: var(--indigo);
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.12);
}
.feature-icon {
  font-size: 22px;
  line-height: 1;
}
.feature-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.feature-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ── 开始按钮 ── */
.btn-start {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 48px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--indigo), #4f46e5);
  border: none;
  border-radius: var(--r-full);
  cursor: pointer;
  box-shadow: 0 0 32px var(--indigo-glow);
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 48px var(--indigo-glow);
}
.btn-start:active {
  transform: translateY(0);
}
.btn-start-icon {
  font-size: 14px;
}

/* ── 版本标签 ── */
.version-tag {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
}

@media (max-width: 900px) {
  .welcome {
    min-height: 100dvh;
    height: auto;
    align-items: flex-start;
    padding: max(20px, env(safe-area-inset-top)) 0 max(20px, env(safe-area-inset-bottom));
    overflow-y: auto;
  }

  .welcome-body {
    gap: 20px;
    padding: 8px 16px 24px;
  }

  .logo-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .logo-ring {
    width: 76px;
    height: 76px;
  }

  .game-title {
    font-size: 30px;
  }

  .game-subtitle {
    font-size: 13px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .feature-card {
    padding: 14px;
  }

  .btn-start {
    width: 100%;
    justify-content: center;
    padding: 14px 20px;
  }

  .circle-1 {
    width: 420px;
    height: 420px;
    top: -140px;
    right: -180px;
  }

  .circle-2 {
    width: 280px;
    height: 280px;
    left: -120px;
  }

  .circle-3 {
    width: 180px;
    height: 180px;
    bottom: 180px;
    right: -30px;
  }
}

@media (max-width: 520px) {
  .welcome-body {
    gap: 16px;
    padding-left: 14px;
    padding-right: 14px;
  }

  .game-title {
    font-size: 26px;
  }

  .ticker-wrap {
    padding: 6px 0;
  }

  .ticker-text {
    font-size: 10px;
  }

  .feature-label {
    font-size: 12px;
  }

  .feature-desc {
    font-size: 11px;
  }

  .particle {
    font-size: 15px;
  }
}
</style>
