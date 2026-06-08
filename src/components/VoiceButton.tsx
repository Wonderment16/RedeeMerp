import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import { resolveDestinationDetailed } from "../services/destinationResolver";
import { voiceService } from "../services/voiceService";
import { Destination } from "../types";

type VoiceButtonState = "idle" | "listening" | "processing";

interface VoiceButtonProps {
  onDestinationResolved: (destination: Destination) => void;
  onResolveFailed?: (transcript: string) => void;
  onNeedsConfirmation?: (transcript: string, candidates: Destination[]) => void;
  onStateChange?: (state: VoiceButtonState) => void;
  size?: number;
  idleColor?: string;
}

function MicIcon({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24">
      <Path
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
        fill={color}
      />
    </Svg>
  );
}

export default function VoiceButton({
  onDestinationResolved,
  onResolveFailed,
  onNeedsConfirmation,
  onStateChange,
  size = 80,
  idleColor = "#555555",
}: VoiceButtonProps) {
  const [state, setState] = useState<VoiceButtonState>("idle");
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveformAnim = useRef(new Animated.Value(1)).current;
  const buttonRadius = size / 2;
  const frameSize = size + 16;
  const ringSize = size + 8;
  const ringRadius = ringSize / 2;

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;

    if (state === "listening") {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.22,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => pulse?.stop();
  }, [pulseAnim, state]);

  useEffect(() => {
    Animated.timing(waveformAnim, {
      toValue: 1 + Math.min(Math.max(volume, 0), 10) / 4,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [volume, waveformAnim]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      clearProcessingTimer();
      voiceService.cleanupListeners();
    };
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearProcessingTimer = () => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  };

  const startProcessingFallbackTimer = () => {
    clearProcessingTimer();
    processingTimerRef.current = setTimeout(() => {
      setState((current) => (current === "processing" ? "idle" : current));
    }, 1400);
  };

  const resetSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      stopListening().catch((error) =>
        console.error("[VoiceButton] Auto-stop failed:", error),
      );
    }, 2000);
  };

  const stopListening = async () => {
    clearSilenceTimer();
    await voiceService.stopListening();
    setState((current) =>
      current === "listening" ? "processing" : current,
    );
    startProcessingFallbackTimer();
  };

  const startListening = async () => {
    setTranscript("");
    setVolume(0);
    setState("listening");
    resetSilenceTimer();

    await voiceService.startListening(
      async (result) => {
        clearSilenceTimer();
        clearProcessingTimer();
        setTranscript(result);
        setState("processing");

        try {
          const resolution = await resolveDestinationDetailed(result);
          if (resolution.destination) {
            onDestinationResolved(resolution.destination);
          } else if (resolution.candidates.length > 0) {
            onNeedsConfirmation?.(result, resolution.candidates);
          } else {
            onResolveFailed?.(result);
          }
        } catch (error) {
          console.error("[VoiceButton] Destination resolution failed:", error);
          onResolveFailed?.(result);
        } finally {
          clearProcessingTimer();
          setState("idle");
          setVolume(0);
        }
      },
      (partial) => {
        setTranscript(partial);
        resetSilenceTimer();
      },
      (nextVolume) => {
        setVolume(nextVolume);
        resetSilenceTimer();
      },
      (error) => {
        console.warn("[VoiceButton] Speech recognition error:", error);
        clearSilenceTimer();
        clearProcessingTimer();
        setState("idle");
      },
    );
  };

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics can be unavailable on simulators/web.
    }

    try {
      if (state === "idle") {
        await startListening();
      } else if (state === "listening") {
        await stopListening();
      }
    } catch (error) {
      console.error("[VoiceButton] Voice input failed:", error);
      clearSilenceTimer();
      clearProcessingTimer();
      setState("idle");
    }
  };

  return (
    <View style={styles.container}>
      {state !== "idle" && transcript ? (
        <Text style={styles.transcriptText} numberOfLines={1}>
          {transcript}
        </Text>
      ) : null}

      {state === "listening" ? (
        <View style={styles.waveform} accessibilityElementsHidden>
          {[0.7, 1.1, 0.9, 1.35, 0.8].map((scale, index) => (
            <Animated.View
              key={`${scale}-${index}`}
              style={[
                styles.waveBar,
                {
                  transform: [
                    {
                      scaleY: Animated.multiply(
                        waveformAnim,
                        new Animated.Value(scale),
                      ),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <View style={[styles.buttonFrame, { width: frameSize, height: frameSize }]}>
        {state === "listening" ? (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringRadius,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        ) : null}

        <TouchableOpacity
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: buttonRadius,
              backgroundColor: idleColor,
            },
            state === "listening" && styles.buttonListening,
            state === "processing" && styles.buttonProcessing,
          ]}
          onPress={handlePress}
          disabled={state === "processing"}
          activeOpacity={0.85}
          accessibilityLabel={
            state === "listening" ? "Stop voice input" : "Start voice input"
          }
          accessibilityRole="button"
        >
          {state === "processing" ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <MicIcon />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  transcriptText: {
    color: "#1A1A1A",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    maxWidth: 140,
    textAlign: "center",
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: 18,
    gap: 4,
    marginBottom: 4,
  },
  waveBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: "#8B0000",
  },
  buttonFrame: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(139, 0, 0, 0.18)",
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#555555",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  buttonListening: {
    backgroundColor: "#8B0000",
  },
  buttonProcessing: {
    backgroundColor: "#777777",
  },
});
