import { useCallback, useRef, useState } from "react";
import type { VoiceState } from "../types";

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative | undefined;
};

type SpeechRecognitionResultListLike = {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike | undefined;
};

type SpeechRecognitionEventLike = {
  readonly results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  readonly error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void | Promise<void>) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type UseVoiceOptions = {
  onTranscript: (transcript: string) => Promise<void> | void;
};

export function useVoice({ onTranscript }: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-NG";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    setTranscript("");
    setError(null);
    setState("listening");

    const resetSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimerRef.current = window.setTimeout(() => recognition.stop(), 2000);
    };

    recognition.onresult = async (event) => {
      const result = event.results[event.results.length - 1];
      if (!result) return;
      const nextTranscript = result[0]?.transcript?.trim() ?? "";
      setTranscript(nextTranscript);
      resetSilenceTimer();

      if (result.isFinal && nextTranscript) {
        clearSilenceTimer();
        setState("processing");
        await onTranscript(nextTranscript);
        setState("idle");
      }
    };

    recognition.onerror = (event) => {
      setError(event.error);
      setState("idle");
      clearSilenceTimer();
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setState((current) => (current === "processing" ? current : "idle"));
    };

    recognition.start();
    resetSilenceTimer();
  }, [onTranscript]);

  const toggle = useCallback(() => {
    if (state === "listening") {
      stopListening();
    } else if (state === "idle") {
      startListening();
    }
  }, [startListening, state, stopListening]);

  return { state, transcript, error, toggle, startListening, stopListening };
}
