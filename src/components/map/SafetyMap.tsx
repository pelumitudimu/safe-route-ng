import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SEVERITY_META, CATEGORY_META, timeAgo, type Incident } from "@/lib/safety";

const SEVERITY_COLOR: Record<string, string> = {
  low: "#f5b301",
  medium: "#fb923c",
  high: "#f97316",
  critical: "#ef4444",
};

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#0b1220;font-weight:700;font-size:11px;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid #fff"><span style="transform:rotate(45deg)">${label}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickCapture({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  color: string;
}

interface Props {
  incidents?: Incident[];
  center: [number, number];
  zoom?: number;
  heatmap?: boolean;
  userLocation?: [number, number] | null;
  routeLine?: [number, number][];
  markers?: MapMarker[];
  onMapClick?: (lat: number, lon: number) => void;
  pickMarker?: [number, number] | null;
  className?: string;
}

export default function SafetyMap({
  incidents = [],
  center,
  zoom = 12,
  heatmap = false,
  userLocation,
  routeLine,
  markers = [],
  onMapClick,
  pickMarker,
  className,
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} zoom={zoom} />
      {onMapClick && <ClickCapture onClick={onMapClick} />}

      {incidents.map((inc) => {
        const color = SEVERITY_COLOR[inc.severity];
        const weight = SEVERITY_META[inc.severity].weight;
        if (heatmap) {
          return (
            <Circle
              key={inc.id}
              center={[inc.latitude, inc.longitude]}
              radius={300 + weight * 220}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.22, weight: 0, opacity: 0 }}
            />
          );
        }
        const Icon = CATEGORY_META[inc.category].icon;
        void Icon;
        return (
          <CircleMarker
            key={inc.id}
            center={[inc.latitude, inc.longitude]}
            radius={6 + weight}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: color, fillOpacity: 0.9 }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <strong>{inc.title}</strong>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                  {CATEGORY_META[inc.category].label} · {SEVERITY_META[inc.severity].label}
                </div>
                {inc.address && (
                  <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>{inc.address}</div>
                )}
                <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                  {timeAgo(inc.created_at)} · {inc.confirm_count} confirms
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {userLocation && (
        <CircleMarker
          center={userLocation}
          radius={8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}

      {pickMarker && <Marker position={pickMarker} icon={pinIcon("#34d399", "📍")} />}

      {markers.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lon]} icon={pinIcon(m.color, m.label)} />
      ))}

      {routeLine && routeLine.length > 1 && (
        <Polyline positions={routeLine} pathOptions={{ color: "#34d399", weight: 5, opacity: 0.85 }} />
      )}
    </MapContainer>
  );
}
