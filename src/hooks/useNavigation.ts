import { useState, useEffect, useRef, useCallback } from "react";
import { LatLng } from "react-native-maps";
import { UseLocationResult } from "./useLocation";
import { Route, calculateDistance } from "../services/routeService";
import { guidanceEngine, GuidanceState } from "../services/guidanceEngine";
import {
  syncNavigationStateFromStorage,
  startBackgroundNavigation,
  stopBackgroundNavigation,
} from "../services/backgroundNavigation";
import { Destination } from "../types";
import {
  evaluateGpsSignal,
  GpsSignalState,
} from "../services/gpsResilience";
import {
  createRecalculationState,
  registerRecalculationAttempt,
  resetRecalculationPressure,
  shouldRecalculateRoute,
} from "../services/recalculationResilience";
import { fetchRouteWithCache } from "../services/routeCache";
import { voiceService } from "../services/voiceService";

export interface NavigationState {
  isNavigating: boolean;
  destination: Destination | null;
  route: Route | null;
  routeError: string | null;
  guidanceState: GuidanceState | null;
  isRouteFetching: boolean;
  isRecalculating: boolean;
  nextInstruction: string | null;
  gpsSignal: GpsSignalState;
  gpsMessage: string | null;
  isGuidancePaused: boolean;
  offlineMessage: string | null;
  ttsFallbackText: string | null;
}

const DEFAULT_STATE: NavigationState = {
  isNavigating: false,
  destination: null,
  route: null,
  routeError: null,
  guidanceState: null,
  isRouteFetching: false,
  isRecalculating: false,
  nextInstruction: null,
  gpsSignal: "ok",
  gpsMessage: null,
  isGuidancePaused: false,
  offlineMessage: null,
  ttsFallbackText: null,
};

/**
 * useNavigation hook combines location tracking, route generation, and voice guidance.
 */
export function useNavigation({
  coords,
  heading,
  permissionStatus,
  error: locationError,
  lastLocationAt,
}: UseLocationResult) {
  const [state, setState] = useState<NavigationState>(DEFAULT_STATE);
  const lastProcessedLocationRef = useRef<LatLng | null>(null);
  const gpsSignalRef = useRef<GpsSignalState>("ok");
  const recalculationStateRef = useRef(createRecalculationState());
  const recalculationInFlightRef = useRef(false);

  const buildRouteBounds = useCallback((polyline: LatLng[]) => {
    if (polyline.length === 0) {
      const fallback = { latitude: 0, longitude: 0 };
      return { northeast: fallback, southwest: fallback };
    }

    return polyline.reduce(
      (bounds, point) => ({
        northeast: {
          latitude: Math.max(bounds.northeast.latitude, point.latitude),
          longitude: Math.max(bounds.northeast.longitude, point.longitude),
        },
        southwest: {
          latitude: Math.min(bounds.southwest.latitude, point.latitude),
          longitude: Math.min(bounds.southwest.longitude, point.longitude),
        },
      }),
      {
        northeast: { ...polyline[0] },
        southwest: { ...polyline[0] },
      },
    );
  }, []);

  /**
   * Start navigation to a destination.
   */
  const startNavigation = useCallback(
    async (destination: Destination) => {
      if (!coords) {
        console.warn("[useNavigation] Current location not available");
        return;
      }

      setState((prev) => ({
        ...prev,
        isRouteFetching: true,
        routeError: null,
        destination,
        offlineMessage: null,
      }));
      recalculationStateRef.current = createRecalculationState();

      try {
        const origin: LatLng = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        const destinationLatLng: LatLng = {
          latitude: destination.coordinates.lat,
          longitude: destination.coordinates.lng,
        };

        const { route, usedCache } = await fetchRouteWithCache(
          origin,
          destinationLatLng,
        );

        if (route.steps.length === 0 || route.polylineDecoded.length === 0) {
          throw new Error("Route found, but it did not include guidance steps.");
        }

        // Start guidance engine
        guidanceEngine.startNavigation(
          route.steps,
          route.polylineDecoded,
          destinationLatLng,
          destination.name,
        );

        // Start background navigation (screen locked feature)
        // This enables voice guidance even when app is backgrounded
        const bgSuccess = await startBackgroundNavigation(
          destination,
          route.polylineDecoded,
          route.steps,
        );

        if (!bgSuccess) {
          console.warn("[useNavigation] Background navigation failed to start");
        }

        const startInstruction = await guidanceEngine.speakNavigationStarted();

        setState((prev) => ({
          ...prev,
          isNavigating: true,
          destination,
          route,
          isRouteFetching: false,
          isRecalculating: false,
          guidanceState: guidanceEngine.getState(),
          nextInstruction: startInstruction?.text ?? null,
          offlineMessage: usedCache ? "No internet. Using cached route." : null,
        }));

        console.log("[useNavigation] Navigation started");
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to fetch route";
        console.error("[useNavigation] Route fetch error:", errorMsg);

        setState((prev) => ({
          ...prev,
          isRouteFetching: false,
          routeError: errorMsg,
        }));
      }
    },
    [coords],
  );

  /**
   * Stop navigation.
   */
  const stopNavigation = useCallback(async () => {
    guidanceEngine.stopNavigation();

    // Stop background navigation (screen locked feature)
    await stopBackgroundNavigation();

    setState(DEFAULT_STATE);
  }, []);

  const recalculateRoute = useCallback(
    async (userLocation: LatLng, activeDestination: Destination) => {
      if (recalculationInFlightRef.current) {
        return;
      }

      const attempt = registerRecalculationAttempt(
        recalculationStateRef.current,
      );

      if (attempt.shouldPauseNavigation) {
        await voiceService.speak(
          "Unable to recalculate. Please retrace your steps.",
          undefined,
          "critical",
        );
        setState((prev) => ({
          ...prev,
          isGuidancePaused: true,
          isRecalculating: false,
          routeError: "Navigation paused after repeated recalculation failures.",
        }));
        return;
      }

      recalculationInFlightRef.current = true;
      setState((prev) => ({
        ...prev,
        isRecalculating: true,
        offlineMessage: null,
      }));

      try {
        await voiceService.speak("Recalculating your route.", undefined, "important");

        const destinationLatLng = {
          latitude: activeDestination.coordinates.lat,
          longitude: activeDestination.coordinates.lng,
        };
        const { route: nextRoute, usedCache } = await fetchRouteWithCache(
          userLocation,
          destinationLatLng,
        );

        if (nextRoute.steps.length === 0 || nextRoute.polylineDecoded.length === 0) {
          throw new Error("Recalculated route did not include guidance steps.");
        }

        guidanceEngine.startNavigation(
          nextRoute.steps,
          nextRoute.polylineDecoded,
          destinationLatLng,
          activeDestination.name,
        );
        await startBackgroundNavigation(
          activeDestination,
          nextRoute.polylineDecoded,
          nextRoute.steps,
        );
        resetRecalculationPressure(recalculationStateRef.current);

        setState((prev) => ({
          ...prev,
          route: nextRoute,
          routeError: null,
          isRecalculating: false,
          isGuidancePaused: false,
          guidanceState: guidanceEngine.getState(),
          offlineMessage: usedCache ? "No internet. Using cached route." : null,
        }));
      } catch (error) {
        console.warn("[useNavigation] Recalculation failed:", error);
        await voiceService.speak(
          "Unable to recalculate. Please retrace your steps.",
          undefined,
          "critical",
        );

        setState((prev) => ({
          ...prev,
          isRecalculating: false,
          routeError:
            recalculationStateRef.current.attempts >= 3
              ? "Navigation paused after repeated recalculation failures."
              : "Unable to recalculate. Please retrace your steps.",
          isGuidancePaused: recalculationStateRef.current.attempts >= 3,
        }));
      } finally {
        recalculationInFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    voiceService.setTtsFailureListener((text) => {
      setState((prev) => ({
        ...prev,
        ttsFallbackText: text,
        nextInstruction: text,
      }));
    });

    return () => voiceService.setTtsFailureListener(null);
  }, []);

  /**
   * Rehydrate foreground state after background navigation resumes the app.
   */
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const persistedState = await syncNavigationStateFromStorage();
        if (!isMounted || !persistedState) {
          return;
        }

        const route: Route = {
          polyline: "",
          polylineDecoded: persistedState.routePolyline,
          steps: persistedState.routeSteps,
          totalDistance: 0,
          totalDuration: 0,
          bounds: buildRouteBounds(persistedState.routePolyline),
        };

        setState((prev) => ({
          ...prev,
          isNavigating: true,
          destination: persistedState.destination,
          route,
          routeError: null,
          guidanceState: guidanceEngine.getState(),
          isRouteFetching: false,
        }));
      } catch (error) {
        console.error("[useNavigation] State re-sync failed:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [buildRouteBounds]);

  useEffect(() => {
    if (!state.isNavigating) {
      return;
    }

    const evaluate = async () => {
      const status = evaluateGpsSignal({
        coords,
        lastLocationAt,
        previousSignal: gpsSignalRef.current,
      });

      if (status.signal === "lost" && gpsSignalRef.current !== "lost") {
        await voiceService.speak(status.message!, undefined, "critical");
      }

      if (status.signal === "restored") {
        await voiceService.speak(status.message!, undefined, "important");
      }

      gpsSignalRef.current =
        status.signal === "restored" ? "ok" : status.signal;

      setState((prev) => ({
        ...prev,
        gpsSignal: status.signal === "restored" ? "ok" : status.signal,
        gpsMessage: status.signal === "ok" ? null : status.message,
        isGuidancePaused: status.shouldPauseGuidance
          ? true
          : prev.routeError?.includes("repeated")
            ? prev.isGuidancePaused
            : false,
      }));
    };

    evaluate();
    const intervalId = setInterval(evaluate, 2000);
    return () => clearInterval(intervalId);
  }, [coords, lastLocationAt, state.isNavigating]);

  /**
   * Process location updates for guidance.
   */
  useEffect(() => {
    if (!state.isNavigating || state.isGuidancePaused || !coords) {
      return;
    }

    const userLocation: LatLng = {
      latitude: coords.latitude,
      longitude: coords.longitude,
    };

    // Only process if user moved at least 5 meters
    if (
      lastProcessedLocationRef.current &&
      calculateDistance(lastProcessedLocationRef.current, userLocation) < 5
    ) {
      return;
    }

    lastProcessedLocationRef.current = userLocation;

    (async () => {
      try {
        const instruction =
          await guidanceEngine.processLocationUpdate(userLocation);
        const guidanceSnapshot = guidanceEngine.getState();
        const isOffRoute = guidanceSnapshot.deviationDistance > 20;

        if (
          state.destination &&
          shouldRecalculateRoute(recalculationStateRef.current, isOffRoute)
        ) {
          await recalculateRoute(userLocation, state.destination);
          return;
        }

        if (instruction) {
          setState((prev) => ({
            ...prev,
            guidanceState: guidanceSnapshot,
            nextInstruction: instruction.text,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            guidanceState: guidanceSnapshot,
          }));
        }
      } catch (error) {
        console.error("[useNavigation] Guidance processing error:", error);
      }
    })();
  }, [
    state.isNavigating,
    state.isGuidancePaused,
    state.destination,
    coords,
    recalculateRoute,
  ]);

  return {
    ...state,
    startNavigation,
    stopNavigation,
    currentLocation: coords
      ? { latitude: coords.latitude, longitude: coords.longitude }
      : null,
    heading,
    locationPermissionStatus: permissionStatus,
    locationError,
  };
}
