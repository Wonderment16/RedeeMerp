import { useCallback, useMemo, useRef, useState } from "react";
import NoSleep from "nosleep.js";
import { RCCG_CAMP_LOCATIONS, isWithinCampBounds } from "../constants/locations";
import { logNavigationEvent } from "../services/firestore";
import { createGuidanceEngine } from "../services/guidanceEngine";
import { fetchRoute, findNearestRouteDistance } from "../services/routeService";
import type { Destination, LatLng, NavigationPhase, Route } from "../types";
import { useLocation } from "./useLocation";
import { useSpeech } from "./useSpeech";

const DEMO_PATH: LatLng[] = [
  { lat: 6.878, lng: 3.732 },
  { lat: 6.875, lng: 3.731 },
  { lat: 6.872, lng: 3.7305 },
  { lat: 6.869, lng: 3.73 },
  { lat: 6.867, lng: 3.7293 },
  { lat: 6.8655, lng: 3.7285 },
];

const DEMO_ROUTE: Route = {
  polyline: DEMO_PATH,
  totalDurationSeconds: 70,
  steps: [
    {
      maneuver: "straight",
      instruction: "Keep moving straight.",
      startLocation: DEMO_PATH[0],
      endLocation: DEMO_PATH[2],
      durationSeconds: 20,
    },
    {
      maneuver: "turn-right",
      instruction: "Turn right now.",
      startLocation: DEMO_PATH[2],
      endLocation: DEMO_PATH[4],
      durationSeconds: 20,
    },
    {
      maneuver: "straight",
      instruction: "Keep moving straight.",
      startLocation: DEMO_PATH[4],
      endLocation: DEMO_PATH[5],
      durationSeconds: 20,
    },
  ],
};

const OFF_ROUTE_DISTANCE_THRESHOLD = 30;
const REROUTE_COOLDOWN_MS = 12000;

export function useNavigation() {
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [phase, setPhase] = useState<NavigationPhase>("idle");
  const [instruction, setInstruction] = useState("Where do you want to go?");
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoTapCountRef = useRef(0);
  const rerouteCooldownRef = useRef(0);
  const rerouteInProgressRef = useRef(false);
  const noSleepRef = useRef(new NoSleep());
  const guidanceEngine = useMemo(() => createGuidanceEngine(), []);
  const { speak, stop } = useSpeech();
  const { location, status: locationStatus, error: locationError } = useLocation({
    demoMode,
    demoPath: DEMO_PATH,
  });

  const selectDestination = useCallback((destination: Destination) => {
    setSelectedDestination(destination);
    setPhase("selected");
    setInstruction(destination.name);
    setError(null);
  }, []);

  const startNavigation = useCallback(async () => {
    if (!selectedDestination) return;

    if (!location && !demoMode) {
      const message =
        "Location is not available. Enable GPS or tap the RCCG logo 3 times to use Demo Mode.";
      setError(message);
      setInstruction(message);
      speak(message);
      setIsLoadingRoute(false);
      return;
    }

    const origin = location ?? DEMO_PATH[0];
    setIsLoadingRoute(true);
    setError(null);

    if (!demoMode && !isWithinCampBounds(origin)) {
      const message =
        "Your location is outside the RCCG camp boundary. Navigation is available only within camp.";
      setError(message);
      setInstruction(message);
      speak(message);
      setIsLoadingRoute(false);
      return;
    }

    try {
      const nextRoute = await fetchRoute(origin, selectedDestination.coordinates);
      setRoute(nextRoute);
      setPhase("navigating");
      await noSleepRef.current.enable();
      guidanceEngine.reset();
      const firstInstruction = guidanceEngine.started(nextRoute);
      setInstruction(firstInstruction);
      speak(firstInstruction);
      logNavigationEvent("navigation_started", {
        destinationId: selectedDestination.id,
        demoMode,
      }).catch(() => {});
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Unable to fetch route.";
      setError(message);
      setInstruction("Unable to fetch route. Please check your internet.");
    } finally {
      setIsLoadingRoute(false);
    }
  }, [demoMode, guidanceEngine, location, selectedDestination, speak]);

  const stopNavigation = useCallback(() => {
    noSleepRef.current.disable();
    stop();
    setRoute(null);
    setPhase(selectedDestination ? "selected" : "idle");
    setInstruction(selectedDestination?.name ?? "Where do you want to go?");
    logNavigationEvent("navigation_stopped", {
      destinationId: selectedDestination?.id,
      demoMode,
    }).catch(() => {});
  }, [selectedDestination, stop]);

  const clearDestination = useCallback(() => {
    noSleepRef.current.disable();
    setSelectedDestination(null);
    setRoute(null);
    setPhase("idle");
    setInstruction("Where do you want to go?");
    setError(null);
  }, []);

  const handleLogoTap = useCallback(() => {
    logoTapCountRef.current += 1;
    window.setTimeout(() => {
      logoTapCountRef.current = Math.max(0, logoTapCountRef.current - 1);
    }, 1400);

    if (logoTapCountRef.current >= 3) {
      const youthCentre = RCCG_CAMP_LOCATIONS.find((destination) => destination.id === "youth-centre");
      setDemoMode(true);
      logoTapCountRef.current = 0;
      if (youthCentre) {
        setSelectedDestination(youthCentre);
        setRoute(DEMO_ROUTE);
        setPhase("navigating");
        guidanceEngine.reset();
        noSleepRef.current.enable();
        const firstInstruction = guidanceEngine.started(DEMO_ROUTE);
        const message = `Demo mode activated. ${firstInstruction}`;
        setInstruction(firstInstruction);
        speak(message);
        logNavigationEvent("demo_mode_started", {
          destinationId: youthCentre.id,
        }).catch(() => {});
      }
    }
  }, [guidanceEngine, speak]);

  const processLocationTick = useCallback(async () => {
    if (!location || !route || !selectedDestination || phase !== "navigating") return;

    const distanceFromRoute = findNearestRouteDistance(location, route.polyline);
    const result = guidanceEngine.update(location, route, selectedDestination);
    const now = Date.now();
    const timeSinceLastReroute = now - rerouteCooldownRef.current;

    const shouldReroute =
      result.offRoute &&
      distanceFromRoute > OFF_ROUTE_DISTANCE_THRESHOLD &&
      !rerouteInProgressRef.current &&
      timeSinceLastReroute >= REROUTE_COOLDOWN_MS;

    if (shouldReroute) {
      rerouteInProgressRef.current = true;
      rerouteCooldownRef.current = now;
      setIsLoadingRoute(true);
      setError(null);

      try {
        const reroutedRoute = await fetchRoute(location, selectedDestination.coordinates);
        setRoute(reroutedRoute);
        guidanceEngine.reset();
        const rerouteInstruction = guidanceEngine.started(reroutedRoute);
        setInstruction(`Recalculated route. ${rerouteInstruction}`);
        speak(`Recalculating route. ${rerouteInstruction}`);
        logNavigationEvent("navigation_rerouted", {
          destinationId: selectedDestination.id,
          distanceFromRoute,
          demoMode,
        }).catch(() => {});
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : "Unable to recalculate route.";
        setError(message);
        setInstruction("Unable to update route. Please check your internet.");
      } finally {
        setIsLoadingRoute(false);
        rerouteInProgressRef.current = false;
      }
      return;
    }

    if (result.offRoute) {
      // Off-route detected, but reroute cooldown or in-progress state will defer recalculation.
    }

    if (result.instruction) {
      setInstruction(result.instruction);
      speak(result.instruction);
    }

    if (result.arrived) {
      noSleepRef.current.disable();
      setPhase("selected");
      logNavigationEvent("navigation_arrived", {
        destinationId: selectedDestination.id,
        demoMode,
      }).catch(() => {});
    }
  }, [demoMode, guidanceEngine, location, phase, route, selectedDestination, speak]);

  return {
    selectedDestination,
    route,
    phase,
    instruction,
    isLoadingRoute,
    location,
    locationStatus,
    locationError,
    demoMode,
    error,
    selectDestination,
    startNavigation,
    stopNavigation,
    clearDestination,
    handleLogoTap,
    processLocationTick,
  };
}
