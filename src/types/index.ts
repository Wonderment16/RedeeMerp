export interface Destination {
  id: string;
  name: string;
  aliases: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  category: 'auditorium' | 'gate' | 'facility' | 'transit' | 'hostel' | 'office' | 'food';
}

export interface NavigationInstruction {
  id: string;
  text: string;
  distanceMeters: number;
  spoken: boolean;
  coordinate: {
    lat: number;
    lng: number;
  };
}

export interface RouteState {
  isActive: boolean;
  origin: {
    lat: number;
    lng: number;
  } | null;
  destination: Destination | null;
  currentInstructionIndex: number;
  instructions: NavigationInstruction[];
  distanceRemainingMeters: number;
  durationRemainingSeconds: number;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  lastSpokenText: string | null;
  transcript: string | null;
  isMuted: boolean;
}
