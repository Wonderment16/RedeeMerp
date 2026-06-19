import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Destination, Route } from "../types";
import { LatLngBounds } from "leaflet";

type Props = {
  position: [number, number];
  route: Route | null;
  destination: Destination | null;
};

export default function MapView({ position, route, destination }: Props) {
    const routePositions: [number, number][] =
    route?.polyline.map((point) => [
        point.lat,
        point.lng,
    ]) ?? [];

    const campBounds = new LatLngBounds(
        [6.790, 3.440],
        [6.835, 3.475]
    );

  return (
    <MapContainer
        center={[6.810, 3.455]}
        zoom={16}
        minZoom={15}
        maxZoom={19}
        maxBounds={campBounds}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={position}>
        <Popup>You are here</Popup>
      </Marker>

      {destination ? (
        <CircleMarker
          center={[destination.coordinates.lat, destination.coordinates.lng]}
          pathOptions={{ color: "red", fillColor: "red" }}
          radius={8}
        >
          <Tooltip
            direction="top"
            offset={[0, -12]}
            opacity={1}
            permanent
            className="leaflet-tooltip destination-label"
          >
            <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {destination.name}
              </div>
              <div style={{ fontSize: "0.85rem" }}>🎯</div>
            </div>
          </Tooltip>
          <Popup>{destination.name}</Popup>
        </CircleMarker>
      ) : null}

      {routePositions.length > 0 && (
        <Polyline positions={routePositions} />
      )}
    </MapContainer>
  );
}