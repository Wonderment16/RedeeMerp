import { POPULAR_DESTINATION_IDS, RCCG_CAMP_LOCATIONS } from "../constants/locations";
import type { Destination } from "../types";

type PopularPlacesProps = {
  onSelectDestination: (destination: Destination) => void;
};

const shortLabelById: Record<string, string> = {
  "main-auditorium": "Auditorium",
  "prayer-ground": "Prayer",
  eateries: "Eateries",
  "bus-terminal": "Bus",
  bookshop: "Books",
  "admin-office": "Secretariat",
  "medical-centre": "Health",
};

export default function PopularPlaces({ onSelectDestination }: PopularPlacesProps) {
  const popularDestinations = POPULAR_DESTINATION_IDS.map((id) =>
    RCCG_CAMP_LOCATIONS.find((destination) => destination.id === id),
  ).filter(Boolean) as Destination[];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {popularDestinations.map((destination) => (
        <button
          key={destination.id}
          type="button"
          onClick={() => onSelectDestination(destination)}
          className="min-h-12 shrink-0 rounded-full border border-[#8B0000]/10 bg-[#FFFDF2] px-4 text-sm font-extrabold text-[#8B0000] shadow-sm active:scale-[0.98]"
        >
          {shortLabelById[destination.id] ?? destination.name}
        </button>
      ))}
    </div>
  );
}
