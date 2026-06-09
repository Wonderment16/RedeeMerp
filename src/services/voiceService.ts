import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import { setAudioModeAsync as setExpoAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

// Configure audio session on iOS for guidance playback when locked/silent
let audioSessionConfigured = false;
type SpeechPriority = "critical" | "important" | "normal";
type SpeechListener = { remove: () => void };

type QueuedSpeech = {
  text: string;
  priority: SpeechPriority;
  onDone?: () => void;
  resolve: (spoken: boolean) => void;
};

const speechQueue: QueuedSpeech[] = [];
let isSpeaking = false;
let ttsFailureListener: ((text: string) => void) | null = null;
let speechRecognitionListeners: SpeechListener[] = [];

function priorityWeight(priority: SpeechPriority) {
  if (priority === "critical") return 3;
  if (priority === "important") return 2;
  return 1;
}

/**
 * Queues spoken guidance for noisy demos where multiple GPS updates can produce
 * overlapping instructions; urgent turn/arrival prompts jump ahead of pending
 * reassurance, but the currently playing instruction is never cut off.
 */
function enqueueSpeech(text: string, priority: SpeechPriority, onDone?: () => void) {
  return new Promise<boolean>((resolve) => {
    if (priority !== "normal") {
      for (let i = speechQueue.length - 1; i >= 0; i--) {
        if (speechQueue[i].priority === "normal") {
          const [droppedSpeech] = speechQueue.splice(i, 1);
          droppedSpeech.resolve(false);
        }
      }
    }

    speechQueue.push({ text, priority, onDone, resolve });
    speechQueue.sort(
      (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority),
    );
    processSpeechQueue();
  });
}

async function processSpeechQueue() {
  if (isSpeaking) {
    return;
  }

  const nextSpeech = speechQueue.shift();
  if (!nextSpeech) {
    return;
  }

  isSpeaking = true;

  try {
    await configureAudioSession();
    Speech.speak(nextSpeech.text, {
      language: "en-NG",
      rate: 0.85,
      pitch: 1.0,
      onDone: () => {
        nextSpeech.onDone?.();
        nextSpeech.resolve(true);
        isSpeaking = false;
        processSpeechQueue();
      },
      onStopped: () => {
        nextSpeech.resolve(false);
        isSpeaking = false;
        processSpeechQueue();
      },
      onError: (err) => {
        console.error("[voiceService] TTS error:", err);
        ttsFailureListener?.(nextSpeech.text);
        nextSpeech.resolve(false);
        isSpeaking = false;
        processSpeechQueue();
      },
    });
  } catch (e) {
    console.error("[voiceService] Failed to speak text:", e);
    ttsFailureListener?.(nextSpeech.text);
    nextSpeech.resolve(false);
    isSpeaking = false;
    processSpeechQueue();
  }
}

async function configureAudioSession() {
  if (audioSessionConfigured) return;

  try {
    if (Platform.OS === "ios") {
      // iOS: AVAudioSessionCategoryPlayback equivalent for locked/silent playback.
      await setExpoAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "duckOthers",
        shouldRouteThroughEarpiece: false,
      });
      console.log("[voiceService] iOS background playback session configured");
    } else if (Platform.OS === "android") {
      await setExpoAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "duckOthers",
        shouldRouteThroughEarpiece: false,
      });
      console.log("[voiceService] Android background audio configured");
    }
    audioSessionConfigured = true;
  } catch (e) {
    console.error("[voiceService] Audio session configuration failed:", e);
  }
}

export const voiceService = {
  /**
   * Initialize voice service (call once on app start)
   */
  initialize: async () => {
    await configureAudioSession();
  },

  /**
   * Speak a text string using text-to-speech with Nigerian English locale
   * Uses rate: 0.85, pitch: 1.0 for clear guidance audio
   */
  speak: async (
    text: string,
    onDone?: () => void,
    priority: SpeechPriority = "normal",
  ) => enqueueSpeech(text, priority, onDone),

  /**
   * Stop any current speech playback
   */
  stopSpeaking: async () => {
    try {
      await Speech.stop();
      speechQueue.splice(0, speechQueue.length);
      isSpeaking = false;
    } catch (e) {
      console.error("[voiceService] Failed to stop speaking:", e);
    }
  },

  /**
   * Registers a visible fallback for demo devices whose TTS engine is disabled
   * or missing a Nigerian English voice, so judges still see the instruction.
   */
  setTtsFailureListener: (listener: ((text: string) => void) | null) => {
    ttsFailureListener = listener;
  },

  /**
   * Start listening to voice input and handle STT callbacks
   * Uses en-US locale for speech recognition
   */
  startListening: async (
    onSpeechResults: (transcript: string) => void,
    onSpeechPartialResults?: (transcript: string) => void,
    onVolumeChanged?: (volume: number) => void,
    onError?: (error: any) => void,
  ) => {
    try {
      // Unregister first to prevent multiple listeners firing
      await voiceService.cleanupListeners();

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        const error = new Error("Speech recognition permission was not granted.");
        if (onError) onError(error);
        return;
      }

      speechRecognitionListeners = [
        ExpoSpeechRecognitionModule.addListener("start", () =>
          console.log("[voiceService] Speech recognition started"),
        ),
        ExpoSpeechRecognitionModule.addListener("end", () =>
          console.log("[voiceService] Speech recognition ended"),
        ),
        ExpoSpeechRecognitionModule.addListener(
          "error",
          (event: ExpoSpeechRecognitionErrorEvent) => {
            if (event.error === "aborted") {
              return;
            }
            console.warn("[voiceService] Speech recognition error:", event);
            if (onError) onError(event);
          },
        ),
        ExpoSpeechRecognitionModule.addListener(
          "result",
          (event: ExpoSpeechRecognitionResultEvent) => {
            const transcript = event.results[0]?.transcript?.trim();
            if (!transcript) {
              return;
            }

            if (event.isFinal) {
              onSpeechResults(transcript);
            } else if (onSpeechPartialResults) {
              onSpeechPartialResults(transcript);
            }
          },
        ),
        ExpoSpeechRecognitionModule.addListener("volumechange", (event) => {
          if (typeof event.value === "number" && onVolumeChanged) {
            onVolumeChanged(event.value);
          }
        }),
      ];

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 150,
        },
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
          EXTRA_MASK_OFFENSIVE_WORDS: false,
        },
        contextualStrings: [
          "Auditorium",
          "Prayer Ground",
          "Eateries",
          "Bus Terminal",
          "Bookshop",
          "Youth Centre",
          "big church",
        ],
      });
    } catch (e) {
      console.error("[voiceService] Failed to start speech recognition:", e);
      if (onError) onError(e);
    }
  },

  /**
   * Stop the speech recognition process
   */
  stopListening: async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.error("[voiceService] Failed to stop listening:", e);
    }
  },

  /**
   * Reset the voice recognition listener attributes
   */
  cleanupListeners: async () => {
    try {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // It is safe for abort to fail when no recognition session is active.
      }

      speechRecognitionListeners.forEach((listener) => listener.remove());
      speechRecognitionListeners = [];
    } catch (e) {
      console.error("[voiceService] Failed to clean up voice listeners:", e);
    }
  },
};
