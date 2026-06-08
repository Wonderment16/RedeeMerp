import type * as Location from "expo-location";
import type { LatLng } from "react-native-maps";

export type GpsSignalState = "ok" | "weak" | "lost" | "restored";

export interface GpsResilienceStatus {
  signal: GpsSignalState;
  shouldPauseGuidance: boolean;
  message: string | null;
}

const GPS_WEAK_ACCURACY_METERS = 20;
const GPS_LOST_AFTER_MS = 10000;

/**
 * Smooths noisy indoor/semi-outdoor GPS so a judge standing near a doorway does
 * not trigger rapid left/right/off-course guidance from normal receiver jitter.
 */
export class KalmanLocationFilter {
  private estimate: LatLng | null = null;
  private variance = 1;

  smooth(coords: Location.LocationObjectCoords): Location.LocationObjectCoords {
    if (!this.estimate) {
      this.estimate = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      return coords;
    }

    const accuracy = Math.max(coords.accuracy ?? GPS_WEAK_ACCURACY_METERS, 1);
    const measurementVariance = accuracy * accuracy;
    const gain = this.variance / (this.variance + measurementVariance);

    this.estimate = {
      latitude:
        this.estimate.latitude + gain * (coords.latitude - this.estimate.latitude),
      longitude:
        this.estimate.longitude +
        gain * (coords.longitude - this.estimate.longitude),
    };
    this.variance = (1 - gain) * this.variance + 0.01;

    return {
      ...coords,
      latitude: this.estimate.latitude,
      longitude: this.estimate.longitude,
    };
  }

  reset() {
    this.estimate = null;
    this.variance = 1;
  }
}

/**
 * Evaluates GPS health for demo venues where the phone may move between indoor,
 * canopy, and open-air zones; weak accuracy warns visually, while a prolonged
 * outage pauses spoken guidance until a trustworthy fix returns.
 */
export function evaluateGpsSignal({
  coords,
  lastLocationAt,
  previousSignal,
  now = Date.now(),
}: {
  coords: Location.LocationObjectCoords | null;
  lastLocationAt: number | null;
  previousSignal: GpsSignalState;
  now?: number;
}): GpsResilienceStatus {
  const hasTimedOut = !lastLocationAt || now - lastLocationAt > GPS_LOST_AFTER_MS;

  if (!coords || hasTimedOut) {
    return {
      signal: "lost",
      shouldPauseGuidance: true,
      message: "GPS signal lost. Please move to an open area.",
    };
  }

  if (previousSignal === "lost") {
    return {
      signal: "restored",
      shouldPauseGuidance: false,
      message: "GPS restored. Continuing navigation.",
    };
  }

  if ((coords.accuracy ?? 0) > GPS_WEAK_ACCURACY_METERS) {
    return {
      signal: "weak",
      shouldPauseGuidance: false,
      message: "Weak GPS signal",
    };
  }

  return {
    signal: "ok",
    shouldPauseGuidance: false,
    message: null,
  };
}

const DEMO_PATH_TO_YOUTH_CENTRE: LatLng[] = [
  { latitude: 6.8698, longitude: 3.7292 },
  { latitude: 6.8692, longitude: 3.7290 },
  { latitude: 6.8686, longitude: 3.7288 },
  { latitude: 6.8678, longitude: 3.7287 },
  { latitude: 6.8670, longitude: 3.7286 },
  { latitude: 6.8662, longitude: 3.72855 },
  { latitude: 6.8655, longitude: 3.7285 },
];

/**
 * Provides a development-only walking path to Youth Centre so judges can watch
 * route progress and voice prompts without physically walking around camp.
 */
export function getDemoLocationPoint(index: number): Location.LocationObjectCoords {
  const point =
    DEMO_PATH_TO_YOUTH_CENTRE[index % DEMO_PATH_TO_YOUTH_CENTRE.length];

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    altitude: 200,
    accuracy: 8,
    altitudeAccuracy: 5,
    heading: 180,
    speed: 1.2,
  };
}
