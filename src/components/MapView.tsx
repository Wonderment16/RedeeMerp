import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import type { Route } from "../types";

type Props = {
  position: [number, number];
  route: Route | null;
};

export default function MapView({ position, route }: Props) {
    const routePositions: [number, number][] =
    route?.polyline.map((point) => [
        point.lat,
        point.lng,
    ]) ?? [];

  return (
    <MapContainer
      center={position}
      zoom={16}
      style={{
        height: "100%",
        width: "100%",
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={position}>
        <Popup>You are here</Popup>
      </Marker>

      {routePositions.length > 0 && (
        <Polyline positions={routePositions} />
      )}
    </MapContainer>
  );
}