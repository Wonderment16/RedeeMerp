import { useRef, useState, useEffect } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import {
  getDemoLocationPoint,
  KalmanLocationFilter,
} from "../services/gpsResilience";

export interface UseLocationResult {
  coords: Location.LocationObjectCoords | null;
  heading: number | null;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
  lastLocationAt: number | null;
  isDemoLocation: boolean;
}

// Mock data for web testing (RCCG Camp area)
const MOCK_WEB_LOCATION: Location.LocationObjectCoords = {
  latitude: 6.8698,
  longitude: 3.7292,
  altitude: 200,
  accuracy: 15,
  altitudeAccuracy: 5,
  heading: 45,
  speed: 0,
};

const ENABLE_DEMO_GPS =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_GPS === "true";

export function useLocation(): UseLocationResult {
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(
    null,
  );
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLocationAt, setLastLocationAt] = useState<number | null>(null);
  const filterRef = useRef(new KalmanLocationFilter());

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let demoInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const publishCoords = (nextCoords: Location.LocationObjectCoords) => {
      const smoothedCoords = filterRef.current.smooth(nextCoords);
      setCoords(smoothedCoords);
      setLastLocationAt(Date.now());
      if (smoothedCoords.heading !== null) {
        setHeading(smoothedCoords.heading);
      }
    };

    async function startWatching() {
      try {
        // Development-only kill switch for demos when judges cannot walk a route.
        if (ENABLE_DEMO_GPS) {
          let pathIndex = 0;
          if (isMounted) {
            setPermissionStatus(Location.PermissionStatus.GRANTED);
            publishCoords(getDemoLocationPoint(pathIndex));
          }

          demoInterval = setInterval(() => {
            if (!isMounted) {
              return;
            }
            pathIndex += 1;
            publishCoords(getDemoLocationPoint(pathIndex));
          }, 3000);
          return;
        }

        // On web, use mock data for testing
        if (Platform.OS === "web") {
          if (isMounted) {
            setPermissionStatus(Location.PermissionStatus.GRANTED);
            publishCoords(MOCK_WEB_LOCATION);
            console.log("[useLocation] Web: Using mock location for testing");
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        setPermissionStatus(status);

        if (status !== Location.PermissionStatus.GRANTED) {
          setError("Location permission denied");
          return;
        }

        // Get initial location quickly
        try {
          const initialLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (isMounted) {
            publishCoords(initialLocation.coords);
          }
        } catch (initialErr) {
          // If getCurrentPosition fails (e.g. timeout on simulator), ignore and let watchPositionAsync handle it
          console.warn(
            "Initial location fetch failed, waiting for watchPositionAsync:",
            initialErr,
          );
        }

        // Subscribe to real-time high-accuracy updates
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 2,
          },
          (locationObject) => {
            if (isMounted) {
              publishCoords(locationObject.coords);
            }
          },
        );
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to access location");
        }
      }
    }

    startWatching();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.remove();
      }
      if (demoInterval) {
        clearInterval(demoInterval);
      }
    };
  }, []);

  return {
    coords,
    heading,
    permissionStatus,
    error,
    lastLocationAt,
    isDemoLocation: ENABLE_DEMO_GPS,
  };
}
