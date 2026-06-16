import type { VoiceState } from "../types";

type VoiceButtonProps = {
  state: VoiceState;
  transcript: string;
  error: string | null;
  onPress: () => void;
};

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
    >
      <path
        d="M12 14.25c1.66 0 3-1.34 3-3V6.75c0-1.66-1.34-3-3-3s-3 1.34-3 3v4.5c0 1.66 1.34 3 3 3Z"
        fill="currentColor"
      />
      <path
        d="M6.75 10.75a.75.75 0 0 1 1.5 0A3.75 3.75 0 0 0 12 14.5a3.75 3.75 0 0 0 3.75-3.75.75.75 0 0 1 1.5 0 5.25 5.25 0 0 1-4.5 5.2v2.3h2a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5h2v-2.3a5.25 5.25 0 0 1-4.5-5.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function VoiceButton({
  state,
  transcript,
  error,
  onPress,
}: VoiceButtonProps) {
  const isListening = state === "listening";
  const isProcessing = state === "processing";

  return (
    <div className="flex flex-col items-center gap-2">
      {transcript ? (
        <p className="max-w-36 truncate rounded-full bg-[#FFF8D8] px-3 py-1 text-center text-xs font-bold text-[#8B0000]">
          {transcript}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onPress}
        disabled={isProcessing}
        aria-label={isListening ? "Stop voice input" : "Start voice input"}
        className={[
          "relative grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_12px_28px_rgba(139,0,0,0.28)] ring-4 ring-white transition",
          isListening ? "bg-[#8B0000]" : "bg-[#8B0000]",
          isProcessing ? "cursor-wait bg-[#777777]" : "active:scale-95",
        ].join(" ")}
      >
        {isListening ? (
          <span className="absolute h-24 w-24 animate-ping rounded-full bg-[#8B0000]/25" />
        ) : null}
        {isProcessing ? (
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <MicIcon />
        )}
      </button>
      {error ? (
        <p className="max-w-48 text-center text-xs font-semibold text-[#8B0000]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
