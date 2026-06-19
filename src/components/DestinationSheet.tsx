import { useMemo, useState } from "react";
import { RCCG_CAMP_LOCATIONS } from "../constants/locations";
import type { Destination, NavigationPhase, VoiceState } from "../types";
import PopularPlaces from "./PopularPlaces";
import VoiceButton from "./VoiceButton";

type DestinationSheetProps = {
  phase: NavigationPhase;
  selectedDestination: Destination | null;
  instruction: string;
  isLoadingRoute: boolean;
  routeError: string | null;
  voiceState: VoiceState;
  voiceTranscript: string;
  voiceError: string | null;
  onVoicePress: () => void;
  onSelectDestination: (destination: Destination) => void;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  onCancelDestination: () => void;
};

function categoryLabel(category: Destination["category"]) {
  const labels: Record<Destination["category"], string> = {
    auditorium: "Auditorium",
    gate: "Gate",
    facility: "Facility",
    transit: "Transport",
    hostel: "Hostel",
    office: "Office",
    food: "Food & Dining",
  };
  return labels[category];
}

function destinationInitial(destination: Destination) {
  return destination.name.slice(0, 1).toUpperCase();
}

export default function DestinationSheet({
  phase,
  selectedDestination,
  instruction,
  isLoadingRoute,
  routeError,
  voiceState,
  voiceTranscript,
  voiceError,
  onVoicePress,
  onSelectDestination,
  onStartNavigation,
  onStopNavigation,
  onCancelDestination,
}: DestinationSheetProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return RCCG_CAMP_LOCATIONS.filter(
      (destination) =>
        destination.name.toLowerCase().includes(normalized) ||
        destination.category.toLowerCase().includes(normalized) ||
        destination.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
    ).slice(0, 5);
  }, [query]);

  return (
    <section className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-white/70 bg-white/95 backdrop-blur-xl px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_44px_rgba(0,0,0,0.18)] md:left-1/2 md:max-w-3xl md:-translate-x-1/2 md:bottom-5 md:rounded-[28px]">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#E6E0E0]" />

      {phase === "idle" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#8B0000]">
                Choose destination
              </p>
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Where do you want to go?"
                  className="min-h-14 w-full rounded-2xl border border-[#E5E5E5] bg-[#F8F6F6] px-4 pr-10 text-base font-semibold text-[#1A1A1A] outline-none focus:border-[#8B0000] focus:bg-white"
                  aria-label="Search destinations"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#8B0000]">
                  Go
                </span>
              </div>
              {results.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-auto rounded-2xl border border-[#E5E5E5] bg-white shadow-lg">
                  {results.map((destination) => (
                    <button
                      key={destination.id}
                      type="button"
                      onClick={() => {
                        onSelectDestination(destination);
                        setQuery("");
                      }}
                      className="flex min-h-14 w-full items-center border-b border-[#F0ECEC] px-3 text-left last:border-b-0 active:bg-[#FFF8D8]"
                    >
                      <span className="mr-3 grid h-10 w-10 place-items-center rounded-full bg-[#8B0000] text-sm font-black text-white">
                        {destinationInitial(destination)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-[#1A1A1A]">
                          {destination.name}
                        </span>
                        <span className="block text-xs font-semibold text-[#666666]">
                          {categoryLabel(destination.category)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <VoiceButton
              state={voiceState}
              transcript={voiceTranscript}
              error={voiceError}
              onPress={onVoicePress}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#666666]">
              Popular places
            </p>
            <PopularPlaces onSelectDestination={onSelectDestination} />
          </div>
        </div>
      ) : null}

      {phase === "selected" && selectedDestination ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-[#8B0000]">
                Destination selected
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-[#1A1A1A]">
                {selectedDestination.name}
              </h2>
              <span className="mt-2 inline-flex min-h-8 items-center rounded-full bg-[#FFF6BF] px-3 text-sm font-black text-[#1A1A1A]">
                {categoryLabel(selectedDestination.category)}
              </span>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#8B0000] text-lg font-black text-white">
              {destinationInitial(selectedDestination)}
            </span>
          </div>
          {routeError ? (
            <p className="rounded-2xl bg-[#FFF2F2] px-4 py-3 text-sm font-bold text-[#8B0000]">
              {routeError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onStartNavigation}
            disabled={isLoadingRoute}
            className="min-h-14 w-full rounded-2xl bg-[#8B0000] px-4 text-base font-black text-white shadow-[0_12px_24px_rgba(139,0,0,0.24)] disabled:bg-gray-500"
          >
            {isLoadingRoute ? "Preparing Route..." : "Start Navigation"}
          </button>
          <button
            type="button"
            onClick={onCancelDestination}
            className="min-h-12 w-full rounded-2xl text-sm font-black text-[#666666] active:bg-[#F8F6F6]"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {phase === "navigating" ? (
        <div className="space-y-4 text-center">
          <p className="text-xs font-black uppercase tracking-wide text-[#8B0000]">
            Current guidance
          </p>
          <p className="mx-auto max-w-xl text-3xl font-black leading-tight text-[#1A1A1A]">
            {instruction}
          </p>
          <p className="text-sm font-bold text-[#666666]">
            Navigating to {selectedDestination?.name}
          </p>
          <button
            type="button"
            onClick={onStopNavigation}
            className="mx-auto min-h-12 rounded-full border-2 border-[#8B0000] px-7 text-sm font-black text-[#8B0000] active:bg-[#FFF2F2]"
          >
            Stop Navigation
          </button>
        </div>
      ) : null}
    </section>
  );
}
