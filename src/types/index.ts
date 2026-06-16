export type LatLng = {
  lat: number;
  lng: number;
};

export type DestinationCategory =
  | "auditorium"
  | "gate"
  | "facility"
  | "transit"
  | "hostel"
  | "office"
  | "food";

export type Destination = {
  id: string;
  name: string;
  aliases: string[];
  coordinates: LatLng;
  category: DestinationCategory;
};

export type RouteStep = {
  maneuver: "turn-left" | "turn-right" | "straight" | "arrive" | null;
  instruction: string;
  startLocation: LatLng;
  endLocation: LatLng;
  durationSeconds: number;
};

export type Route = {
  polyline: LatLng[];
  steps: RouteStep[];
  totalDurationSeconds: number;
};

export type VoiceState = "idle" | "listening" | "processing";

export type NavigationPhase = "idle" | "selected" | "navigating";

export type LocationStatus = "idle" | "watching" | "unavailable" | "denied";
