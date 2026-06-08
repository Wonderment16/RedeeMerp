/**
 * Background Navigation Service
 *
 * Enables voice guidance when screen is locked using:
 * - expo-task-manager for background task registration
 * - expo-location for background location updates
 * - AsyncStorage for state persistence
 *
 * CRITICAL RULES:
 * - Never use distance/time text in guidance
 * - Only relative human instructions (left/right/straight)
 * - Must work with screen locked
 *
 * TEST: Start navigation, lock phone, walk -> voice should continue
 * TEST: Deviate from route -> recalculation voice fires
 * TEST: Arrive -> arrival announcement plays, notification dismissed
 */
// TEST: Start navigation, lock phone, walk → voice should continue
// TEST: Deviate from route → recalculation voice fires
// TEST: Arrive → arrival announcement plays, notification dismissed

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as KeepAwake from "expo-keep-awake";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { LatLng } from "react-native-maps";
import { Destination } from "../types";
import { guidanceEngine } from "./guidanceEngine";
import { calculateDistance, RouteStep } from "./routeService";
import { voiceService } from "./voiceService";

export const BACKGROUND_NAVIGATION_TASK = "BACKGROUND_NAVIGATION_TASK";

const NAVIGATION_STATE_KEY = "@navigation_state";
const KEEP_AWAKE_TAG = "RedeeMERPBackgroundNavigation";
const OFF_ROUTE_THRESHOLD_METERS = 20;
const ARRIVAL_THRESHOLD_METERS = 10;

type PersistedRouteStep = RouteStep;

export interface NavigationState {
  isActive: boolean;
  destination: Destination;
  destinationId: string;
  destinationName: string;
  destinationCoords: LatLng;
  routePolyline: LatLng[];
  routeSteps: PersistedRouteStep[];
  startedAt: number;
  currentStepIndex?: number;
  lastDeviationSpokenAt?: number;
}

interface LocationTaskData {
  locations?: Location.LocationObject[];
}

function destinationToLatLng(destination: Destination): LatLng {
  return {
    latitude: destination.coordinates.lat,
    longitude: destination.coordinates.lng,
  };
}

function coordsToLatLng(coords: Location.LocationObjectCoords): LatLng {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

async function persistNavigationState(state: NavigationState) {
  await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
}

async function requestBackgroundLocationPermission() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return false;
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted;
}

async function hydrateGuidanceEngine(state: NavigationState) {
  await voiceService.initialize();
  guidanceEngine.startNavigation(
    state.routeSteps,
    state.routePolyline,
    state.destinationCoords,
    state.destinationName,
    state.currentStepIndex ?? 0,
  );
}

async function handleBackgroundLocation(location: Location.LocationObject) {
  const navState = await getNavigationState();
  if (!navState || !navState.isActive) {
    return;
  }

  const currentPosition = coordsToLatLng(location.coords);

  if (guidanceEngine.getState().isNavigating === false) {
    await hydrateGuidanceEngine(navState);
  }

  const distanceToDestination = calculateDistance(
    currentPosition,
    navState.destinationCoords,
  );

  if (distanceToDestination <= ARRIVAL_THRESHOLD_METERS) {
    await voiceService.speak(`You have arrived at ${navState.destinationName}.`);
    await stopBackgroundNavigation();
    return;
  }

  const nearestRoutePoint = findNearestPointOnRoute(
    currentPosition,
    navState.routePolyline,
  );

  if (nearestRoutePoint.distance > OFF_ROUTE_THRESHOLD_METERS) {
    await guidanceEngine.processLocationUpdate(currentPosition);
    await persistNavigationState({
      ...navState,
      currentStepIndex: guidanceEngine.getState().currentStepIndex,
      lastDeviationSpokenAt: Date.now(),
    });
    return;
  }

  await guidanceEngine.processLocationUpdate(currentPosition);
  await persistNavigationState({
    ...navState,
    currentStepIndex: guidanceEngine.getState().currentStepIndex,
  });
}

function defineBackgroundNavigationTask() {
  if (TaskManager.isTaskDefined(BACKGROUND_NAVIGATION_TASK)) {
    return;
  }

  TaskManager.defineTask<LocationTaskData>(
    BACKGROUND_NAVIGATION_TASK,
    async ({ data, error }) => {
      if (error) {
        console.error("[backgroundNavigation] Task error:", error);
        return;
      }

      const locations = data?.locations;
      if (!locations || locations.length === 0) {
        return;
      }

      const latestLocation = locations[locations.length - 1];

      try {
        await handleBackgroundLocation(latestLocation);
      } catch (taskError) {
        console.error(
          "[backgroundNavigation] Location update failed:",
          taskError,
        );
      }
    },
  );
}

/**
 * Define the task at module scope. Expo TaskManager requires this because iOS
 * and Android can launch JS directly into the task without mounting React.
 */
defineBackgroundNavigationTask();

/**
 * Initialize background location tracking for navigation.
 * Must be called from the foreground app when navigation starts.
 */
export async function startBackgroundNavigation(
  destination: Destination,
  routePolyline: LatLng[],
  routeSteps: RouteStep[],
) {
  try {
    const destinationCoords = destinationToLatLng(destination);
    const navigationState: NavigationState = {
      isActive: true,
      destination,
      destinationId: destination.id,
      destinationName: destination.name,
      destinationCoords,
      routePolyline,
      routeSteps,
      startedAt: Date.now(),
    };

    await persistNavigationState(navigationState);
    await hydrateGuidanceEngine(navigationState);

    if (Platform.OS !== "web") {
      const hasPermission = await requestBackgroundLocationPermission();
      if (!hasPermission) {
        console.warn(
          "[backgroundNavigation] Always/background location permission denied",
        );
        await clearNavigationState();
        return false;
      }

      await KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);

      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_NAVIGATION_TASK,
      );
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK);
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 3,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "RedeeMERP",
          notificationBody: `Navigating to ${destination.name}`,
          notificationColor: "#8B0000",
          killServiceOnDestroy: false,
        },
      });
    }

    console.log(
      `[backgroundNavigation] Started for ${destination.name}`,
    );
    return true;
  } catch (error) {
    console.error("[backgroundNavigation] Failed to start:", error);
    await clearNavigationState();
    return false;
  }
}

/**
 * Stop background location tracking and clear state.
 */
export async function stopBackgroundNavigation() {
  try {
    if (Platform.OS !== "web") {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_NAVIGATION_TASK,
      );
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_NAVIGATION_TASK);
      }

      await KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
    }

    guidanceEngine.stopNavigation();
    await clearNavigationState();

    console.log("[backgroundNavigation] Stopped");
    return true;
  } catch (error) {
    console.error("[backgroundNavigation] Failed to stop:", error);
    return false;
  }
}

/**
 * Retrieve persisted navigation state from AsyncStorage.
 * Called by the background task to read the current route without React context.
 */
export async function getNavigationState(): Promise<NavigationState | null> {
  try {
    const stateJson = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
    if (!stateJson) {
      return null;
    }

    const state = JSON.parse(stateJson) as NavigationState;
    return state.isActive ? state : null;
  } catch (error) {
    console.error("[backgroundNavigation] Failed to retrieve state:", error);
    return null;
  }
}

/**
 * Clear navigation state when user arrives or navigation stops.
 */
export async function clearNavigationState() {
  try {
    await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
  } catch (error) {
    console.error("[backgroundNavigation] Failed to clear state:", error);
  }
}

/**
 * Re-sync foreground guidance from persisted storage after app resume.
 */
export async function syncNavigationStateFromStorage() {
  const navState = await getNavigationState();
  if (!navState) {
    guidanceEngine.stopNavigation();
    return null;
  }

  await hydrateGuidanceEngine(navState);
  return navState;
}

/**
 * Kept as a no-op compatibility hook for App.tsx. The real registration happens
 * at module scope above, per Expo TaskManager requirements.
 */
export function registerBackgroundTask() {
  defineBackgroundNavigationTask();
}

/**
 * Find nearest point on the active route polyline using segment projection.
 * Returns distance in meters plus the closest segment index.
 */
function findNearestPointOnRoute(
  currentPoint: LatLng,
  polyline: LatLng[],
): { nearestIndex: number; distance: number } {
  if (polyline.length === 0) {
    return { nearestIndex: 0, distance: Infinity };
  }

  if (polyline.length === 1) {
    return { nearestIndex: 0, distance: calculateDistance(currentPoint, polyline[0]) };
  }

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const distance = distanceToSegmentMeters(
      currentPoint,
      polyline[i],
      polyline[i + 1],
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return { nearestIndex, distance: nearestDistance };
}

function distanceToSegmentMeters(point: LatLng, start: LatLng, end: LatLng) {
  const metersPerDegreeLatitude = 111320;
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos((point.latitude * Math.PI) / 180);

  const px = point.longitude * metersPerDegreeLongitude;
  const py = point.latitude * metersPerDegreeLatitude;
  const sx = start.longitude * metersPerDegreeLongitude;
  const sy = start.latitude * metersPerDegreeLatitude;
  const ex = end.longitude * metersPerDegreeLongitude;
  const ey = end.latitude * metersPerDegreeLatitude;

  const dx = ex - sx;
  const dy = ey - sy;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return calculateDistance(point, start);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - sx) * dx + (py - sy) * dy) / segmentLengthSquared),
  );

  const projection: LatLng = {
    latitude: (sy + t * dy) / metersPerDegreeLatitude,
    longitude: (sx + t * dx) / metersPerDegreeLongitude,
  };

  return calculateDistance(point, projection);
}
