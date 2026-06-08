import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import Svg, { Circle, Path } from "react-native-svg";
import type { LatLng } from "react-native-maps";

import SearchBar from "../components/SearchBar";
import VoiceButton from "../components/VoiceButton";
import { RCCG_CAMP_LOCATIONS } from "../constants/locations";
import { useLocation } from "../hooks/useLocation";
import { useNavigation } from "../hooks/useNavigation";
import { Destination } from "../types";

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== "web") {
  try {
    const RNMaps = require("react-native-maps");
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
  } catch (error) {
    console.warn("[HomeScreen] react-native-maps unavailable:", error);
  }
}

const COLORS = {
  primary: "#8B0000",
  accent: "#FFD700",
  background: "#FAFAFA",
  text: "#1A1A1A",
  muted: "#666666",
  border: "#E5E5E5",
  white: "#FFFFFF",
};

const INITIAL_CENTER: LatLng = { latitude: 6.8698, longitude: 3.7292 };
const BOUNDARY_NE: LatLng = { latitude: 6.885, longitude: 3.738 };
const BOUNDARY_SW: LatLng = { latitude: 6.855, longitude: 3.72 };
const INITIAL_CAMERA = {
  center: INITIAL_CENTER,
  pitch: 0,
  heading: 0,
  altitude: 2500,
  zoom: 15,
};

const POPULAR_CHIPS = [
  { label: "🏛 Auditorium", destinationId: "main-auditorium" },
  { label: "⛪ Prayer Ground", destinationId: "prayer-ground" },
  { label: "🍽 Eateries", destinationId: "eateries" },
  { label: "🚌 Bus Terminal", destinationId: "bus-terminal" },
  { label: "📚 Bookshop", destinationId: "bookshop" },
];

const RCCG_DARK_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ color: "#4C0000" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#F8E8E8" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#2A0000" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#7A1717" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#FFD700" }, { weight: 0.5 }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#5F0909" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#27004F" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#5B0000" }],
  },
];

function destinationCoordinate(destination: Destination): LatLng {
  return {
    latitude: destination.coordinates.lat,
    longitude: destination.coordinates.lng,
  };
}

function categoryLabel(category: Destination["category"]) {
  switch (category) {
    case "auditorium":
      return "Auditorium";
    case "gate":
      return "Gate";
    case "facility":
      return "Facility";
    case "transit":
      return "Transport";
    case "hostel":
      return "Hostel";
    case "office":
      return "Office";
    case "food":
      return "Food & Dining";
    default:
      return "Destination";
  }
}

function popularChipLabel(destinationId: string) {
  switch (destinationId) {
    case "main-auditorium":
      return "🏛 Auditorium";
    case "prayer-ground":
      return "⛪ Prayer Ground";
    case "eateries":
      return "🍽 Eateries";
    case "bus-terminal":
      return "🚌 Bus Terminal";
    case "bookshop":
      return "📚 Bookshop";
    default:
      return "Destination";
  }
}

function GoldPin({ label }: { label?: string }) {
  return (
    <View style={styles.activePinContainer}>
      <Svg width={38} height={46} viewBox="0 0 38 46">
        <Path
          d="M19 2C10.72 2 4 8.72 4 17c0 10.25 15 27 15 27s15-16.75 15-27C34 8.72 27.28 2 19 2z"
          fill={COLORS.accent}
          stroke={COLORS.primary}
          strokeWidth={2}
        />
        <Circle cx={19} cy={17} r={6} fill={COLORS.primary} />
      </Svg>
      {label ? (
        <View style={styles.activePinLabel}>
          <Text style={styles.activePinLabelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function MapScreen() {
  const locationState = useLocation();
  const { permissionStatus, error } = locationState;
  const {
    startNavigation,
    stopNavigation,
    isNavigating,
    isRouteFetching,
    route,
    routeError,
    destination,
    nextInstruction,
    guidanceState,
    isRecalculating,
    gpsMessage,
    gpsSignal,
    isGuidancePaused,
    offlineMessage,
    ttsFallbackText,
  } = useNavigation(locationState);
  const mapRef = useRef<any>(null);
  const [selectedDestination, setSelectedDestination] =
    useState<Destination | null>(null);
  const [confirmationCandidates, setConfirmationCandidates] = useState<
    Destination[]
  >([]);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);

  const activeDestination = destination ?? selectedDestination;

  useEffect(() => {
    if (!activeDestination || !mapRef.current || !MapView) {
      return;
    }

    mapRef.current.animateCamera(
      {
        center: destinationCoordinate(activeDestination),
        zoom: 17,
        pitch: 0,
        heading: 0,
      },
      { duration: 600 },
    );
  }, [activeDestination]);

  const handleMapReady = () => {
    if (mapRef.current) {
      mapRef.current.setMapBoundaries(BOUNDARY_NE, BOUNDARY_SW);
    }
  };

  const handleSelectDestination = (nextDestination: Destination) => {
    setSelectedDestination(nextDestination);
    setConfirmationCandidates([]);
    setVoiceTranscript(null);
    Keyboard.dismiss();
  };

  const handleStartNavigation = async () => {
    if (!selectedDestination) {
      return;
    }

    await startNavigation(selectedDestination);
  };

  const handleCancelDestination = () => {
    setSelectedDestination(null);
  };

  const handleStopNavigation = async () => {
    await stopNavigation();
    setSelectedDestination(null);
  };

  const renderMap = () => {
    if (Platform.OS === "web" || !MapView) {
      return (
        <View style={styles.mapFallback}>
          <View style={styles.fallbackRoadOne} />
          <View style={styles.fallbackRoadTwo} />
          <GoldPin label="RCCG Camp" />
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialCamera={INITIAL_CAMERA}
        minZoomLevel={14}
        maxZoomLevel={19}
        mapPadding={styles.mapPadding}
        customMapStyle={RCCG_DARK_MAP_STYLE}
        onMapReady={handleMapReady}
        onPress={() => Keyboard.dismiss()}
        showsUserLocation
        showsMyLocationButton
      >
        {route?.polylineDecoded && route.polylineDecoded.length > 1 ? (
          <Polyline
            coordinates={route.polylineDecoded}
            strokeColor={COLORS.primary}
            strokeWidth={5}
          />
        ) : null}

        {activeDestination ? (
          <Marker coordinate={destinationCoordinate(activeDestination)}>
            <GoldPin label={activeDestination.name} />
          </Marker>
        ) : null}
      </MapView>
    );
  };

  const renderIdleSheet = () => (
    <>
      <View style={styles.searchRow}>
        <SearchBar onDestinationSelected={handleSelectDestination} />
        <VoiceButton
          size={64}
          idleColor={COLORS.primary}
          onDestinationResolved={handleSelectDestination}
          onNeedsConfirmation={(transcript, candidates) => {
            setVoiceTranscript(transcript);
            setConfirmationCandidates(candidates);
          }}
          onResolveFailed={(transcript) =>
            console.warn("[HomeScreen] No destination matched:", transcript)
          }
        />
      </View>

      {confirmationCandidates.length > 0 ? (
        <View style={styles.confirmationPanel}>
          <Text style={styles.confirmationTitle} numberOfLines={1}>
            Did you mean one of these?
          </Text>
          <Text style={styles.confirmationTranscript} numberOfLines={1}>
            {voiceTranscript}
          </Text>
          {confirmationCandidates.map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              style={styles.confirmationRow}
              onPress={() => handleSelectDestination(candidate)}
              accessibilityLabel={`Confirm ${candidate.name}`}
              accessibilityRole="button"
              activeOpacity={0.84}
            >
              <Text style={styles.confirmationName} numberOfLines={1}>
                {candidate.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        keyboardShouldPersistTaps="handled"
      >
        {POPULAR_CHIPS.map((chip) => {
          const chipDestination = RCCG_CAMP_LOCATIONS.find(
            (item) => item.id === chip.destinationId,
          );
          if (!chipDestination) {
            return null;
          }

          return (
            <TouchableOpacity
              key={chip.destinationId}
              style={styles.chip}
              onPress={() => handleSelectDestination(chipDestination)}
              accessibilityLabel={`Select ${chipDestination.name}`}
              accessibilityRole="button"
              activeOpacity={0.84}
            >
              <Text style={styles.chipText}>
                {popularChipLabel(chip.destinationId)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  const renderSelectedSheet = () => {
    if (!selectedDestination) {
      return null;
    }

    return (
      <>
        <Text style={styles.destinationName} numberOfLines={1}>
          {selectedDestination.name}
        </Text>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>
            {categoryLabel(selectedDestination.category)}
          </Text>
        </View>
        {routeError ? <Text style={styles.routeError}>{routeError}</Text> : null}
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartNavigation}
          disabled={isRouteFetching}
          activeOpacity={0.85}
          accessibilityLabel={`Start navigation to ${selectedDestination.name}`}
          accessibilityRole="button"
        >
          {isRouteFetching ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.startButtonText}>Start Navigation</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelDestination}
          accessibilityLabel="Cancel selected destination"
          accessibilityRole="button"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderNavigatingSheet = () => (
    <View style={styles.navigationSheetContent}>
      <Text style={styles.currentInstruction} numberOfLines={2}>
        {ttsFallbackText ??
          nextInstruction ??
          guidanceState?.lastSpokenInstruction ??
          (isGuidancePaused ? "Guidance paused." : "Keep moving straight.")}
      </Text>
      <Text style={styles.navigatingDestination} numberOfLines={1}>
        {destination?.name ?? activeDestination?.name}
      </Text>
      <TouchableOpacity
        style={styles.stopButton}
        onPress={handleStopNavigation}
        accessibilityLabel="Stop navigation"
        accessibilityRole="button"
        activeOpacity={0.84}
      >
        <Text style={styles.stopButtonText}>Stop Navigation</Text>
      </TouchableOpacity>
    </View>
  );

  if (
    permissionStatus === Location.PermissionStatus.DENIED ||
    error === "Location permission denied"
  ) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Location Access Needed</Text>
        <Text style={styles.permissionText}>
          RedeeMERP needs location access to guide you around RCCG Camp.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => Linking.openSettings()}
          accessibilityLabel="Open settings to enable location"
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.permissionButtonText}>Enable Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.appName}>RedeeMERP</Text>
        <Text style={styles.tagline}>
          Put your phone away. We'll guide the way.
        </Text>
      </View>

      {gpsMessage ? (
        <View
          style={[
            styles.statusBanner,
            gpsSignal === "lost" && styles.statusBannerCritical,
          ]}
        >
          <Text style={styles.statusBannerText}>{gpsMessage}</Text>
        </View>
      ) : null}

      <View style={styles.mapArea}>{renderMap()}</View>

      {isRecalculating ? (
        <View style={styles.recalculationOverlay}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.recalculationText}>Recalculating route</Text>
        </View>
      ) : null}

      {offlineMessage ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{offlineMessage}</Text>
        </View>
      ) : null}

      <View style={styles.bottomSheet}>
        <ScrollView
          style={styles.bottomSheetScroll}
          contentContainerStyle={styles.bottomSheetContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {isNavigating
            ? renderNavigatingSheet()
            : selectedDestination
              ? renderSelectedSheet()
              : renderIdleSheet()}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    minHeight: 64,
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 4,
  },
  statusBanner: {
    minHeight: 36,
    justifyContent: "center",
    backgroundColor: "#FFF6BF",
    borderBottomColor: "#D8B900",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    zIndex: 4,
  },
  statusBannerCritical: {
    backgroundColor: "#FDE8E8",
    borderBottomColor: COLORS.primary,
  },
  statusBannerText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  appName: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "600",
  },
  tagline: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  mapArea: {
    flex: 1,
    backgroundColor: "#4C0000",
  },
  map: {
    flex: 1,
  },
  mapPadding: {
    top: 12,
    right: 12,
    bottom: 208,
    left: 12,
  },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#4C0000",
  },
  recalculationOverlay: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 6,
  },
  recalculationText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 10,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 196,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    paddingHorizontal: 14,
    zIndex: 7,
  },
  toastText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  fallbackRoadOne: {
    position: "absolute",
    width: "135%",
    height: 42,
    backgroundColor: "#7A1717",
    borderColor: COLORS.accent,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: "-24deg" }],
  },
  fallbackRoadTwo: {
    position: "absolute",
    width: "115%",
    height: 34,
    backgroundColor: "#5F0909",
    borderColor: "#C8A600",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: "38deg" }],
  },
  activePinContainer: {
    alignItems: "center",
  },
  activePinLabel: {
    maxWidth: 180,
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: -2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePinLabelText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 5,
  },
  bottomSheetScroll: {
    flex: 1,
  },
  bottomSheetContent: {
    flexGrow: 1,
    paddingBottom: 18,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chipList: {
    alignItems: "center",
    gap: 10,
    paddingTop: 14,
    paddingRight: 16,
  },
  confirmationPanel: {
    backgroundColor: "#FAFAFA",
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 10,
    overflow: "hidden",
  },
  confirmationTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  confirmationTranscript: {
    color: COLORS.muted,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  confirmationRow: {
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingHorizontal: 12,
  },
  confirmationName: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  chip: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  destinationName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
  },
  categoryPill: {
    alignSelf: "flex-start",
    minHeight: 28,
    justifyContent: "center",
    backgroundColor: "#FFF6BF",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  categoryPillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  routeError: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 4,
  },
  startButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    marginTop: 10,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  navigationSheetContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  currentInstruction: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  navigatingDestination: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 10,
  },
  stopButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 22,
  },
  stopButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: 28,
  },
  permissionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionText: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
  },
  permissionButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
