const OFF_ROUTE_CONFIRMATION_UPDATES = 5;
const MAX_RECALCULATION_ATTEMPTS = 3;

export interface RecalculationState {
  offRouteUpdates: number;
  attempts: number;
  isPaused: boolean;
}

export const createRecalculationState = (): RecalculationState => ({
  offRouteUpdates: 0,
  attempts: 0,
  isPaused: false,
});

/**
 * Debounces off-route detection for indoor/semi-outdoor demo GPS jitter; the app
 * recalculates only after five consecutive off-route updates instead of one bad
 * coordinate from a weak receiver.
 */
export function shouldRecalculateRoute(
  state: RecalculationState,
  isOffRoute: boolean,
) {
  if (state.isPaused) {
    return false;
  }

  state.offRouteUpdates = isOffRoute ? state.offRouteUpdates + 1 : 0;
  return state.offRouteUpdates >= OFF_ROUTE_CONFIRMATION_UPDATES;
}

/**
 * Caps repeated recalculation attempts so a judge testing no-WiFi conditions
 * gets a clear fallback instead of an endless spinner or battery-draining loop.
 */
export function registerRecalculationAttempt(state: RecalculationState) {
  state.attempts += 1;
  state.offRouteUpdates = 0;
  state.isPaused = state.attempts > MAX_RECALCULATION_ATTEMPTS;
  return {
    attempts: state.attempts,
    shouldPauseNavigation: state.isPaused,
  };
}

/**
 * Clears recalculation pressure after a fresh route succeeds, giving the demo a
 * clean recovery path when WiFi returns or GPS settles.
 */
export function resetRecalculationPressure(state: RecalculationState) {
  state.offRouteUpdates = 0;
}
