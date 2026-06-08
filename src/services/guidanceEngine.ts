import { LatLng } from "react-native-maps";
import { RouteStep } from "./routeService";
import { calculateDistance } from "./routeService";
import { voiceService } from "./voiceService";

export interface GuidanceState {
  isNavigating: boolean;
  currentStepIndex: number;
  isOnPath: boolean;
  deviationDistance: number; // meters
  distanceToDestination: number; // meters
  lastSpokenInstruction: string | null;
  lastSpokenTime: number;
  destinationName: string;
}

export interface GuidanceInstruction {
  id?: string;
  text: string;
  type:
    | "start"
    | "turn"
    | "reassurance"
    | "off-course"
    | "arrival"
    | "recalculate";
  priority: "critical" | "important" | "normal";
}

class GuidanceEngine {
  private state: GuidanceState = {
    isNavigating: false,
    currentStepIndex: 0,
    isOnPath: true,
    deviationDistance: 0,
    distanceToDestination: 0,
    lastSpokenInstruction: null,
    lastSpokenTime: 0,
    destinationName: "",
  };

  private steps: RouteStep[] = [];
  private routePolyline: LatLng[] = [];
  private destinationLocation: LatLng | null = null;
  private offCourseSpokenTime: number = 0;
  private lastSpokenInstructionId: string | null = null;
  private spokenAtByInstructionId: Record<string, number> = {};

  /**
   * Initialize navigation with a route and destination.
   */
  startNavigation(
    steps: RouteStep[],
    polyline: LatLng[],
    destinationLocation: LatLng,
    destinationName: string,
    initialStepIndex = 0,
  ) {
    const currentStepIndex = Math.max(
      0,
      Math.min(initialStepIndex, Math.max(steps.length - 1, 0)),
    );

    this.steps = steps;
    this.routePolyline = polyline;
    this.destinationLocation = destinationLocation;

    this.state = {
      isNavigating: true,
      currentStepIndex,
      isOnPath: true,
      deviationDistance: 0,
      distanceToDestination:
        polyline.length > 0
          ? calculateDistance(polyline[0], destinationLocation)
          : 0,
      lastSpokenInstruction: null,
      lastSpokenTime: 0,
      destinationName,
    };
    this.lastSpokenInstructionId = null;
    this.spokenAtByInstructionId = {};

    this.setupAudioSession();
  }

  /**
   * Speak route-start guidance using only RedeeMERP's human instruction map.
   */
  async speakNavigationStarted() {
    if (!this.state.isNavigating) {
      return null;
    }

    const firstInstruction =
      this.mapStepToInstruction(this.steps[0]) ?? "Keep moving straight.";
    const instruction = this.generateInstruction(
      `Navigation started. ${firstInstruction}`,
      "start",
      "important",
      "route-start",
    );

    if (this.canRepeatInstruction(Date.now(), instruction.id!)) {
      await this.speak(instruction.text, instruction.id);
    }

    return instruction;
  }

  /**
   * Stop navigation.
   */
  stopNavigation() {
    this.state.isNavigating = false;
    this.state.currentStepIndex = 0;
    this.lastSpokenInstructionId = null;
    this.spokenAtByInstructionId = {};
  }

  /**
   * Process location update and generate guidance instructions.
   */
  async processLocationUpdate(
    userLocation: LatLng,
  ): Promise<GuidanceInstruction | null> {
    if (!this.state.isNavigating || !this.destinationLocation) {
      return null;
    }

    const now = Date.now();

    // Update distance to destination
    this.state.distanceToDestination = calculateDistance(
      userLocation,
      this.destinationLocation,
    );

    // Check arrival (< 10m)
    if (this.state.distanceToDestination < 10) {
      const instruction = this.generateInstruction(
        `You have arrived at ${this.state.destinationName}.`,
        "arrival",
        "critical",
        "arrival",
      );
      if (instruction) {
        await this.speak(instruction.text, instruction.id);
        this.state.isNavigating = false;
      }
      return instruction;
    }

    // Check almost there (< 50m)
    if (
      this.state.distanceToDestination < 50 &&
      this.canRepeatInstruction(now, "almost-there")
    ) {
      const instruction = this.generateInstruction(
        "You're almost there.",
        "reassurance",
        "important",
        "almost-there",
      );
      if (instruction) {
        await this.speak(instruction.text, instruction.id);
      }
      return instruction;
    }

    // Find closest point on route and check deviation
    const closestPoint = this.findClosestPointOnRoute(userLocation);
    const deviationMeters = closestPoint.distance;
    this.state.deviationDistance = deviationMeters;

    // Off course (> 20m deviation)
    if (deviationMeters > 20) {
      if (this.state.isOnPath) {
        this.state.isOnPath = false;
        this.offCourseSpokenTime = now;

        const offCourseInstruction = this.generateInstruction(
          "You appear to be off course.",
          "off-course",
          "critical",
          "off-course",
        );
        if (offCourseInstruction) {
          await this.speak(offCourseInstruction.text, offCourseInstruction.id);
        }

        // Schedule "Recalculating your route" after 2 seconds
        setTimeout(() => {
          if (
            this.state.isNavigating &&
            !this.state.isOnPath &&
            this.canRepeatInstruction(Date.now(), "recalculate")
          ) {
            this.speak("Recalculating your route.", "recalculate");
          }
        }, 2000);

        return offCourseInstruction;
      }
    } else {
      this.state.isOnPath = true;
    }

    // Get next turn instruction based on proximity
    const nextTurnInstruction = this.getNextTurnInstruction(userLocation, now);
    if (nextTurnInstruction) {
      await this.speak(nextTurnInstruction.text, nextTurnInstruction.id);
      return nextTurnInstruction;
    }

    // Reassurance every 20 seconds if on path and no turn coming
    if (
      this.state.isOnPath &&
      !this.hasUpcomingTurnSoon(userLocation) &&
      this.canRepeatInstruction(now, "reassurance")
    ) {
      const reassurance = this.generateInstruction(
        "You're on the right path. Keep going.",
        "reassurance",
        "normal",
        "reassurance",
      );
      if (reassurance) {
        await this.speak(reassurance.text, reassurance.id);
      }
      return reassurance;
    }

    return null;
  }

  /**
   * Get the next turn instruction if user is approaching a turn.
   * Triggered by proximity, not distance text.
   */
  private getNextTurnInstruction(
    userLocation: LatLng,
    now: number,
  ): GuidanceInstruction | null {
    if (this.state.currentStepIndex >= this.steps.length) {
      return null;
    }

    const nextStepIndex = this.state.currentStepIndex + 1;

    if (nextStepIndex < this.steps.length) {
      const nextStep = this.steps[nextStepIndex];
      const distanceToNextTurn = calculateDistance(
        userLocation,
        nextStep.startLocation,
      );

      // Trigger instruction when within 30m of turn
      if (
        distanceToNextTurn < 30 &&
        this.canRepeatInstruction(now, `turn-${nextStepIndex}`)
      ) {
        this.state.currentStepIndex = nextStepIndex;

        const text = this.mapStepToInstruction(nextStep);

        if (text) {
          return this.generateInstruction(
            text,
            "turn",
            "important",
            `turn-${nextStepIndex}`,
          );
        }
      }
    }

    return null;
  }

  /**
   * Generate a guidance instruction.
   */
  private generateInstruction(
    text: string,
    type: GuidanceInstruction["type"],
    priority: GuidanceInstruction["priority"],
    id?: string,
  ): GuidanceInstruction {
    return { id, text, type, priority };
  }

  private mapStepToInstruction(step?: RouteStep): string | null {
    if (!step) {
      return null;
    }

    if (step.maneuver === "turn-left") {
      return "Turn left now.";
    }
    if (step.maneuver === "turn-right") {
      return "Turn right now.";
    }
    if (step.maneuver === "straight" || step.maneuver === "continue") {
      return "Keep moving straight.";
    }
    if (step.maneuver === "arrive") {
      return `You have arrived at ${this.state.destinationName}.`;
    }

    return "Keep moving straight.";
  }

  private hasUpcomingTurnSoon(userLocation: LatLng): boolean {
    const nextStep = this.steps[this.state.currentStepIndex + 1];
    if (!nextStep) {
      return false;
    }

    const distanceToNextTurn = calculateDistance(
      userLocation,
      nextStep.startLocation,
    );

    return distanceToNextTurn < 30 || nextStep.duration <= 15;
  }

  /**
   * Check if an instruction can be spoken (8-second repeat prevention).
   */
  private canRepeatInstruction(now: number, instructionId: string): boolean {
    const lastSpokenAt = this.spokenAtByInstructionId[instructionId];
    if (lastSpokenAt) {
      const repeatInterval =
        instructionId === "reassurance" || instructionId === "almost-there"
          ? 20000
          : 8000;
      return now - lastSpokenAt >= repeatInterval;
    }
    return true;
  }

  /**
   * Speak instruction using text-to-speech.
   */
  private async speak(text: string, instructionId?: string) {
    this.lastSpokenInstructionId = instructionId ?? text;
    this.state.lastSpokenInstruction = text;
    this.state.lastSpokenTime = Date.now();
    if (instructionId) {
      this.spokenAtByInstructionId[instructionId] =
        this.state.lastSpokenTime;
    }

    try {
      await voiceService.speak(
        text,
        () => {
          console.log("[GuidanceEngine] TTS finished:", text);
        },
        this.priorityForInstruction(instructionId),
      );
    } catch (error) {
      console.error("[GuidanceEngine] TTS error:", error);
    }
  }

  private priorityForInstruction(instructionId?: string) {
    if (
      instructionId === "arrival" ||
      instructionId === "off-course" ||
      instructionId?.startsWith("turn-")
    ) {
      return "critical" as const;
    }

    if (
      instructionId === "route-start" ||
      instructionId === "recalculate" ||
      instructionId === "almost-there"
    ) {
      return "important" as const;
    }

    return "normal" as const;
  }

  /**
   * Find the closest point on the route polyline to user location.
   */
  private findClosestPointOnRoute(userLocation: LatLng): {
    distance: number;
    index: number;
  } {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.routePolyline.length; i++) {
      const distance = calculateDistance(userLocation, this.routePolyline[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return { distance: minDistance, index: closestIndex };
  }

  /**
   * Setup AVAudioSession for iOS to allow playback when phone is locked/silent.
   */
  private async setupAudioSession() {
    try {
      // Initialize voice service audio configuration
      await voiceService.initialize();
      console.log("[GuidanceEngine] Audio session configured");
    } catch (error) {
      console.error("[GuidanceEngine] Failed to setup audio session:", error);
    }
  }

  /**
   * Get current guidance state.
   */
  getState(): GuidanceState {
    return { ...this.state };
  }
}

export const guidanceEngine = new GuidanceEngine();
