import { LatLng } from "react-native-maps";

export interface RouteStep {
  maneuver:
    | "turn-left"
    | "turn-right"
    | "straight"
    | "continue"
    | "arrive"
    | null;
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  startLocation: LatLng;
  endLocation: LatLng;
  polyline: string;
  polylineDecoded: LatLng[];
}

export interface Route {
  polyline: string;
  polylineDecoded: LatLng[];
  steps: RouteStep[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  bounds: {
    northeast: LatLng;
    southwest: LatLng;
  };
}

type GoogleDirectionsResponse = {
  status: string;
  error_message?: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    bounds: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
    legs: Array<{
      distance: { value: number };
      duration: { value: number };
      steps: Array<{
        html_instructions?: string;
        maneuver?: string;
        distance: { value: number };
        duration: { value: number };
        start_location: { lat: number; lng: number };
        end_location: { lat: number; lng: number };
        polyline: { points: string };
      }>;
    }>;
  }>;
};

/**
 * Decode a polyline string (Google format) to LatLng array.
 * Based on: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(polyline: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < polyline.length) {
    let result = 0;
    let shift = 0;
    let b;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

/**
 * Extract maneuver type from Google Directions API step instruction.
 */
function extractManeuver(
  instruction: string,
  googleManeuver?: string,
): "turn-left" | "turn-right" | "straight" | "continue" | "arrive" | null {
  const maneuver = googleManeuver?.toLowerCase() ?? "";
  const lower = instruction.toLowerCase();

  if (maneuver.includes("arrive") || lower.includes("arrive")) {
    return "arrive";
  }
  if (maneuver.includes("left") || lower.includes("turn left")) {
    return "turn-left";
  }
  if (maneuver.includes("right") || lower.includes("turn right")) {
    return "turn-right";
  }
  if (lower.includes("keep straight") || lower.includes("straight")) {
    return "straight";
  }
  if (maneuver.includes("straight") || lower.includes("continue")) {
    return "continue";
  }

  return null;
}

/**
 * Fetch a walking route from Google Directions API.
 * Includes timeout (5s) and single retry on failure.
 */
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<Route> {
  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY not configured in environment.",
    );
  }

  const originStr = encodeURIComponent(`${origin.latitude},${origin.longitude}`);
  const destinationStr = encodeURIComponent(
    `${destination.latitude},${destination.longitude}`,
  );

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&mode=walking&key=${apiKey}`;

  let lastError: Error | null = null;

  // Retry once on failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Google Directions API returned ${response.status}`);
      }

      const data = (await response.json()) as GoogleDirectionsResponse;

      if (data.status !== "OK") {
        throw new Error(
          `Google Directions API error: ${data.status} - ${data.error_message || ""}`,
        );
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No routes found");
      }

      const route = data.routes[0];
      const leg = route.legs[0];
      const polyline = route.overview_polyline?.points;
      if (!polyline || !leg) {
        throw new Error("Route response was missing polyline or leg data");
      }

      const polylineDecoded = decodePolyline(polyline);

      const steps: RouteStep[] = [];

      for (let i = 0; i < leg.steps.length; i++) {
        const step = leg.steps[i];
        const maneuver = extractManeuver(
          step.html_instructions || "",
          step.maneuver,
        );

        steps.push({
          maneuver,
          instruction: step.html_instructions?.replace(/<[^>]*>/g, "") || "",
          distance: step.distance.value,
          duration: step.duration.value,
          startLocation: {
            latitude: step.start_location.lat,
            longitude: step.start_location.lng,
          },
          endLocation: {
            latitude: step.end_location.lat,
            longitude: step.end_location.lng,
          },
          polyline: step.polyline.points,
          polylineDecoded: decodePolyline(step.polyline.points),
        });

      }

      const bounds = route.bounds;

      return {
        polyline,
        polylineDecoded,
        steps,
        totalDistance: leg.distance.value,
        totalDuration: leg.duration.value,
        bounds: {
          northeast: {
            latitude: bounds.northeast.lat,
            longitude: bounds.northeast.lng,
          },
          southwest: {
            latitude: bounds.southwest.lat,
          longitude: bounds.southwest.lng,
          },
        },
      };
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[routeService] Attempt ${attempt} failed:`,
        lastError.message,
      );

      if (attempt === 1) {
        // Wait 500ms before retry
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  throw lastError || new Error("Failed to fetch route after retries");
}

/**
 * Calculate bearing (degrees) from point A to point B.
 */
export function calculateBearing(from: LatLng, to: LatLng): number {
  const dLng = (to.longitude - from.longitude) * (Math.PI / 180);
  const lat1 = from.latitude * (Math.PI / 180);
  const lat2 = to.latitude * (Math.PI / 180);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * (180 / Math.PI);

  return (bearing + 360) % 360;
}

/**
 * Calculate distance between two points in meters (Haversine formula).
 */
export function calculateDistance(from: LatLng, to: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const lat1 = from.latitude * (Math.PI / 180);
  const lat2 = to.latitude * (Math.PI / 180);
  const dLat = (to.latitude - from.latitude) * (Math.PI / 180);
  const dLng = (to.longitude - from.longitude) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find the closest point on a polyline to a given location.
 * Returns the index of the closest segment and the distance to it.
 */
export function findClosestPointOnRoute(
  userLocation: LatLng,
  polyline: LatLng[],
): { index: number; distance: number } {
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < polyline.length; i++) {
    const distance = calculateDistance(userLocation, polyline[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  return { index: closestIndex, distance: minDistance };
}
