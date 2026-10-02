/** Foreground status recovery; see docs/MODEL_PORTFOLIO_ARCHITECTURE.md. */
export function subscribePortfolioResume(appState, refresh, now = Date.now) {
  let previousState = appState.currentState;
  let inFlight = false;
  let lastRefreshAt = -Infinity;
  const listener = appState.addEventListener('change', nextState => {
    const resumed = nextState === 'active' && previousState !== 'active';
    previousState = nextState;
    if (!resumed || inFlight || now() - lastRefreshAt < 15000) return;
    lastRefreshAt = now();
    inFlight = true;
    Promise.resolve().then(refresh).catch(() => {}).finally(() => { inFlight = false; });
  });
  return () => listener.remove();
}
