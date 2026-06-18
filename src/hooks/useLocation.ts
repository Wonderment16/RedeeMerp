import { useEffect, useRef, useState } from "react";
import type { LatLng, LocationStatus } from "../types";

type UseLocationOptions = {
  demoPath?: LatLng[];
  demoMode?: boolean;
};

export function useLocation({ demoMode = false, demoPath = [] }: UseLocationOptions = {}) {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const demoIndexRef = useRef(0);

  useEffect(() => {
    if (demoMode && demoPath.length > 0) {
      setStatus("watching");
      setLocation(demoPath[0]);
      demoIndexRef.current = 0;

      const interval = window.setInterval(() => {
        demoIndexRef.current = Math.min(demoIndexRef.current + 1, demoPath.length - 1);
        setLocation(demoPath[demoIndexRef.current]);
      }, 2000);

      return () => window.clearInterval(interval);
    }

    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      setError("Geolocation is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("SUCCESS", pos.coords);
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatus("watching");
        setError(null);
      },
      (err) => {
        console.log("ERROR", err.code, err.message);
      },
    );

    setStatus("watching");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("watching");
        setError(null);
      },
      (nextError) => {
        setStatus(nextError.code === nextError.PERMISSION_DENIED ? "denied" : "unavailable");
        setError(nextError.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [demoMode, demoPath]);

  return { location, status, error };
}
