import type { Destination, LatLng, Route } from "../types";
import { calculateDistance, findNearestRouteDistance } from "./routeService";

const MIN_REPEAT_INTERVAL = 8000;
const REASSURANCE_INTERVAL = 20000;
const OFF_ROUTE_THRESHOLD = 30;
const ALMOST_THERE_THRESHOLD = 50;
const ARRIVAL_THRESHOLD = 25;

type GuidanceMemory = {
  lastInstruction: string | null;
  lastInstructionAt: number;
  lastReassuranceAt: number;
  arrived: boolean;
};

export type GuidanceResult = {
  instruction: string | null;
  arrived: boolean;
  offRoute: boolean;
};

function speakableTurn(maneuver: string | null) {
  if (maneuver === "turn-left") return "Turn left now.";
  if (maneuver === "turn-right") return "Turn right now.";
  if (maneuver === "straight") return "Keep moving straight.";
  return null;
}

export function createGuidanceEngine() {
  const memory: GuidanceMemory = {
    lastInstruction: null,
    lastInstructionAt: 0,
    lastReassuranceAt: 0,
    arrived: false,
  };

  function shouldSpeak(instruction: string, now: number) {
    return (
      instruction !== memory.lastInstruction ||
      now - memory.lastInstructionAt >= MIN_REPEAT_INTERVAL
    );
  }

  function remember(instruction: string, now: number) {
    memory.lastInstruction = instruction;
    memory.lastInstructionAt = now;
  }

  return {
    reset() {
      memory.lastInstruction = null;
      memory.lastInstructionAt = 0;
      memory.lastReassuranceAt = 0;
      memory.arrived = false;
    },
    started(route: Route) {
      const firstInstruction =
        route.steps.map((step) => speakableTurn(step.maneuver)).find(Boolean) ??
        "Keep moving straight.";
      const instruction = `Navigation started. ${firstInstruction}`;
      remember(instruction, Date.now());
      return instruction;
    },
    update(location: LatLng, route: Route, destination: Destination): GuidanceResult {
      const now = Date.now();
      const distanceToDestination = calculateDistance(location, destination.coordinates);
      const offRoute = findNearestRouteDistance(location, route.polyline) > OFF_ROUTE_THRESHOLD;

      if (memory.arrived) {
        return { instruction: null, arrived: true, offRoute: false };
      }

      if (distanceToDestination < ARRIVAL_THRESHOLD) {
        const instruction = `You have arrived at ${destination.name}.`;
        memory.arrived = true;
        remember(instruction, now);
        return { instruction, arrived: true, offRoute: false };
      }

      if (offRoute) {
        const instruction = "You appear to be off course. Recalculating.";
        if (shouldSpeak(instruction, now)) {
          remember(instruction, now);
          return { instruction, arrived: false, offRoute: true };
        }
        return { instruction: null, arrived: false, offRoute: true };
      }

      if (distanceToDestination < ALMOST_THERE_THRESHOLD) {
        const instruction = "You're almost there.";
        if (shouldSpeak(instruction, now)) {
          remember(instruction, now);
          return { instruction, arrived: false, offRoute: false };
        }
      }

      const upcomingTurn = route.steps.find(
        (step) =>
          step.maneuver &&
          step.maneuver !== "arrive" &&
          calculateDistance(location, step.startLocation) < 18,
      );
      const turnInstruction = upcomingTurn ? speakableTurn(upcomingTurn.maneuver) : null;
      if (turnInstruction && shouldSpeak(turnInstruction, now)) {
        remember(turnInstruction, now);
        return { instruction: turnInstruction, arrived: false, offRoute: false };
      }

      if (now - memory.lastReassuranceAt >= REASSURANCE_INTERVAL) {
        const instruction = "You're on the right path.";
        memory.lastReassuranceAt = now;
        if (shouldSpeak(instruction, now)) {
          remember(instruction, now);
          return { instruction, arrived: false, offRoute: false };
        }
      }

      return { instruction: null, arrived: false, offRoute: false };
    },
  };
}
