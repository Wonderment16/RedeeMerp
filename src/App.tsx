import { useCallback, useEffect } from "react";
import DestinationSheet from "./components/DestinationSheet";
import LandingHome from "./components/LandingHome";
import MapView from "./components/MapView";
import { resolveDestination } from "./services/destinationResolver";
import { useNavigation } from "./hooks/useNavigation";
import { useVoice } from "./hooks/useVoice";
import logoUrl from "../assets/rccg-logo.gif";


export default function App() {
  const navigation = useNavigation();
  const { selectDestination } = navigation;

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const destination = await resolveDestination(transcript);
      if (destination) {
        selectDestination(destination);
      }
    },
    [selectDestination],
  );

  const voice = useVoice({ onTranscript: handleTranscript });
  const locationAccuracyWarning =
    navigation.location?.accuracy != null && navigation.location.accuracy > 50;
  const isNavigationMode = navigation.phase === "navigating";
  const showMap = isNavigationMode;

  useEffect(() => {
    const interval = window.setInterval(navigation.processLocationTick, 2000);
    return () => window.clearInterval(interval);
  }, [navigation.processLocationTick]);

  return (
    <main className="relative min-h-screen bg-[#FAFAFA] text-[#1A1A1A]">
      <header className="absolute inset-x-0 top-0 z-40 flex min-h-[72px] items-center justify-between border-b border-[#8B0000]/10 bg-white/95 px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:left-1/2 md:top-4 md:w-[min(940px,calc(100%-32px))] md:-translate-x-1/2 md:rounded-2xl md:border">
        <button
          type="button"
          onClick={navigation.handleLogoTap}
          className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl pr-2 text-left active:scale-[0.99]"
          aria-label="RedeeMERP logo"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#8B0000]/15 bg-[#FFF8D8]">
            <img src={logoUrl} alt="" className="h-10 w-10 rounded-full" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-black tracking-tight text-[#8B0000] sm:text-xl">
              RCCG Camp Navigator
            </span>
            <span className="block truncate text-xs font-semibold text-[#666666]">
              RedeeMERP - Put your phone away. We'll guide the way.
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {navigation.locationStatus === "watching" ? (
            <span className="hidden rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-extrabold text-[#1B5E20] sm:inline-flex">
              GPS live
            </span>
          ) : null}
          {navigation.demoMode ? (
            <span className="rounded-full bg-[#FFF6BF] px-3 py-1 text-xs font-extrabold text-[#8B0000]">
              Demo
            </span>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-screen">
        {showMap ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <MapView
              position={
                navigation.location
                  ? [
                      navigation.location.lat,
                      navigation.location.lng,
                    ]
                  : [6.878, 3.732]
              }
              route={navigation.route}
              destination={navigation.selectedDestination}
            />
          </div>
        ) : null}

        <div className="relative z-10">
          {!isNavigationMode ? (
            <LandingHome
              selectedDestination={navigation.selectedDestination}
              onSelectDestination={navigation.selectDestination}
            />
          ) : null}
        </div>
      </div>

      {navigation.locationStatus === "denied" ? (
        <div className="absolute left-4 right-4 top-24 z-30 rounded-2xl border border-[#8B0000]/10 bg-white px-4 py-3 text-sm font-bold text-[#8B0000] shadow-lg md:left-1/2 md:w-[min(720px,calc(100%-32px))] md:-translate-x-1/2">
          Location permission denied. Enable location in Chrome to use live navigation.
        </div>
      ) : null}

      {navigation.locationError ? (
        <div className="absolute left-4 right-4 top-24 z-30 rounded-2xl border border-[#8B0000]/10 bg-white px-4 py-3 text-sm font-bold text-[#8B0000] shadow-lg md:left-1/2 md:w-[min(720px,calc(100%-32px))] md:-translate-x-1/2">
          {navigation.locationError}
        </div>
      ) : null}

      {locationAccuracyWarning ? (
        <div className="absolute left-4 right-4 top-40 z-30 rounded-2xl border border-[#8B0000]/10 bg-white px-4 py-3 text-sm font-semibold text-[#8B0000] shadow-lg md:left-1/2 md:w-[min(720px,calc(100%-32px))] md:-translate-x-1/2">
          GPS signal is weak. Navigation may be less accurate.
        </div>
      ) : null}

      {navigation.error ? (
        <div className="absolute left-4 right-4 top-24 z-30 rounded-2xl border border-[#8B0000]/10 bg-white px-4 py-3 text-sm font-bold text-[#8B0000] shadow-lg md:left-1/2 md:w-[min(720px,calc(100%-32px))] md:-translate-x-1/2">
          {navigation.error}
        </div>
      ) : null}

      <DestinationSheet
        phase={navigation.phase}
        selectedDestination={navigation.selectedDestination}
        instruction={navigation.instruction}
        isLoadingRoute={navigation.isLoadingRoute}
        routeError={navigation.error}
        voiceState={voice.state}
        voiceTranscript={voice.transcript}
        voiceError={voice.error}
        onVoicePress={voice.toggle}
        onSelectDestination={navigation.selectDestination}
        onStartNavigation={navigation.startNavigation}
        onStopNavigation={navigation.stopNavigation}
        onCancelDestination={navigation.clearDestination}
      />
    </main>
  );
}
