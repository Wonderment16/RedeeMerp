import type { LatLng, Route, RouteStep } from "../types";

type OrsCoordinate = [number, number];

type OrsStep = {
  instruction?: string;
  type?: number;
  duration?: number;
  way_points?: [number, number];
};

type OrsGeoJsonResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: OrsCoordinate[];
    };
    properties?: {
      summary?: {
        duration?: number;
      };
      segments?: Array<{
        steps?: OrsStep[];
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function orsCoordinateToLatLng(coordinate: OrsCoordinate): LatLng {
  return { lat: coordinate[1], lng: coordinate[0] };
}

function cleanInstruction(instruction = "") {
  return instruction.replace(/\s+/g, " ").trim();
}

function toManeuver(step: OrsStep): RouteStep["maneuver"] {
  const text = cleanInstruction(step.instruction).toLowerCase();

  if (text.includes("arrive") || step.type === 10) return "arrive";
  if (text.includes("left")) return "turn-left";
  if (text.includes("right")) return "turn-right";
  if (
    text.includes("straight") ||
    text.includes("continue") ||
    text.includes("head")
  ) {
    return "straight";
  }

  return null;
}

function stepPoint(polyline: LatLng[], index: number | undefined) {
  if (polyline.length === 0) return { lat: 0, lng: 0 };
  if (typeof index !== "number") return polyline[0];
  return polyline[Math.max(0, Math.min(index, polyline.length - 1))];
}

export function calculateDistance(from: LatLng, to: LatLng) {
  const radius = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestRouteDistance(location: LatLng, polyline: LatLng[]) {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...polyline.map((point) => calculateDistance(location, point)));
}

export async function fetchRoute(origin: LatLng, destination: LatLng): Promise<Route> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY;
  console.log(import.meta.env.VITE_ORS_API_KEY);
  if (!apiKey) {
    throw new Error("VITE_ORS_API_KEY is not configured.");
  }

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/geo+json, application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        instructions: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouteService returned ${response.status}`);
  }

  const data = (await response.json()) as OrsGeoJsonResponse;
  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!feature || !coordinates || coordinates.length === 0) {
    throw new Error("No walking route found.");
  }

  const polyline = coordinates.map(orsCoordinateToLatLng);
  const steps =
    feature.properties?.segments?.flatMap((segment) => segment.steps ?? []) ?? [];

  return {
    polyline,
    totalDurationSeconds: feature.properties?.summary?.duration ?? 0,
    steps: steps.map((step) => ({
      maneuver: toManeuver(step),
      instruction: cleanInstruction(step.instruction),
      startLocation: stepPoint(polyline, step.way_points?.[0]),
      endLocation: stepPoint(polyline, step.way_points?.[1]),
      durationSeconds: step.duration ?? 0,
    })),
  };
}
