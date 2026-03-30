<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function startGame(): void {
  router.push('/play');
}
</script>

<template>
  <div class="welcome">
    <!-- 背景装饰圆 -->
    <div class="bg-circles" aria-hidden="true">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <div class="welcome-body">
      <!-- Logo / 标题区 -->
      <div class="logo-area">
        <div class="logo-icon">⚙</div>
        <h1 class="game-title">AutomaticIdle</h1>
        <p class="game-subtitle">自动化流程 · 积累资源 · 解锁产业链</p>
      </div>

      <!-- 特性卡片 -->
      <div class="feature-grid">
        <div class="feature-card">
          <span class="feature-icon">🔄</span>
          <span class="feature-label">流程自动化</span>
          <span class="feature-desc">编排采集、加工、出售步骤，离线也能持续运转</span>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🏭</span>
          <span class="feature-label">建筑解锁</span>
          <span class="feature-desc">购买建筑开启新的生产配方与资源种类</span>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🔨</span>
          <span class="feature-label">工具加速</span>
          <span class="feature-desc">购置工具降低配方耗时，大幅提升产出效率</span>
        </div>
        <div class="feature-card">
          <span class="feature-icon">📋</span>
          <span class="feature-label">动态订单</span>
          <span class="feature-desc">完成限时订单获取奖励，保持节奏持续输出</span>
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

/* ── 背景装饰 ── */
.bg-circles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.06;
}
.circle-1 {
  width: 600px;
  height: 600px;
  background: var(--indigo);
  top: -160px;
  right: -120px;
  animation: float 12s ease-in-out infinite;
}
.circle-2 {
  width: 400px;
  height: 400px;
  background: var(--cyan);
  bottom: -100px;
  left: -80px;
  animation: float 16s ease-in-out infinite reverse;
}
.circle-3 {
  width: 260px;
  height: 260px;
  background: var(--amber);
  bottom: 120px;
  right: 180px;
  animation: float 10s ease-in-out infinite 2s;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-24px); }
}

/* ── 主体 ── */
.welcome-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
  max-width: 680px;
  width: 100%;
  padding: 0 24px;
}

/* ── Logo 区 ── */
.logo-area {
  text-align: center;
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
</style>
