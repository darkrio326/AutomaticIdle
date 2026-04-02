<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2987602556902981';
const ADSENSE_RENDER_TIMEOUT_MS = 4500;

let adsenseScriptPromise: Promise<void> | null = null;

const isDesktop = ref(false);
const adSlotRef = ref<HTMLElement | null>(null);
const adState = ref<'idle' | 'loading' | 'ready' | 'collapsed'>('idle');

let renderCheckTimer: ReturnType<typeof window.setTimeout> | null = null;
let adObserver: MutationObserver | null = null;

const isAdsenseEnabled = computed(() => import.meta.env.VITE_ENABLE_ADSENSE !== '0');
const showDevPlaceholder = computed(() => import.meta.env.DEV && isDesktop.value && isAdsenseEnabled.value);
const shouldRenderLiveAd = computed(() => import.meta.env.PROD && isDesktop.value && isAdsenseEnabled.value);
const shouldShowShell = computed(() => {
  if (!isDesktop.value || !isAdsenseEnabled.value) return false;
  if (showDevPlaceholder.value) return true;
  return shouldRenderLiveAd.value && adState.value !== 'collapsed';
});

function clearRenderCheckTimer(): void {
  if (renderCheckTimer !== null) {
    window.clearTimeout(renderCheckTimer);
    renderCheckTimer = null;
  }
}

function disconnectAdObserver(): void {
  if (adObserver) {
    adObserver.disconnect();
    adObserver = null;
  }
}

function collapseBanner(): void {
  clearRenderCheckTimer();
  adState.value = 'collapsed';
}

function markBannerReady(): void {
  clearRenderCheckTimer();
  adState.value = 'ready';
}

function hasRenderedAdContent(): boolean {
  const adSlot = adSlotRef.value;
  if (!adSlot) return false;
  if (adSlot.dataset.adStatus === 'filled') return true;
  if (adSlot.dataset.adStatus === 'unfilled') return false;
  if (adSlot.querySelector('iframe')) return true;
  return adSlot.children.length > 0 && adSlot.clientHeight > 0;
}

function syncBannerStateFromSlot(): void {
  const adSlot = adSlotRef.value;
  if (!adSlot) return;

  if (adSlot.dataset.adStatus === 'filled' || hasRenderedAdContent()) {
    markBannerReady();
    return;
  }

  if (adSlot.dataset.adStatus === 'unfilled') {
    collapseBanner();
  }
}

function observeAdSlot(): void {
  const adSlot = adSlotRef.value;
  if (!adSlot) return;

  disconnectAdObserver();
  adObserver = new MutationObserver(() => {
    syncBannerStateFromSlot();
  });
  adObserver.observe(adSlot, {
    attributes: true,
    attributeFilter: ['data-ad-status', 'style'],
    childList: true,
    subtree: true,
  });
}

function scheduleRenderCheck(): void {
  clearRenderCheckTimer();
  renderCheckTimer = window.setTimeout(() => {
    syncBannerStateFromSlot();
    if (adState.value !== 'ready') collapseBanner();
  }, ADSENSE_RENDER_TIMEOUT_MS);
}

function ensureAdsenseScript(): Promise<void> {
  if (adsenseScriptPromise) return adsenseScriptPromise;

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${ADSENSE_SCRIPT_SRC}"]`);
  if (existingScript) {
    adsenseScriptPromise = Promise.resolve();
    return adsenseScriptPromise;
  }

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = ADSENSE_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load AdSense script'));
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}

async function initAd(): Promise<void> {
  if (!shouldRenderLiveAd.value || !adSlotRef.value) return;

  try {
    adState.value = 'loading';
    await ensureAdsenseScript();
    observeAdSlot();
    if (adSlotRef.value.dataset.adsInitialized !== 'true') {
      adSlotRef.value.dataset.adsInitialized = 'true';
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
    syncBannerStateFromSlot();
    scheduleRenderCheck();
  } catch {
    collapseBanner();
  }
}

onMounted(async () => {
  isDesktop.value = window.matchMedia('(min-width: 901px)').matches;
  if (!isAdsenseEnabled.value) {
    collapseBanner();
    return;
  }
  await initAd();
});

onBeforeUnmount(() => {
  clearRenderCheckTimer();
  disconnectAdObserver();
});
</script>

<template>
  <section v-if="shouldShowShell" class="ad-banner-shell" aria-label="Sponsored">
    <div class="ad-banner-frame">
      <div class="ad-banner-label">Sponsored</div>
      <div v-if="showDevPlaceholder" class="ad-banner-placeholder">
        AdSense Banner 预览位
      </div>
      <ins
        v-else-if="shouldRenderLiveAd"
        ref="adSlotRef"
        class="adsbygoogle ad-banner-slot"
        style="display:block"
        data-ad-client="ca-pub-2987602556902981"
        data-ad-slot="6426015614"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
      <div v-if="shouldRenderLiveAd && adState === 'loading'" class="ad-banner-fallback">
        广告位加载中...
      </div>
    </div>
  </section>
</template>

<style scoped>
.ad-banner-shell {
  flex-shrink: 0;
  padding: 10px 18px 14px;
  border-top: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(11, 15, 25, 0.96), rgba(15, 23, 42, 0.98));
}

.ad-banner-frame {
  min-height: 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: var(--r-lg);
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.18);
}

.ad-banner-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.ad-banner-slot,
.ad-banner-placeholder,
.ad-banner-fallback {
  width: 100%;
  min-height: 58px;
}

.ad-banner-placeholder,
.ad-banner-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(99, 102, 241, 0.4);
  border-radius: var(--r-md);
  color: var(--text-muted);
  background: rgba(30, 41, 59, 0.55);
}

.ad-banner-placeholder {
  color: var(--text);
}

@media (max-width: 900px) {
  .ad-banner-shell {
    display: none;
  }
}
</style>