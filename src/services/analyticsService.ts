export type AnalyticsEventName =
  | 'landing_view'
  | 'click_start_game'
  | 'game_enter'
  | 'first_flow_edit'
  | 'run_start'
  | 'resource_blocked'
  | 'tool_upgrade'
  | 'building_unlock'
  | 'order_complete'
  | 'prestige_confirm';

interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  ts: number;
  sessionId: string;
  props?: Record<string, unknown>;
}

interface AnalyticsSessionAgg {
  id: string;
  startedAt: number;
  lastEventAt: number;
  gameEnterAt: number | null;
  stayMs: number;
  hasEffectiveAction: boolean;
  eventCounts: Partial<Record<AnalyticsEventName, number>>;
}

interface AnalyticsState {
  version: 1;
  installId: string;
  updatedAt: number;
  totalEventCount: number;
  eventCounts: Partial<Record<AnalyticsEventName, number>>;
  sessions: Record<string, AnalyticsSessionAgg>;
  recentEvents: AnalyticsEvent[];
}

export interface AnalyticsSummary {
  startGameClicks: number;
  gameEnterSessions: number;
  averageStaySeconds: number;
  effectiveActionSessions: number;
  funnel: {
    landingViewSessions: number;
    clickStartGameSessions: number;
    gameEnterSessions: number;
    firstFlowEditSessions: number;
    runStartSessions: number;
  };
  eventCounts: Partial<Record<AnalyticsEventName, number>>;
}

const STORAGE_KEY = 'automatic-idle.analytics.v1';
const SESSION_KEY = 'automatic-idle.analytics.session-id';
const INSTALL_KEY = 'automatic-idle.analytics.install-id';
const MAX_RECENT_EVENTS = 400;
const MIN_STAY_MS = 3_000;

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getInstallId(): string {
  if (!isBrowser()) return 'install_ssr';
  const existing = localStorage.getItem(INSTALL_KEY);
  if (existing) return existing;
  const next = randomId('ins');
  localStorage.setItem(INSTALL_KEY, next);
  return next;
}

function getSessionId(): string {
  if (!isBrowser()) return 'session_ssr';
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomId('sess');
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

function createEmptyState(): AnalyticsState {
  return {
    version: 1,
    installId: getInstallId(),
    updatedAt: Date.now(),
    totalEventCount: 0,
    eventCounts: {},
    sessions: {},
    recentEvents: [],
  };
}

function readState(): AnalyticsState {
  if (!isBrowser()) return createEmptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as AnalyticsState;
    if (parsed.version !== 1 || !parsed.sessions || !parsed.eventCounts) {
      return createEmptyState();
    }
    return parsed;
  } catch {
    return createEmptyState();
  }
}

function writeState(state: AnalyticsState): void {
  if (!isBrowser()) return;
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureSession(state: AnalyticsState, sessionId: string): AnalyticsSessionAgg {
  if (!state.sessions[sessionId]) {
    const now = Date.now();
    state.sessions[sessionId] = {
      id: sessionId,
      startedAt: now,
      lastEventAt: now,
      gameEnterAt: null,
      stayMs: 0,
      hasEffectiveAction: false,
      eventCounts: {},
    };
  }
  return state.sessions[sessionId];
}

function increaseCount(
  counts: Partial<Record<AnalyticsEventName, number>>,
  eventName: AnalyticsEventName,
): void {
  counts[eventName] = (counts[eventName] ?? 0) + 1;
}

function hasEvent(session: AnalyticsSessionAgg, eventName: AnalyticsEventName): boolean {
  return (session.eventCounts[eventName] ?? 0) > 0;
}

function isEffectiveAction(eventName: AnalyticsEventName): boolean {
  return eventName === 'first_flow_edit' || eventName === 'order_complete' || eventName === 'prestige_confirm';
}

function track(eventName: AnalyticsEventName, props?: Record<string, unknown>): void {
  if (!isBrowser()) return;
  const ts = Date.now();
  const sessionId = getSessionId();
  const state = readState();
  const session = ensureSession(state, sessionId);

  state.totalEventCount += 1;
  increaseCount(state.eventCounts, eventName);
  increaseCount(session.eventCounts, eventName);
  session.lastEventAt = ts;

  if (eventName === 'game_enter' && session.gameEnterAt == null) {
    session.gameEnterAt = ts;
  }
  if (isEffectiveAction(eventName)) {
    session.hasEffectiveAction = true;
  }

  state.recentEvents.push({ eventName, ts, sessionId, props });
  if (state.recentEvents.length > MAX_RECENT_EVENTS) {
    state.recentEvents.splice(0, state.recentEvents.length - MAX_RECENT_EVENTS);
  }

  writeState(state);
}

export function trackLandingView(): void {
  track('landing_view');
}

export function trackStartGameClick(): void {
  track('click_start_game');
}

export function trackGameEnter(): void {
  track('game_enter');
}

export function trackFirstFlowEdit(): void {
  if (!isBrowser()) return;
  const state = readState();
  const session = ensureSession(state, getSessionId());
  if (hasEvent(session, 'first_flow_edit')) return;
  writeState(state);
  track('first_flow_edit');
}

export function trackRunStart(): void {
  track('run_start');
}

export function trackResourceBlocked(reason: string): void {
  track('resource_blocked', { reason });
}

export function trackToolUpgrade(toolId: string, level: number): void {
  track('tool_upgrade', { toolId, level });
}

export function trackBuildingUnlock(buildingId: string): void {
  track('building_unlock', { buildingId });
}

export function trackOrderComplete(orderId: string): void {
  track('order_complete', { orderId });
}

export function trackPrestigeConfirm(gain: number): void {
  track('prestige_confirm', { gain });
}

export function flushGameStay(): void {
  if (!isBrowser()) return;
  const state = readState();
  const session = ensureSession(state, getSessionId());
  if (session.gameEnterAt == null) {
    writeState(state);
    return;
  }
  const now = Date.now();
  if (now > session.gameEnterAt) {
    session.stayMs += now - session.gameEnterAt;
  }
  session.gameEnterAt = null;
  session.lastEventAt = now;
  writeState(state);
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const state = readState();
  const sessions = Object.values(state.sessions);
  const gameEnterSessions = sessions.filter((s) => (s.eventCounts.game_enter ?? 0) > 0);
  const stayedSessions = gameEnterSessions.filter((s) => s.stayMs >= MIN_STAY_MS);
  const totalStayMs = stayedSessions.reduce((sum, s) => sum + s.stayMs, 0);
  const averageStaySeconds = stayedSessions.length > 0 ? totalStayMs / stayedSessions.length / 1000 : 0;

  return {
    startGameClicks: state.eventCounts.click_start_game ?? 0,
    gameEnterSessions: gameEnterSessions.length,
    averageStaySeconds,
    effectiveActionSessions: sessions.filter((s) => s.hasEffectiveAction).length,
    funnel: {
      landingViewSessions: sessions.filter((s) => (s.eventCounts.landing_view ?? 0) > 0).length,
      clickStartGameSessions: sessions.filter((s) => (s.eventCounts.click_start_game ?? 0) > 0).length,
      gameEnterSessions: gameEnterSessions.length,
      firstFlowEditSessions: sessions.filter((s) => (s.eventCounts.first_flow_edit ?? 0) > 0).length,
      runStartSessions: sessions.filter((s) => (s.eventCounts.run_start ?? 0) > 0).length,
    },
    eventCounts: state.eventCounts,
  };
}
