import { useMemo, useState } from "react";
import { POPULAR_DESTINATION_IDS, RCCG_CAMP_LOCATIONS } from "../constants/locations";
import type { Destination } from "../types";

type LandingHomeProps = {
  selectedDestination: Destination | null;
  onSelectDestination: (destination: Destination) => void;
};

const suggestionIds = [
  "main-auditorium",
  "main-gate",
  "prayer-ground",
  "bus-terminal",
  "admin-office",
  "medical-centre",
  "canaanland-market",
  "camp-hostels",
];

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

function byIds(ids: string[]) {
  return ids
    .map((id) => RCCG_CAMP_LOCATIONS.find((destination) => destination.id === id))
    .filter(Boolean) as Destination[];
}

export default function LandingHome({
  selectedDestination,
  onSelectDestination,
}: LandingHomeProps) {
  const [query, setQuery] = useState("");
  const popularDestinations = useMemo(() => byIds(POPULAR_DESTINATION_IDS), []);
  const suggestedDestinations = useMemo(() => byIds(suggestionIds), []);
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return RCCG_CAMP_LOCATIONS.filter(
      (destination) =>
        destination.name.toLowerCase().includes(normalized) ||
        destination.category.toLowerCase().includes(normalized) ||
        destination.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
    ).slice(0, 8);
  }, [query]);

  const visibleSuggestions = query ? searchResults : suggestedDestinations;

  return (
    <section className="h-full overflow-y-auto bg-[#FAFAFA] px-4 pb-72 pt-24 md:pb-64 md:pt-32">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[28px] border border-[#8B0000]/10 bg-white p-5 shadow-[0_16px_48px_rgba(0,0,0,0.08)] md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8B0000]">
            RCCG Redemption Camp
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-[#1A1A1A] md:text-5xl">
            Where do you want to go?
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#666666] md:text-base">
            Search the camp directory, pick a popular place, or choose one of the
            suggested destinations to begin navigation.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#666666]">
              Search destinations
            </label>
            <div className="relative">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search auditorium, health, bus, food..."
                className="min-h-14 w-full rounded-2xl border border-[#E5E5E5] bg-[#F8F6F6] px-4 pr-14 text-base font-bold text-[#1A1A1A] outline-none focus:border-[#8B0000] focus:bg-white"
                aria-label="Search RCCG camp destinations"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#8B0000]">
                Go
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#8B0000]">
              Most popular places
            </h2>
            {selectedDestination ? (
              <span className="hidden truncate rounded-full bg-[#FFF6BF] px-3 py-1 text-xs font-black text-[#8B0000] sm:inline-flex">
                Selected: {selectedDestination.name}
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {popularDestinations.map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => onSelectDestination(destination)}
                className="min-h-24 rounded-2xl border border-[#8B0000]/10 bg-white p-4 text-left shadow-sm transition active:scale-[0.98]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#8B0000] text-sm font-black text-white">
                  {destination.name.slice(0, 1)}
                </span>
                <span className="mt-3 block text-sm font-black text-[#1A1A1A]">
                  {destination.name}
                </span>
                <span className="mt-1 block text-xs font-bold text-[#666666]">
                  {categoryLabel(destination.category)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#666666]">
            {query ? "Search results" : "Suggestions"}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visibleSuggestions.map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => onSelectDestination(destination)}
                className="flex min-h-16 items-center rounded-2xl border border-[#E5E5E5] bg-white px-4 text-left shadow-sm transition active:bg-[#FFF8D8]"
              >
                <span className="mr-3 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFF6BF] text-sm font-black text-[#8B0000]">
                  {destination.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#1A1A1A]">
                    {destination.name}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-[#666666]">
                    {categoryLabel(destination.category)}
                  </span>
                </span>
              </button>
            ))}
            {query && visibleSuggestions.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E5E5] bg-white px-4 py-5 text-sm font-bold text-[#666666]">
                No destination found. Try "auditorium", "health", "bus", or
                "food".
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
